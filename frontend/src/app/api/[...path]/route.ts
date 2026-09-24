import { NextRequest, NextResponse } from 'next/server';
import https from 'https';
import http from 'http';

export const dynamic = 'force-dynamic';

function getBackendTarget(): { protocol: string; hostname: string; port: number; basePath: string } {
  if (process.env.NODE_ENV === 'development') {
    return { protocol: 'http:', hostname: 'localhost', port: 4000, basePath: '/api' };
  }
  return { protocol: 'https:', hostname: 'backendcrm.imprenta.in', port: 443, basePath: '/api' };
}

async function executeProxy(req: NextRequest, { params }: { params: { path: string[] } }) {
  return new Promise<NextResponse>(async (resolve) => {
    try {
      const pathSegments = params?.path || [];
      const subPath = pathSegments.join('/');
      const url = new URL(req.url);
      const search = url.search || '';
      
      const target = getBackendTarget();
      const requestPath = `${target.basePath}/${subPath}${search}`;

      // Build safe forward headers
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
        const arrayBuf = await req.arrayBuffer();
        if (arrayBuf && arrayBuf.byteLength > 0) {
          bodyBuffer = Buffer.from(arrayBuf);
          headers['Content-Length'] = String(bodyBuffer.length);
        }
      }

      const transport = target.protocol === 'https:' ? https : http;

      const proxyReq = transport.request(
        {
          hostname: target.hostname,
          port: target.port,
          path: requestPath,
          method: req.method,
          headers,
          rejectUnauthorized: false, // Prevents TLS certificate chain rejection on serverless
          timeout: 30000,
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
                return resolve(NextResponse.json(parsed, { status, headers: resHeaders }));
              } catch {
                return resolve(new NextResponse(fullBuffer, { status, headers: resHeaders }));
              }
            }

            return resolve(new NextResponse(fullBuffer, { status, headers: resHeaders }));
          });
        }
      );

      proxyReq.on('error', (err) => {
        console.error('[Native Proxy Error]', err);
        return resolve(
          NextResponse.json(
            { success: false, message: 'Backend connection error: ' + err.message },
            { status: 502 }
          )
        );
      });

      proxyReq.on('timeout', () => {
        proxyReq.destroy();
        return resolve(
          NextResponse.json(
            { success: false, message: 'Backend connection timed out' },
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
      return resolve(
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
