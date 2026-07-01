import type { MainModule } from '../../../../src/shared/modules/contracts'
import { registerMediaModule } from './registerMediaModule'

export function createMediaMainModule(): MainModule {
  return {
    id: 'media',
    register(context) {
      registerMediaModule(context.getMainWindow)
    },
  }
}
