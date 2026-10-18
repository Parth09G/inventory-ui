import createClient, { type Middleware } from 'openapi-fetch'
import { accessToken } from '@/lib/auth/supabase'
import { env } from '@/lib/env'
import { ApiProblem } from './problem'
import type { paths } from './schema'

let onUnauthenticated: (url: string) => void = () => {}

/** The auth layer registers what to do when the API answers 401 (sign out, go to login). */
export function setUnauthenticatedHandler(fn: (url: string) => void) {
  onUnauthenticated = fn
}

const auth: Middleware = {
  async onRequest({ request }) {
    const token = await accessToken()
    if (token) request.headers.set('Authorization', `Bearer ${token}`)
    return request
  },
  onResponse({ response }) {
    if (response.status === 401) onUnauthenticated(response.url)
    return response
  },
}

export const api = createClient<paths>({ baseUrl: env.apiBaseUrl })
api.use(auth)

type Result<T> = { data?: T; error?: unknown; response: Response }

/** Unwraps an openapi-fetch call: returns data, or throws ApiProblem. */
export async function call<T>(request: Promise<Result<T>>): Promise<T> {
  return (await callWithResponse(request)).data
}

/** Like `call`, but also returns the Response (for ETag and other headers). */
export async function callWithResponse<T>(
  request: Promise<Result<T>>,
): Promise<{ data: T; response: Response }> {
  let result: Result<T>
  try {
    result = await request
  } catch (e) {
    if (e instanceof ApiProblem) throw e
    throw new ApiProblem(0, { title: 'Network error', status: 0 })
  }
  const { data, error, response } = result
  if (!response.ok || error !== undefined) {
    const body = (typeof error === 'object' && error !== null ? error : {}) as Record<
      string,
      unknown
    >
    throw new ApiProblem(
      response.status,
      { title: response.statusText, status: response.status, ...body },
      response.headers.get('X-Request-Id') ?? undefined,
    )
  }
  return { data: data as T, response }
}

/** The bill version ETag (e.g. "3"), sent back as If-Match. */
export function etag(response: Response): string {
  return response.headers.get('ETag') ?? ''
}
