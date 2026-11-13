import { NextResponse } from "next/server";
import { clearSessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ signedOut: true });
  response.cookies.set(SESSION_COOKIE, "", clearSessionCookieOptions());
  return response;
}
