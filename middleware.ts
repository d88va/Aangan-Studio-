import { NextRequest, NextResponse } from "next/server";

// Basic auth for the dashboard only. Username "aangan", password DASHBOARD_PASSWORD.
export function middleware(req: NextRequest) {
  const pw = process.env.DASHBOARD_PASSWORD;
  const auth = req.headers.get("authorization");
  if (pw && auth?.startsWith("Basic ")) {
    const [u, ...rest] = atob(auth.slice(6)).split(":");
    if (u === "aangan" && rest.join(":") === pw) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Aangan dashboard"' },
  });
}

export const config = { matcher: ["/"] };
