import { NextRequest, NextResponse } from "next/server";

// Optional basic auth for the dashboard. Set DASHBOARD_PASSWORD to require login (username "aangan").
export function middleware(req: NextRequest) {
  const pw = process.env.DASHBOARD_PASSWORD;
  if (!pw) return NextResponse.next(); // no password configured: dashboard is open
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
