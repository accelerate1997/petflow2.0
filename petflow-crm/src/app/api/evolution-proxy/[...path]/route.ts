import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(req, params);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(req, params);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(req, params);
}

async function handleProxy(
  req: NextRequest,
  paramsPromise: Promise<{ path: string[] }>
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { path } = await paramsPromise;
    const pathStr = path.join("/");

    const targetUrl = req.headers.get("x-target-url");
    const apiKey = req.headers.get("x-api-key");

    if (!targetUrl) {
      return NextResponse.json({ error: "x-target-url header is required" }, { status: 400 });
    }

    const cleanBaseUrl = targetUrl.endsWith("/") ? targetUrl.slice(0, -1) : targetUrl;
    
    // Construct the target URL with query params
    const { search } = new URL(req.url);
    const url = `${cleanBaseUrl}/${pathStr}${search}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["apikey"] = apiKey;
    }

    const init: RequestInit = {
      method: req.method,
      headers,
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      const bodyText = await req.text();
      if (bodyText) {
        init.body = bodyText;
      }
    }

    const response = await fetch(url, init);
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    } else {
      const text = await response.text();
      return new NextResponse(text, {
        status: response.status,
        headers: {
          "Content-Type": contentType || "text/plain",
        },
      });
    }
  } catch (error: any) {
    console.error("Evolution API proxy error:", error);
    return NextResponse.json({ error: error.message || "Proxy error" }, { status: 500 });
  }
}
