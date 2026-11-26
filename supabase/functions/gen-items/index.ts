// hit100 · AI 문항 생성 (Supabase Edge Function: gen-items)
// 필요한 비밀값: ANTHROPIC_API_KEY  (Edge Functions → Secrets 에 등록)
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = Deno.env.get("AI_MODEL") || "claude-sonnet-5-5";
// Supabase 유료(Pro) 플랜이면 Secrets에 AI_LONG=1 → 함수가 최대 400초까지 돌 수 있으므로 더 길게 생각하게 한다
const LONG = Deno.env.get("AI_LONG") === "1";
const MODELS: Record<string, string> = { best: "claude-opus-5-5", std: "claude-sonnet-5-5", fast: "claude-haiku-5-5" };

const GUIDE: Record<string, string> = {
  kor_read: [
    "[국어 독서 출제 기준]",
    "- 문항 구성: ①세부 정보 일치/불일치 ②핵심 개념·원리 이해 또는 추론 ③<보기>의 새 사례에 지문 원리를 적용(3점, 고난도) ④필요하면 문맥적 의미·어휘. 문항 수에 맞게 앞에서부터 고른다.",
    "- 발문은 수능 그대로: '윗글의 내용과 일치하지 않는 것은?', '윗글을 바탕으로 <보기>를 이해한 내용으로 가장 적절한 것은? [3점]' 등.",
    "- 모든 선지는 지문의 특정 문장에 근거가 있어야 한다. 정답 선지는 지문 표현을 그대로 베끼지 말고 재진술한다.",
    "- 오답 선지는 '인과 관계 뒤바꿈, 주체·대상 혼동, 조건 누락, 범위의 과잉 일반화, 정도·순서 왜곡, 지문에 없는 내용' 중 하나로 정교하게 설계한다. 터무니없는 오답 금지.",
    "- 다섯 선지의 길이와 문체를 비슷하게 맞춘다. 정답 번호는 고르게 분산한다.",
    "- 해설에는 근거 문단(예: 3문단)을 밝힌다.",
  ].join("\n"),
  kor_lit: [
    "[국어 문학 출제 기준]",
    "- 문항 구성: 표현상 특징·서술상 특징, 시어·소재의 의미와 기능, 인물의 태도·정서, <보기>(작품 해석 관점)를 바탕으로 한 감상(3점).",
    "- 선지는 작품의 구체적 구절을 짚어 판단하게 만들고, 오답은 구절 해석의 미세한 왜곡으로 설계한다.",
    "- 해설에는 근거 구절을 인용한다.",
  ].join("\n"),
  kor_etc: "[화법·작문·언어·매체] 실제 수능 선택과목 형식(발표·대화·초고·학습 활동·매체 자료)을 따른다. 문법은 국립국어원 기준으로 정확해야 하며, 예시 단어·문장의 분석이 틀리지 않도록 검증한다.",
  eng: "[영어 출제 기준] 수능 유형별 발문을 그대로 쓴다 (예: '다음 빈칸에 들어갈 말로 가장 적절한 것은?', '주어진 글 다음에 이어질 글의 순서로 가장 적절한 것을 고르시오.'). 지문은 자연스러운 학술·교양 영어, 어휘 수준은 수능 수준. 빈칸·순서·삽입은 논리 흐름으로만 정답이 하나로 정해지게 한다. 해설은 한국어.",
  math: "[수학 출제 기준] 수능 문체와 조건 제시 방식을 따른다. 계산 결과는 깔끔한 값이 되게 설계하고, 단답형 정답은 1 이상 999 이하의 자연수로 한다. 4점 문항은 조건 해석이 핵심이 되게 한다.",
};
const guideFor = (subject: string, type: string) =>
  subject === "kor" ? (/문학|시|소설|수필|극/.test(type) ? GUIDE.kor_lit : /독서|인문|사회|과학|기술|예술|융합/.test(type) || !type ? GUIDE.kor_read : GUIDE.kor_etc)
  : GUIDE[subject] || "";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const SUBJ: Record<string, string> = { kor: "국어", math: "수학", eng: "영어", hist: "한국사", inq: "탐구", etc: "기타" };
const MARK = ["①", "②", "③", "④", "⑤"];

const TOOL = {
  name: "save_items",
  description: "만든 문항을 저장한다",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", description: "유형 (요청받은 유형 그대로)" },
            level: { type: "string" },
            passage: { type: "string", description: "지문 세트일 때 지문 전체. 단일 문항이면 빈 문자열" },
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  stem: { type: "string", description: "발문과 <보기>까지 포함한 문제 본문" },
                  choices: { type: "array", items: { type: "string" }, description: "선지 5개 (번호 기호 없이). 단답형이면 빈 배열" },
                  answer: { type: "string", description: "객관식이면 1~5 숫자 하나, 단답형이면 정답 값" },
                  explain: { type: "string", description: "정답 근거와 오답 이유를 담은 해설" },
                },
                required: ["stem", "choices", "answer", "explain"],
              },
            },
          },
          required: ["type", "level", "passage", "questions"],
        },
      },
    },
    required: ["items"],
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return j({ error: "서버에 ANTHROPIC_API_KEY가 등록되지 않았어요." }, 500);

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY") || req.headers.get("apikey") || "", {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return j({ error: "로그인이 필요해요." }, 401);

    const b = await req.json();
    const { data: mem } = await sb.from("members").select("role").eq("user_id", user.id).eq("academy_id", b.academy_id).maybeSingle();
    if (!mem || mem.role === "student") return j({ error: "선생님 계정만 쓸 수 있어요." }, 403);
    if (b.action === "exam") return j(await importExam(key, b));

    const subject = String(b.subject || "kor");
    const subname = String(b.subname || "").slice(0, 40);
    const type = String(b.type || "").slice(0, 60);
    const level = ["최상", "상", "중", "하", "최하"].includes(b.level) ? b.level : "중";
    const isSet = b.kind === "set";
    const count = Math.max(1, Math.min(isSet ? 1 : 5, Number(b.count) || 1));
    const perSet = Math.max(2, Math.min(5, Number(b.perSet) || 3));
    const note = String(b.note || "").slice(0, 500);
    const sample = String(b.sample || "").slice(0, 3000);
    const avoid = (Array.isArray(b.avoid) ? b.avoid : []).map((x: unknown) => String(x).replace(/\s+/g, " ").slice(0, 80)).filter(Boolean).slice(0, 30);
    const seed = Math.floor(Math.random() * 1e6);
    const model = MODELS[String(b.quality)] || MODEL;

    const subjName = SUBJ[subject] + (subname ? ` (${subname})` : "");
    const LV: Record<string, Record<string, string>> = {
      최상: {
        math: "킬러 문항. 수능 공통 22번·선택 30번급(예상 정답률 5% 이하). (가)(나)(다) 조건을 모두 결합해야 미지 함수나 수열이 결정되고, 그래프 개형 추론·여러 경우 나누기·숨은 조건 발견이 필수다. 대부분의 상위권 학생도 시간 안에 못 풀 정도여야 하고, 정답은 단답형 자연수로 한다. 4점 일반 문항 수준이면 실패작이다.",
        kor: "킬러 문항. 수능 국어 오답률 1~3위급(예상 정답률 10~25%). 독서는 지문의 원리를 낯선 <보기> 사례에 여러 단계로 적용하거나 두 이론을 교차 비교해야 하고, 문학은 <보기> 관점과 구절 해석을 정밀하게 결합해야 한다. 선지 다섯 개가 모두 그럴듯하고 정답과 매력적 오답의 차이가 한두 단어여야 한다.",
        eng: "킬러 문항. 수능 영어 빈칸 33·34번, 순서·삽입 36~39번 최고난도급(예상 정답률 15~30%). 추상적·철학적·학술적 지문, 긴 수식어와 복잡한 구문, 정답과 거의 같은 매력적 오답을 넣는다.",
        hist: "한국사 최고난도. 사료를 해석해 시기를 특정하고 인접 시기 사건과 정밀하게 구별해야 하는 문항.",
        inq: "탐구 킬러 문항. 해당 과목 수능 오답률 1위급(예상 정답률 15% 이하): 자료·그래프 해석과 여러 개념의 결합, 계산형이면 다단계 추론.",
        _: "킬러 문항(예상 정답률 15% 이하). 여러 개념을 결합한 다단계 추론이 필요해야 한다.",
      },
      상: {
        math: "수능 4점 고난도(15·21·28·29번급, 예상 정답률 15~35%). 두 개 이상의 조건을 결합하고 그래프 개형 추론이나 경우 나누기가 필요하다. 공식 한 번 대입으로 풀리면 안 된다.",
        kor: "수능 고난도(예상 정답률 30~50%). <보기> 적용이나 개념 간 비교·추론이 필요하고, 선지 차이가 미세하다.",
        eng: "수능 빈칸·순서·삽입 고난도(예상 정답률 30~50%). 추상적 지문과 매력적 오답.",
        _: "수능 고난도(예상 정답률 30~50%). 여러 단계의 추론이 필요하다.",
      },
      중: { _: "수능 3점~쉬운 4점 수준(예상 정답률 50~75%). 한두 단계의 추론이 필요하다." },
      하: { _: "수능 2~3점 수준(예상 정답률 75~90%). 핵심 개념을 바로 적용하면 풀린다." },
      최하: { _: "기본 개념 확인 수준(예상 정답률 90% 이상). 개념 정의나 단순 계산·사실 확인." },
    };
    const lvDesc = (LV[level][subject] || LV[level]._) as string;
    const what = isSet && b.passage
      ? `아래 [지문]에 딸린 문항 ${perSet}개 (passage 칸은 빈 문자열로 두고, 지문은 다시 쓰지 않는다)`
      : isSet
      ? `지문 1개와 그 지문에 딸린 문항 ${perSet}개로 된 '지문 세트' 1개`
      : `서로 다른 단일 문항 ${count}개`;

    const system = [
      "너는 대한민국 수능·평가원 모의평가 출제 경험이 많은 출제위원이다.",
      "학원 선생님이 학생의 약점 유형을 보완하려고 새 문제를 요청한다.",
      "규칙:",
      "- 반드시 새로 창작한다. 기존 수능·모의고사·교재의 지문이나 문항을 옮기거나 살짝 바꾸지 않는다.",
      "- 수능/모의평가의 형식, 발문 말투, 선지 구성을 따른다. 객관식은 선지 5개.",
      "- 정답은 하나만 성립해야 하고, 오답 선지는 그럴듯하지만 명확히 틀려야 한다.",
      "- 수학은 머릿속으로 끝까지 풀어 정답을 검산하고(풀이 과정은 출력하지 않는다), 검산이 맞지 않으면 문제를 고친다. 모든 수식·변수·숫자식은 LaTeX로 $...$ 안에 쓴다 (예: $f(x)=x^3-3x^2+2$, $\\int_{0}^{2} f(x)\\,dx$, $\\lim_{x \\to 1} \\frac{f(x)}{x-1}$, $\\sqrt{3}$, $a_{n+1}=2a_n$). 선지·해설의 수식도 $...$로 쓴다.",
      "- 국어·영어 지문은 실제 시험 분량과 밀도에 맞춘다 (국어 독서 지문 1,800~2,300자, 영어 지문 150~200단어).",
      "- 해설은 2~3문장으로 짧게: 정답 근거와 가장 헷갈리는 오답 하나가 틀린 이유.",
      guideFor(subject, type),
      "- 최종본을 내기 전에 속으로 검토한다: 정답이 지문 근거로 유일하게 성립하는가, 각 오답이 지문과 명확히 어긋나는가, 난이도가 요청과 맞는가. 문제가 있으면 고친 최종본만 낸다.",
      "- 생각 과정·검토 메모·인사말을 글로 쓰지 말고 곧바로 도구를 호출한다. 결과는 반드시 save_items 도구를 호출해서 낸다. 도구를 쓸 수 없으면 같은 구조의 JSON 객체 {\"items\": [...]} 하나만 출력한다 (설명·코드블록 없이).",
    ].join("\n");

    const user_msg = [
      `과목: ${subjName}`,
      `유형: ${type || "(자유)"}`,
      `난이도: ${level} — ${lvDesc}`,
      level === "최상" ? "※ 난이도 '최상' = 킬러 문항이다. 반드시 지켜라. 일반 고난도나 쉬운 문제를 내면 요청 위반이다." : "",
      `만들 것: ${what}`,
      note ? `선생님 요청: ${note}` : "",
      avoid.length ? `이미 문제은행에 있는 소재 (같은 소재·제재·작품·상황을 다시 쓰지 말고 전혀 다른 것으로):\n- ${avoid.join("\n- ")}` : "",
      `다양성 번호 ${seed}: 이 번호를 참고해 흔하지 않은 제재를 골라라.`,
      b.passage ? `[지문]\n${String(b.passage).slice(0, 12000)}` : "",
      sample ? `참고 (학생이 틀린 문제. 이것을 베끼지 말고 같은 유형·개념을 묻는 새 문제를 만든다):\n${sample}` : "",
    ].filter(Boolean).join("\n");

    const call = async (sys: string, msg: string, max: number, tool: boolean) => {
      const rr = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: max, system: sys, ...(tool ? { tools: [TOOL], tool_choice: { type: "auto" } } : {}), messages: [{ role: "user", content: msg }] }),
      });
      const o = await rr.json();
      if (!rr.ok) throw new Error("AI 호출 실패: " + (o?.error?.message || rr.status));
      return o;
    };

    // 1단계: 지문만 쓰기 (지문 세트, step=passage)
    if (isSet && b.step === "passage") {
      const LEN: Record<string, string> = {
        kor: /문학|시|소설|수필|극/.test(type) ? "실제 수능 문학 지문 분량 (현대시·고전시가는 1~2편, 소설은 2,000~2,800자 발췌, 수필 1,500~2,000자)" : "실제 수능 독서 지문 분량 1,800~2,300자, 4~6문단",
        eng: "150~200단어",
      };
      const psys = [
        "너는 대한민국 수능 출제위원이다. 지금은 문항 없이 '지문'만 새로 창작한다.",
        "- 기존 수능·모의고사·교재 지문을 옮기거나 변형하지 않는다. 완전히 새로 쓴다.",
        `- 분량: ${LEN[subject] || "실제 시험 자료 분량"}. 분량을 반드시 채운다.`,
        `- 이 지문으로 '${type || "자유"}' 유형 문항 ${perSet}개(난이도 ${level})를 낼 수 있도록 개념·대비·인과·사례·조건을 충분히 담는다.`,
        subject === "kor" && !/문학|시|소설|수필|극/.test(type) ? "- 수능 독서 지문처럼 쓴다: 화제 제시 → 핵심 개념 정의 → 원리·과정의 단계적 설명 → 대비되는 관점이나 방식 비교 → 한계·의의. 구체적 조건·수치·예시를 넣어 정보 밀도를 높이고, 문단마다 출제 근거가 될 문장을 둔다. 필요하면 (가)(나) 두 글로 구성해도 된다." : "",
        subject === "kor" && /문학|시|소설|수필|극/.test(type) ? "- 문학적 완성도가 높은 창작 작품으로 쓴다. 시는 비유·상징·대비 구조가 분명하게, 소설은 인물 갈등·서술 시점·장면 전환이 드러나게 한다. 앞부분 줄거리가 필요하면 [앞부분 줄거리]를 붙인다." : "",
        "- 제목, 인사말, 설명 없이 지문 본문만 출력한다. 문단 사이는 빈 줄 하나.",
      ].filter(Boolean).join("\n");
      const pmsg = [`과목: ${subjName}`, `유형: ${type || "(자유)"}`, note ? `선생님 요청: ${note}` : "",
        avoid.length ? `이미 쓴 소재 (전혀 다른 소재로):\n- ${avoid.join("\n- ")}` : "", `다양성 번호 ${seed}: 흔하지 않은 제재를 골라라.`].filter(Boolean).join("\n");
      const o = await call(psys, pmsg, LONG ? 10000 : 6000, false);
      const passage = (o.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("").trim();
      if (!passage) return j({ error: `지문을 못 만들었어요 (stop: ${o.stop_reason || "?"})` }, 502);
      return j({ passage });
    }
    const given = isSet ? String(b.passage || "").slice(0, 12000) : "";

    // 3단계: 검토위원이 정답·선지를 다시 점검하고 고친다 (step=review)
    let reviewMsg = "";
    if (b.step === "review" && Array.isArray(b.items) && b.items.length) {
      const brief = b.items.slice(0, 5).map((it: any, i: number) => ({ no: i + 1, type: it.type, level: it.level,
        questions: (it.questions || []).map((q: any) => ({ text: String(q.text || "").slice(0, 2500), answer: q.answer, explain: q.explain })) }));
      reviewMsg = [
        "[검토 요청] 아래는 다른 출제위원이 만든 초안이다. 너는 수능 검토위원으로서 엄격하게 검토하고 고친 최종본을 save_items로 낸다.",
        "점검 항목: (1) 정답이 지문·조건으로 유일하게 성립하는가 (2) 오답 선지 각각이 명확한 근거로 틀렸는가, 정답 시비 여지는 없는가 (3) 발문·선지 문체가 수능과 같은가 (4) 요청 난이도(위 난이도 줄)에 맞는가 — 요청보다 쉬우면 조건을 추가하거나 문제를 새로 만들어 반드시 그 난이도로 올린다, 너무 쉬운 선지는 정교하게 바꾼다 (5) 수학은 직접 다시 풀어 정답을 확인한다 (6) 해설이 정확한가.",
        "문제가 없으면 그대로, 있으면 고쳐서 같은 개수로 낸다. 지문은 바꾸지 않는다(passage는 빈 문자열). 선지는 번호 기호 없이 choices 배열로, 정답은 번호(1~5)로.",
        given ? `[지문]\n${given}` : "",
        `[초안]\n${JSON.stringify(brief)}`,
      ].filter(Boolean).join("\n\n");
    }

    // 어려운 문제(특히 수학)는 검산을 '생각(thinking)' 칸에서 하게 해서, 답변 본문이 길어져 잘리는 것을 막는다
    const hard = level === "최상" || level === "상" || subject === "math";
    const ask = async (m: string, think: boolean) => {
      const rr = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: m,
          max_tokens: think ? (LONG ? 40000 : 16000) : (b.passage ? 10000 : (LONG ? 24000 : 14000)),
          ...(think ? { thinking: { type: "enabled", budget_tokens: LONG ? 24000 : 7000 } } : {}),
          system: system + (think ? "\n- 풀이·검산은 생각 과정에서만 하고, 생각이 끝나면 곧바로 save_items를 호출한다. 해설은 3~5줄로 핵심만." : ""),
          tools: [TOOL],
          tool_choice: { type: "auto" },
          messages: [{ role: "user", content: reviewMsg ? `${user_msg}\n\n${reviewMsg}` : user_msg }],
        }),
      });
      return { r: rr, o: await rr.json() };
    };
    let { r, o: out } = await ask(model, hard);
    if (r.ok && hard && out.stop_reason === "max_tokens") ({ r, o: out } = await ask(MODELS.std, true)); // 너무 길면 표준 모델로 한 번 더
    if (!r.ok && hard && /thinking/i.test(out?.error?.message || "")) ({ r, o: out } = await ask(model, false)); // thinking 미지원 모델이면 끄고 다시
    if (!r.ok) return j({ error: "AI 호출 실패: " + (out?.error?.message || r.status) }, 502);
    const tu = (out.content || []).find((c: { type: string }) => c.type === "tool_use");
    let raw: any = tu?.input?.items ?? tu?.input;
    if (!raw) {
      const txt = (out.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
      const a = txt.indexOf("{"), b = txt.lastIndexOf("}");
      if (a >= 0 && b > a) { try { raw = JSON.parse(txt.slice(a, b + 1)); } catch (_) { raw = []; } } else raw = [];
    }
    if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch (_) { raw = []; } }
    if (raw && !Array.isArray(raw)) raw = Array.isArray(raw.items) ? raw.items : (raw.questions ? [raw] : []);
    if (!raw.length) {
      const txt = (out.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join(" ").slice(0, 200);
      return j({ error: `AI가 결과를 못 냈어요 (stop: ${out.stop_reason || "?"}, model: ${out.model || model})${txt ? " — " + txt : ""}` }, 502);
    }

    const items = raw.map((it: any) => {
      const qs = (it.questions || []).map((q: any) => {
        const ch = (q.choices || []).filter(Boolean);
        const text = [q.stem, ...ch.map((c: string, i: number) => `${MARK[i] || i + 1 + "."} ${c}`)].join("\n");
        const n = parseInt(q.answer, 10);
        const answer = ch.length && n >= 1 && n <= ch.length ? MARK[n - 1] : String(q.answer || "");
        return { img: "", text, answer, explain: String(q.explain || "") };
      });
      return {
        subject, subname, type: type || it.type || "", level,
        source: `AI 생성 · ${new Date().toISOString().slice(0, 10)}`,
        kind: isSet ? "set" : "single", passage_img: "", passage_text: isSet ? (given || String(it.passage || "")) : "", questions: qs,
      };
    });
    // 단일 문항은 문제 하나씩 따로 저장되게 나눈다
    const flat = isSet ? items.slice(0, 1) : items.flatMap((it: any) => it.questions.map((q: any) => ({ ...it, questions: [q] })));
    return j({ items: flat, usage: out.usage || null });
  } catch (e) {
    return j({ error: String((e as Error)?.message || e) }, 500);
  }
});

// ================= 시험 정답 자동 가져오기 (action: "exam") =================
// 웹 검색으로 평가원·교육청·EBSi 정답표를 찾아 두 곳 이상 대조한 뒤 구조화해서 돌려준다.
const EXAM_TOOL = {
  name: "save_exam",
  description: "찾아서 대조한 시험 정답표를 저장한다",
  input_schema: {
    type: "object",
    properties: {
      found: { type: "boolean", description: "정답표를 찾았으면 true" },
      sections: { type: "object", description: "구역 id → 그 구역의 정답 배열(구역 첫 문항부터 순서대로, 예: 35~45번 구역이면 35번 정답이 첫 칸). 객관식은 1~5 숫자, 단답형은 정수. 확인 못 한 문항은 null", additionalProperties: { type: "array", items: { type: ["integer", "null"] } } },
      p3: { type: "object", description: "구역 id → 3점 문항 번호(시험 전체 기준 번호) 배열", additionalProperties: { type: "array", items: { type: "integer" } } },
      p4: { type: "object", description: "구역 id → 4점 문항 번호 배열 (수학만)", additionalProperties: { type: "array", items: { type: "integer" } } },
      sources: { type: "array", items: { type: "object", properties: { url: { type: "string" }, title: { type: "string" } }, required: ["url"] } },
      agree: { type: "boolean", description: "서로 다른 두 곳 이상의 출처에서 모든 정답이 일치했으면 true" },
      note: { type: "string", description: "불확실한 점, 출처끼리 달랐던 문항, 가답안 여부 등" },
    },
    required: ["found", "sections", "sources", "agree"],
  },
};

async function importExam(key: string, b: any) {
  const model = MODELS[String(b.quality)] || MODEL;
  const secs = (Array.isArray(b.sections) ? b.sections : []).slice(0, 6);
  const secDesc = secs.map((x: any) => `- 구역 id "${x.id}": ${x.name} — ${x.from}번~${x.to}번 (${x.to - x.from + 1}개)`).join("\n");
  const system = [
    "너는 한국 수능·모의고사 정답 데이터를 정리하는 꼼꼼한 조사원이다.",
    "웹 검색과 웹 페이지 읽기로 요청한 시험의 공식 정답표를 찾는다.",
    "우선순위: 한국교육과정평가원(suneung.re.kr, kice.re.kr), 시도교육청, EBSi의 정답·해설 PDF, 그다음 주요 언론사·입시업체 기사.",
    "규칙:",
    "- 모든 문항의 정답을 서로 다른 출처 두 곳 이상에서 대조한다. 일치하는 것만 쓴다.",
    "- 출처끼리 다르거나 확인하지 못한 문항은 추측하지 말고 null로 두고 note에 적는다.",
    "- 홀수형 기준. 배점(2점·3점·4점)도 정답표에서 확인한다.",
    "- 수능·모의평가는 '학년도'로 부른다: 2026년 11월 시행 수능 = 2027학년도 수능, 2026년 6월·9월 모의평가 = 2027학년도 6월·9월 모의평가.",
    "- 요청한 연도·월·학년·과목이 정확히 일치하는 시험만 쓴다. 다른 해 시험과 헷갈리지 않는다.",
    "- 다 찾으면 save_exam 도구를 한 번 호출해서 끝낸다. 생각 과정은 쓰지 않는다.",
  ].join("\n");
  const user = [
    `시험: ${b.label}`,
    `과목: ${b.subjectName}${b.subname ? " " + b.subname : ""}`,
    `구역 구성 (sections의 키로 이 id를 그대로 쓴다):\n${secDesc}`,
    b.shortNote ? `참고: ${b.shortNote}` : "",
  ].filter(Boolean).join("\n");

  const tools: any[] = [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }, { type: "web_fetch_20250910", name: "web_fetch", max_uses: 6 }, EXAM_TOOL];
  const call = async (messages: any[], useFetch: boolean) => {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json", ...(useFetch ? { "anthropic-beta": "web-fetch-2025-09-10" } : {}) },
      body: JSON.stringify({ model, max_tokens: 6000, system, tools: useFetch ? tools : tools.filter((t) => t.name !== "web_fetch"), messages }),
    });
    const o = await r.json();
    if (!r.ok) throw new Error(o?.error?.message || String(r.status));
    return o;
  };
  let useFetch = true;
  const messages: any[] = [{ role: "user", content: user }];
  for (let turn = 0; turn < 4; turn++) {
    let o: any;
    try { o = await call(messages, useFetch); }
    catch (e) {
      const m = String((e as Error).message || e);
      if (useFetch && /web_fetch|beta/i.test(m)) { useFetch = false; turn--; continue; }
      return { error: "AI 호출 실패: " + m };
    }
    const tu = (o.content || []).find((c: any) => c.type === "tool_use" && c.name === "save_exam");
    if (tu) return { exam: tu.input, usage: o.usage || null };
    if (o.stop_reason === "pause_turn") { messages.push({ role: "assistant", content: o.content }); continue; }
    const txt = (o.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join(" ").slice(0, 300);
    return { error: "정답표를 정리하지 못했어요" + (txt ? ": " + txt : "") };
  }
  return { error: "검색이 너무 길어져서 멈췄어요. 다시 시도해 주세요." };
}
