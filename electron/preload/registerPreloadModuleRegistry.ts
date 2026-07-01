import type { AppConfig } from '../../config/types'
import { registerPreloadModules } from '../../src/shared/modules/registry'
import { createAppApiPreloadModule } from './modules/createAppApiPreloadModule'
import { createDatabaseApiPreloadModule } from './modules/createDatabaseApiPreloadModule'
import { createI18nApiPreloadModule } from './modules/createI18nApiPreloadModule'
import { createLicensingApiPreloadModule } from './modules/createLicensingApiPreloadModule'
import { createMediaApiPreloadModule } from './modules/createMediaApiPreloadModule'
import { createProjectApiPreloadModule } from './modules/createProjectApiPreloadModule'
import { createSettingsApiPreloadModule } from './modules/createSettingsApiPreloadModule'
import { createTranscriptionApiPreloadModule } from './modules/createTranscriptionApiPreloadModule'
import { createUpdateApiPreloadModule } from './modules/createUpdateApiPreloadModule'

export function registerPreloadModuleRegistry(config: AppConfig) {
  return registerPreloadModules(
    [
      createAppApiPreloadModule(),
      createUpdateApiPreloadModule(),
      createI18nApiPreloadModule(),
      createLicensingApiPreloadModule(),
      createDatabaseApiPreloadModule(),
      createSettingsApiPreloadModule(),
      createMediaApiPreloadModule(),
      createProjectApiPreloadModule(),
      createTranscriptionApiPreloadModule(),
    ],
    { config },
  )
}
