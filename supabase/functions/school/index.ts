// hit100 · 학교 검색 + 대학 메일 인증 (Supabase Edge Function: school)
// 비밀값(Edge Functions → Secrets):
//   BREVO_API_KEY  — Brevo(무료 메일 발송) API 키
//   MAIL_FROM      — Brevo에서 인증한 보내는 사람 메일 주소
//   NEIS_KEY       — (선택) 나이스 교육정보 개방 포털 인증키. 없으면 검색 결과가 5개로 제한됨
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const env = (k: string) => Deno.env.get(k) || "";

function serviceKey() {
  const legacy = env("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try { const o = JSON.parse(env("SUPABASE_SECRET_KEYS") || "{}"); return Object.values(o)[0] as string || ""; } catch (_) { return ""; }
}
async function sha(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const UNIV_MAIL = /^[^\s@]+@([a-z0-9-]+\.)*[a-z0-9-]+\.(ac\.kr|edu)$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = env("SUPABASE_URL");
    const userDb = createClient(url, env("SUPABASE_ANON_KEY") || req.headers.get("apikey") || "", {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: { user } } = await userDb.auth.getUser();
    if (!user) return j({ error: "로그인이 필요해요." }, 401);
    const b = await req.json();

    // ---- 학교 검색 (나이스) ----
    if (b.action === "search") {
      const q = String(b.q || "").trim();
      if (q.length < 2) return j({ schools: [] });
      const kind = b.kind === "middle" ? "중학교" : "고등학교";
      const p = new URLSearchParams({ Type: "json", pIndex: "1", pSize: "30", SCHUL_NM: q, SCHUL_KND_SC_NM: kind });
      if (env("NEIS_KEY")) p.set("KEY", env("NEIS_KEY"));
      const r = await fetch("https://open.neis.go.kr/hub/schoolInfo?" + p.toString());
      const o = await r.json().catch(() => ({}));
      const rows = (o.schoolInfo?.[1]?.row || []) as any[];
      return j({ schools: rows.map((x) => ({ code: x.SD_SCHUL_CODE, name: x.SCHUL_NM, region: x.LCTN_SC_NM || x.ATPT_OFCDC_SC_NM || "", addr: x.ORG_RDNMA || "" })), limited: !env("NEIS_KEY") });
    }

    const admin = createClient(url, serviceKey());
    const aid = String(b.academy_id || "");
    const { data: mem } = await admin.from("members").select("user_id").eq("user_id", user.id).eq("academy_id", aid).maybeSingle();
    if (!mem) return j({ error: "학원 멤버가 아니에요." }, 403);

    // ---- 대학 메일로 인증번호 보내기 ----
    if (b.action === "send") {
      const email = String(b.email || "").trim().toLowerCase();
      const school = String(b.school_name || "").trim().slice(0, 60);
      if (!UNIV_MAIL.test(email)) return j({ error: "학교 메일(@○○.ac.kr 또는 .edu) 주소를 입력하세요." }, 400);
      if (school.length < 2) return j({ error: "대학교 이름을 입력하세요." }, 400);
      if (!env("BREVO_API_KEY") || !env("MAIL_FROM")) return j({ error: "메일 발송이 아직 설정되지 않았어요 (BREVO_API_KEY, MAIL_FROM)." }, 500);
      const { data: prev } = await admin.from("email_otps").select("created_at").eq("user_id", user.id).eq("academy_id", aid).maybeSingle();
      if (prev && Date.now() - new Date(prev.created_at).getTime() < 60_000) return j({ error: "1분 뒤에 다시 보낼 수 있어요." }, 429);
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
      await admin.from("email_otps").upsert({
        user_id: user.id, academy_id: aid, email, school_name: school, code_hash: await sha(user.id + ":" + code),
        attempts: 0, expires_at: new Date(Date.now() + 10 * 60_000).toISOString(), created_at: new Date().toISOString(),
      });
      const r = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": env("BREVO_API_KEY"), "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sender: { name: "hit100", email: env("MAIL_FROM") },
          to: [{ email }],
          subject: `[hit100] 학교 인증번호 ${code}`,
          htmlContent: `<div style="font-family:sans-serif;font-size:15px;line-height:1.6"><p>hit100 학교 인증번호입니다.</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>10분 안에 앱에 입력하세요. 본인이 요청하지 않았다면 이 메일을 무시하세요.</p></div>`,
        }),
      });
      if (!r.ok) { const t = await r.text(); return j({ error: "메일 발송 실패: " + t.slice(0, 200) }, 502); }
      return j({ ok: true });
    }

    // ---- 인증번호 확인 ----
    if (b.action === "verify") {
      const code = String(b.code || "").replace(/\D/g, "");
      const { data: otp } = await admin.from("email_otps").select("*").eq("user_id", user.id).eq("academy_id", aid).maybeSingle();
      if (!otp) return j({ error: "인증번호를 먼저 받으세요." }, 400);
      if (new Date(otp.expires_at).getTime() < Date.now()) return j({ error: "인증번호가 만료됐어요. 다시 받으세요." }, 400);
      if (otp.attempts >= 5) return j({ error: "5번 틀렸어요. 인증번호를 다시 받으세요." }, 429);
      if ((await sha(user.id + ":" + code)) !== otp.code_hash) {
        await admin.from("email_otps").update({ attempts: otp.attempts + 1 }).eq("user_id", user.id).eq("academy_id", aid);
        return j({ error: `인증번호가 달라요 (${otp.attempts + 1}/5).` }, 400);
      }
      const domain = otp.email.split("@")[1];
      const { data: m, error } = await admin.from("members").update({
        school_kind: "univ", school_name: otp.school_name, school_code: domain, school_status: "verified",
        school_email: otp.email, school_verified_at: new Date().toISOString(),
      }).eq("user_id", user.id).eq("academy_id", aid).select().single();
      if (error) return j({ error: error.message }, 500);
      await admin.from("email_otps").delete().eq("user_id", user.id).eq("academy_id", aid);
      return j({ ok: true, member: m });
    }

    return j({ error: "알 수 없는 요청이에요." }, 400);
  } catch (e) {
    return j({ error: String((e as Error)?.message || e) }, 500);
  }
});
