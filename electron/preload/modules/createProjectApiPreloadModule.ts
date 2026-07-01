import type { PreloadModule } from '../../../src/shared/modules/contracts'
import { registerProjectApi } from './projectApi'

export function createProjectApiPreloadModule(): PreloadModule {
  return {
    id: 'project-api',
    register() {
      registerProjectApi()
    },
  }
}
