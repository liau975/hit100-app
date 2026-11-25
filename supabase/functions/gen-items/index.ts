// hit100 · AI 문항 생성 (Supabase Edge Function: gen-items)
// 필요한 비밀값: ANTHROPIC_API_KEY  (Edge Functions → Secrets 에 등록)
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = Deno.env.get("AI_MODEL") || "claude-sonnet-5-5";
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
            level: { type: "string", enum: ["상", "중", "하"] },
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

    const subject = String(b.subject || "kor");
    const subname = String(b.subname || "").slice(0, 40);
    const type = String(b.type || "").slice(0, 60);
    const level = ["상", "중", "하"].includes(b.level) ? b.level : "중";
    const isSet = b.kind === "set";
    const count = Math.max(1, Math.min(isSet ? 1 : 5, Number(b.count) || 1));
    const perSet = Math.max(2, Math.min(5, Number(b.perSet) || 3));
    const note = String(b.note || "").slice(0, 500);
    const sample = String(b.sample || "").slice(0, 3000);
    const avoid = (Array.isArray(b.avoid) ? b.avoid : []).map((x: unknown) => String(x).replace(/\s+/g, " ").slice(0, 80)).filter(Boolean).slice(0, 30);
    const seed = Math.floor(Math.random() * 1e6);
    const model = MODELS[String(b.quality)] || MODEL;

    const subjName = SUBJ[subject] + (subname ? ` (${subname})` : "");
    const lvDesc = { 상: "정답률 50% 미만 수준의 고난도", 중: "정답률 50~80% 수준의 중간 난도", 하: "정답률 80% 이상 수준의 기본" }[level];
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
      "- 수학은 머릿속으로 끝까지 풀어 정답을 검산하고(풀이 과정은 출력하지 않는다), 검산이 맞지 않으면 문제를 고친다. 수식은 일반 텍스트로 알아보기 쉽게 쓴다 (예: x^2, √3, ∫_0^1 f(x)dx).",
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
      const o = await call(psys, pmsg, 6000, false);
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
        "점검 항목: (1) 정답이 지문·조건으로 유일하게 성립하는가 (2) 오답 선지 각각이 명확한 근거로 틀렸는가, 정답 시비 여지는 없는가 (3) 발문·선지 문체가 수능과 같은가 (4) 요청 난이도에 맞게 변별력이 있는가, 너무 쉬운 선지는 정교하게 바꾼다 (5) 수학은 직접 다시 풀어 정답을 확인한다 (6) 해설이 정확한가.",
        "문제가 없으면 그대로, 있으면 고쳐서 같은 개수로 낸다. 지문은 바꾸지 않는다(passage는 빈 문자열). 선지는 번호 기호 없이 choices 배열로, 정답은 번호(1~5)로.",
        given ? `[지문]\n${given}` : "",
        `[초안]\n${JSON.stringify(brief)}`,
      ].filter(Boolean).join("\n\n");
    }

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: b.passage ? 10000 : 14000,
        system,
        tools: [TOOL],
        tool_choice: { type: "auto" },
        messages: [{ role: "user", content: reviewMsg ? `${user_msg}\n\n${reviewMsg}` : user_msg }],
      }),
    });
    const out = await r.json();
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
        subject, subname, type: type || it.type || "", level: it.level || level,
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
