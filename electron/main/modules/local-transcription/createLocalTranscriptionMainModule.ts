import type { MainModule } from '../../../../src/shared/modules/contracts'
import { registerLocalTranscriptionModule } from './registerLocalTranscriptionModule'

export function createLocalTranscriptionMainModule(): MainModule {
  return {
    id: 'local-transcription',
    register(context) {
      registerLocalTranscriptionModule(context.getMainWindow)
    },
  }
}
