import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkPassword, issueAdminSession } from "@/lib/adminAuth";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";
const schema = z.object({ password: z.string().min(1) });
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const isLocal = ip === "0.0.0.0" || ip === "127.0.0.1" || ip === "::1" || process.env.NODE_ENV !== "production";
  const rl = isLocal ? { success: true } : await rateLimit(`admin-login:${ip}`, 10, 600); // brute-force guard for production
  if (!rl.success) return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Password required." }, { status: 400 });

  let ok: boolean;
  try {
    ok = checkPassword(parsed.data.password);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Not configured." }, { status: 500 });
  }
  if (!ok) return NextResponse.json({ error: "Wrong password." }, { status: 401 });

  await issueAdminSession();
  return NextResponse.json({ ok: true });
}
