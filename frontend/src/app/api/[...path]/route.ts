import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getBackendBase(): string {
  const envUrl = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl.startsWith('http') && !envUrl.includes('crm.imprenta.in') && !envUrl.includes('vercel.app')) {
    return envUrl.replace(/\/+$/, '');
  }
  return process.env.NODE_ENV === 'development'
    ? 'http://localhost:4000/api'
    : 'https://backendcrm.imprenta.in/api';
}

const BACKEND_BASE = getBackendBase();

async function handleProxy(req: NextRequest, { params }: { params: { path: string[] } }) {
  try {
    const pathSegments = params?.path || [];
    const path = pathSegments.join('/');
    const url = new URL(req.url);
    const searchParams = url.search;
    const targetUrl = `${BACKEND_BASE}/${path}${searchParams}`;

    // Selectively forward only valid, clean application headers
    const forwardHeaders: Record<string, string> = {
      'User-Agent': 'Imprenta-CRM-Proxy/1.0',
    };

    const allowedHeaders = [
      'authorization',
      'x-organization-id',
      'x-api-key',
      'content-type',
      'accept',
    ];

    allowedHeaders.forEach((name) => {
      const val = req.headers.get(name);
      if (val) {
        forwardHeaders[name] = val;
      }
    });

    let body: BodyInit | undefined = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const text = await req.text();
        if (text) {
          body = text;
        }
        forwardHeaders['content-type'] = 'application/json';
      } else if (contentType.includes('multipart/form-data')) {
        body = await req.formData();
      } else {
        const text = await req.text();
        if (text) {
          body = text;
        }
      }
    }

    let backendRes: Response;
    try {
      backendRes = await fetch(targetUrl, {
        method: req.method,
        headers: forwardHeaders,
        body,
        cache: 'no-store',
      });
    } catch (fetchErr: any) {
      // Fallback: If connecting to localhost failed or primary had a blip, try live backend directly
      const liveTarget = `https://backendcrm.imprenta.in/api/${path}${searchParams}`;
      backendRes = await fetch(liveTarget, {
        method: req.method,
        headers: forwardHeaders,
        body,
        cache: 'no-store',
      });
    }

    const resHeaders = new Headers();
    backendRes.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!['transfer-encoding', 'content-encoding', 'connection', 'keep-alive'].includes(lowerKey)) {
        resHeaders.set(key, value);
      }
    });

    const resContentType = backendRes.headers.get('content-type') || '';
    if (resContentType.includes('application/json')) {
      const data = await backendRes.json().catch(() => ({}));
      return NextResponse.json(data, {
        status: backendRes.status,
        headers: resHeaders,
      });
    }

    const resBuffer = await backendRes.arrayBuffer();
    return new NextResponse(resBuffer, {
      status: backendRes.status,
      headers: resHeaders,
    });
  } catch (error: any) {
    console.error('[API Proxy Route Error]', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Error communicating with backend service',
      },
      { status: 500 }
    );
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
export const HEAD = handleProxy;
