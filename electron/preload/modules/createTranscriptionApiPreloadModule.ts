import type { PreloadModule } from '../../../src/shared/modules/contracts'
import { registerTranscriptionApi } from './transcriptionApi'

export function createTranscriptionApiPreloadModule(): PreloadModule {
  return {
    id: 'transcription-api',
    register() {
      registerTranscriptionApi()
    },
  }
}
