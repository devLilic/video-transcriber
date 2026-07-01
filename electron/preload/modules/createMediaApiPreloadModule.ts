import type { PreloadModule } from '../../../src/shared/modules/contracts'
import { registerMediaApi } from './mediaApi'

export function createMediaApiPreloadModule(): PreloadModule {
  return {
    id: 'media-api',
    register() {
      registerMediaApi()
    },
  }
}
