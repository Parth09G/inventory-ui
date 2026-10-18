import type { Page, Request } from '@playwright/test'
import type { paths } from '../../src/lib/api/schema'
import * as data from './data'

const API = 'http://api.mock/api/v1'
const SUPABASE = 'http://supabase.mock'

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete'
type JsonOf<R> = R extends { content: { 'application/json': infer J } } ? J : never
type SuccessBody<O> = O extends { responses: infer R }
  ? JsonOf<R[Extract<keyof R, 200 | 201 | 202>]>
  : never
type Path = keyof paths
export type Body<P extends Path, M extends Method> = SuccessBody<paths[P][M]>

/** A non-default reply: status, headers, or an error body. */
export class Reply {
  constructor(
    readonly status: number,
    readonly body?: unknown,
    readonly headers: Record<string, string> = {},
  ) {}
}

/** A file download reply (non-JSON body). */
export function file(contentType: string, content: string) {
  return new Reply(200, Buffer.from(content), { 'content-type': contentType })
}

/** RFC 9457 problem reply. */
export function problem(status: number, code: string, extra: Record<string, unknown> = {}) {
  return new Reply(
    status,
    { title: code, status, code, request_id: 'req-e2e', ...extra },
    {
      'content-type': 'application/problem+json',
    },
  )
}

export type Req = {
  method: string
  path: string
  params: Record<string, string>
  query: URLSearchParams
  body: any
  headers: Record<string, string>
}

type Handler<B> = (req: Req) => B | Reply | Promise<B | Reply>
type Route = { method: string; re: RegExp; keys: string[]; handler: Handler<unknown> }

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'access-control-expose-headers': 'ETag, X-Request-Id, Idempotent-Replay, Location',
}

export const PASSWORD = 'Passw0rd!x'

function fakeJwt(email: string): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const exp = Math.floor(Date.now() / 1000) + 3600
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: email, email, exp, aud: 'authenticated', role: 'authenticated' })}.sig`
}

export function session(user: { id: string; email: string }) {
  return {
    access_token: fakeJwt(user.email),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'refresh-e2e',
    user: {
      id: user.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: user.email,
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-04-01T00:00:00Z',
    },
  }
}

/**
 * In-browser mock of the Go API and Supabase Auth (D-32). Later `on()` calls override
 * earlier ones. Calls with no handler are recorded in `unhandled` and fail the test.
 */
export class MockApi {
  private routes: Route[] = []
  readonly requests: Req[] = []
  readonly unhandled: string[] = []
  me: typeof data.superAdmin = data.superAdmin
  /** Emails that can sign in, with the /me profile they get. */
  users = new Map([
    [data.superAdmin.email, data.superAdmin],
    [data.admin.email, data.admin],
  ])

  constructor(private page: Page) {
    this.defaults()
  }

  on<P extends Path, M extends Method>(
    method: M,
    path: P,
    handler: Handler<Body<P, M>> | Body<P, M> | Reply,
  ) {
    const keys: string[] = []
    const re = new RegExp(
      '^' + String(path).replace(/\{(\w+)\}/g, (_, k: string) => (keys.push(k), '([^/]+)')) + '$',
    )
    const h = (typeof handler === 'function' ? handler : () => handler) as Handler<unknown>
    this.routes.unshift({ method: method.toUpperCase(), re, keys, handler: h })
    return this
  }

  /** Requests made to a path (exact, without query), optionally filtered by method. */
  calls(method: string, path: string): Req[] {
    return this.requests.filter((r) => r.method === method.toUpperCase() && r.path === path)
  }

  private defaults() {
    this.on('get', '/me', () => this.me)
      .on('get', '/locations', data.locations)
      .on('get', '/units', data.units)
      .on('get', '/categories', [])
      .on('get', '/lookups/states', data.states)
      .on('get', '/notifications', { data: [], meta: { page: 1, page_size: 50, total: 0 } })
      .on('get', '/search', { items: [], parties: [], bills: [] })
  }

  async install() {
    await this.page.route(`${API}/**`, async (route) => {
      const req = route.request()
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
      const r = this.parse(req)
      this.requests.push(r)
      const match = this.routes.find((x) => x.method === r.method && x.re.test(r.path))
      if (!match) {
        this.unhandled.push(`${r.method} ${r.path}`)
        return route.fulfill({
          status: 501,
          headers: CORS,
          json: { title: 'Not mocked', status: 501, code: 'INTERNAL' },
        })
      }
      const m = r.path.match(match.re)!
      match.keys.forEach((k, i) => (r.params[k] = decodeURIComponent(m[i + 1]!)))
      const out = await match.handler(r)
      const reply = out instanceof Reply ? out : new Reply(r.method === 'POST' ? 201 : 200, out)
      await route.fulfill({
        status: reply.status,
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req-e2e',
          ...CORS,
          ...reply.headers,
        },
        body:
          reply.body === undefined
            ? ''
            : reply.body instanceof Buffer
              ? reply.body
              : JSON.stringify(reply.body),
      })
    })

    await this.page.route(`${SUPABASE}/auth/v1/**`, async (route) => {
      const req = route.request()
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
      const url = new URL(req.url())
      const path = url.pathname.replace('/auth/v1', '')
      const body = req.postDataJSON?.() ?? {}
      const json = (status: number, payload: unknown) =>
        route.fulfill({ status, headers: CORS, json: payload })
      if (path === '/token' && url.searchParams.get('grant_type') === 'password') {
        const user = this.users.get(body.email)
        if (!user || body.password !== PASSWORD)
          return json(400, {
            code: 400,
            error_code: 'invalid_credentials',
            msg: 'Invalid login credentials',
          })
        this.me = user
        return json(200, session(user))
      }
      if (path === '/token') return json(200, session(this.me))
      if (path === '/user') return json(200, session(this.me).user)
      if (path === '/logout') return route.fulfill({ status: 204, headers: CORS })
      if (path === '/recover') return json(200, {})
      return json(404, { msg: 'not mocked' })
    })
  }

  private parse(req: Request): Req {
    const url = new URL(req.url())
    let body: unknown
    try {
      body = req.postDataJSON()
    } catch {
      body = req.postData()
    }
    return {
      method: req.method(),
      path: url.pathname.replace('/api/v1', ''),
      params: {},
      query: url.searchParams,
      body,
      headers: req.headers(),
    }
  }
}
