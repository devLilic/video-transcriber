import type { MainModule } from '../../../../src/shared/modules/contracts'
import { registerProjectModule } from './registerProjectModule'

export function createProjectMainModule(): MainModule {
  return {
    id: 'projects',
    register() {
      registerProjectModule()
    },
  }
}
