// hit100 · AI 문항 생성 (Supabase Edge Function: gen-items)
// 필요한 비밀값: ANTHROPIC_API_KEY  (Edge Functions → Secrets 에 등록)
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = Deno.env.get("AI_MODEL") || "claude-sonnet-5-5";
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
        body: JSON.stringify({ model: MODEL, max_tokens: max, system: sys, ...(tool ? { tools: [TOOL], tool_choice: { type: "auto" } } : {}), messages: [{ role: "user", content: msg }] }),
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
        "- 제목, 인사말, 설명 없이 지문 본문만 출력한다. 문단 사이는 빈 줄 하나.",
      ].join("\n");
      const pmsg = [`과목: ${subjName}`, `유형: ${type || "(자유)"}`, note ? `선생님 요청: ${note}` : "",
        avoid.length ? `이미 쓴 소재 (전혀 다른 소재로):\n- ${avoid.join("\n- ")}` : "", `다양성 번호 ${seed}: 흔하지 않은 제재를 골라라.`].filter(Boolean).join("\n");
      const o = await call(psys, pmsg, 6000, false);
      const passage = (o.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("").trim();
      if (!passage) return j({ error: `지문을 못 만들었어요 (stop: ${o.stop_reason || "?"})` }, 502);
      return j({ passage });
    }
    const given = isSet ? String(b.passage || "").slice(0, 12000) : "";

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: b.passage ? 10000 : 14000,
        system,
        tools: [TOOL],
        tool_choice: { type: "auto" },
        messages: [{ role: "user", content: user_msg }],
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
      return j({ error: `AI가 결과를 못 냈어요 (stop: ${out.stop_reason || "?"}, model: ${out.model || MODEL})${txt ? " — " + txt : ""}` }, 502);
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
