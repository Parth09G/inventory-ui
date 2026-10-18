import type { components } from '../../src/lib/api/schema'

/** Contract types: fixtures that drift from openapi.yaml fail to compile. */
export type S = components['schemas']
