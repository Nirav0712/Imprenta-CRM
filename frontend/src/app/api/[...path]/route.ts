import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_BACKEND = process.env.NODE_ENV === 'development'
  ? 'http://localhost:4000/api'
  : 'https://backendcrm.imprenta.in/api';

const BACKEND_BASE = (process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || DEFAULT_BACKEND).replace(/\/+$/, '');

async function handleProxy(req: NextRequest, { params }: { params: { path: string[] } }) {
  try {
    const pathSegments = params?.path || [];
    const path = pathSegments.join('/');
    const url = new URL(req.url);
    const searchParams = url.search;
    const targetUrl = `${BACKEND_BASE}/${path}${searchParams}`;

    // Extract incoming headers to forward
    const forwardHeaders = new Headers();
    const disallowedHeaders = ['host', 'connection', 'content-length', 'transfer-encoding'];
    req.headers.forEach((value, key) => {
      if (!disallowedHeaders.includes(key.toLowerCase())) {
        forwardHeaders.set(key, value);
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
        forwardHeaders.set('content-type', 'application/json');
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
      // If local backend fails in dev, try live backend
      if (BACKEND_BASE.includes('localhost') || BACKEND_BASE.includes('127.0.0.1')) {
        const fallbackTarget = `https://backendcrm.imprenta.in/api/${path}${searchParams}`;
        backendRes = await fetch(fallbackTarget, {
          method: req.method,
          headers: forwardHeaders,
          body,
          cache: 'no-store',
        });
      } else {
        throw fetchErr;
      }
    }

    const resHeaders = new Headers();
    backendRes.headers.forEach((value, key) => {
      if (!['transfer-encoding', 'content-encoding'].includes(key.toLowerCase())) {
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
