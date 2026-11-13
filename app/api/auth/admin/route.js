import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedPassword) {
    return NextResponse.json({ error: "Admin sign-in is not configured. Set ADMIN_PASSWORD." }, { status: 503 });
  }
  if (typeof body?.password !== "string" || body.password !== expectedPassword) {
    return NextResponse.json({ error: "Incorrect admin password." }, { status: 401 });
  }

  const response = NextResponse.json({ role: "admin" });
  response.cookies.set(
    SESSION_COOKIE,
    createSessionToken({ sub: "admin", role: "admin" }),
    sessionCookieOptions(),
  );
  return response;
}
