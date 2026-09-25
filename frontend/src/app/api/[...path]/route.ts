import { NextRequest, NextResponse } from 'next/server';
import https from 'https';
import http from 'http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getBackendTarget(): { protocol: string; hostname: string; port: number; basePath: string } {
  const envTarget =
    process.env.BACKEND_INTERNAL_URL ||
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL;

  if (
    envTarget &&
    envTarget.startsWith('http') &&
    !envTarget.includes('hostingersite.com') &&
    !envTarget.includes('vercel.app') &&
    !envTarget.includes('crm.imprenta.in')
  ) {
    try {
      const parsed = new URL(envTarget);
      const protocol = parsed.protocol || 'https:';
      const hostname = parsed.hostname;
      const port = parsed.port ? parseInt(parsed.port, 10) : protocol === 'http:' ? 80 : 443;
      const basePath = parsed.pathname.replace(/\/$/, '') || '/api';
      return { protocol, hostname, port, basePath };
    } catch (e) {
      console.warn('[Proxy Target Parse Warning]', e);
    }
  }

  if (process.env.NODE_ENV === 'development') {
    return { protocol: 'http:', hostname: 'localhost', port: 4000, basePath: '/api' };
  }
  return { protocol: 'https:', hostname: 'backendcrm.imprenta.in', port: 443, basePath: '/api' };
}

async function executeProxy(req: NextRequest, { params }: { params: { path: string[] } }) {
  return new Promise<NextResponse>(async (resolve) => {
    let hasResolved = false;
    const safeResolve = (res: NextResponse) => {
      if (!hasResolved) {
        hasResolved = true;
        resolve(res);
      }
    };

    try {
      const pathSegments = params?.path || [];
      const subPath = pathSegments.join('/');
      const url = new URL(req.url);
      const search = url.search || '';

      const target = getBackendTarget();
      const requestPath = `${target.basePath}/${subPath}${search}`;

      // Build forward headers
      const headers: Record<string, string> = {
        'Host': target.hostname,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Imprenta-CRM-Proxy/1.0',
        'Accept': 'application/json, text/plain, */*',
        'Connection': 'close',
      };

      const allowedHeaderNames = [
        'authorization',
        'x-organization-id',
        'x-api-key',
        'content-type',
      ];

      allowedHeaderNames.forEach((name) => {
        const val = req.headers.get(name);
        if (val) {
          headers[name] = val;
        }
      });

      // Read request body if applicable
      let bodyBuffer: Buffer | null = null;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        try {
          const text = await req.text();
          if (text && text.length > 0) {
            bodyBuffer = Buffer.from(text, 'utf8');
            headers['Content-Length'] = String(bodyBuffer.length);
          }
        } catch (e: any) {
          console.warn('[Proxy Body Read Warning]', e);
        }
      }

      const transport = target.protocol === 'https:' ? https : http;

      // 6-second strict timeout to prevent long hanging connections
      const proxyReq = transport.request(
        {
          hostname: target.hostname,
          port: target.port,
          path: requestPath,
          method: req.method,
          headers,
          rejectUnauthorized: false,
          timeout: 6000,
        },
        (backendRes) => {
          const chunks: Buffer[] = [];
          backendRes.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          backendRes.on('end', () => {
            const fullBuffer = Buffer.concat(chunks);
            const resHeaders = new Headers();

            const contentType = backendRes.headers['content-type'] || 'application/json';
            resHeaders.set('Content-Type', Array.isArray(contentType) ? contentType[0] : contentType);

            const status = backendRes.statusCode || 200;

            if (contentType.includes('application/json')) {
              try {
                const parsed = JSON.parse(fullBuffer.toString('utf8'));
                return safeResolve(NextResponse.json(parsed, { status, headers: resHeaders }));
              } catch {
                return safeResolve(new NextResponse(fullBuffer, { status, headers: resHeaders }));
              }
            }

            return safeResolve(new NextResponse(fullBuffer, { status, headers: resHeaders }));
          });
        }
      );

      proxyReq.on('error', (err: any) => {
        console.error('[Native Proxy Error]', err?.message || err);
        return safeResolve(
          NextResponse.json(
            {
              success: false,
              message: `Backend service (${target.hostname}) is currently unreachable: ${err.message || 'Connection refused'}. Please check if the backend server is running.`,
            },
            { status: 502 }
          )
        );
      });

      proxyReq.on('timeout', () => {
        proxyReq.destroy();
        return safeResolve(
          NextResponse.json(
            {
              success: false,
              message: `Backend server (${target.hostname}) timed out. Please check that the backend service is active.`,
            },
            { status: 504 }
          )
        );
      });

      if (bodyBuffer) {
        proxyReq.write(bodyBuffer);
      }
      proxyReq.end();
    } catch (err: any) {
      console.error('[Proxy Handler Exception]', err);
      return safeResolve(
        NextResponse.json(
          { success: false, message: err.message || 'Internal proxy error' },
          { status: 500 }
        )
      );
    }
  });
}

export const GET = executeProxy;
export const POST = executeProxy;
export const PUT = executeProxy;
export const PATCH = executeProxy;
export const DELETE = executeProxy;
export const HEAD = executeProxy;
