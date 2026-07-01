import type { AppConfig } from '../../../config/types'
import type {
  AppInfoPayload,
  DatabaseQueryPayload,
  DatabaseQueryResult,
  I18nLanguagePayload,
  I18nResourcePayload,
  I18nSupportedLanguagesPayload,
  LicensingActivationPayload,
  LicensingActivationResponse,
  LicensingConfirmRebindPayload,
  LicensingConfirmRebindResponse,
  LicensingDegradedModePayload,
  LicensingEntitlementsPayload,
  LicensingReauthorizationResponse,
  LicensingStatusPayload,
  ResetTranscriptSegmentTextRequest,
  ResetTranscriptSegmentTextResponse,
  StartLocalTranscriptionRequest,
  StartLocalTranscriptionResponse,
  TranscriptionErrorPayload,
  UpdateTranscriptSegmentTextRequest,
  UpdateTranscriptSegmentTextResponse,
} from '@/shared/ipc/contracts'
import type { LicenseEntitlementsResult } from '@/shared/licensing/contracts'
import type {
  LocalTranscriptionProgress,
  LocalTranscriptionResult,
  TranscriptBlocksAvailableEvent,
} from '@/shared/local-transcription/types'
import type { SegmentSelection, SelectedVideoSource } from '@/shared/media/types'
import type { VideoProject } from '@/shared/projects/types'
import type { UpdatePreferences, UiPreferences } from '@/shared/settings/types'
import type { ProgressInfo } from 'electron-updater'
import type { UpdateErrorPayload, UpdateStateEvent, VersionInfo } from './update'

declare global {
  interface Window {
    appApi: {
      getConfig: () => AppConfig
      getAppInfo: () => Promise<AppInfoPayload>
      onMainProcessMessage: (listener: (message: string) => void) => () => void
      openWindow: (route: string) => Promise<void>
    }
    updateApi: {
      checkForUpdates: () => Promise<unknown>
      downloadUpdate: () => Promise<void>
      quitAndInstall: () => Promise<void>
      onStateChange: (listener: (event: UpdateStateEvent) => void) => () => void
      onAvailabilityChanged: (listener: (payload: VersionInfo) => void) => () => void
      onError: (listener: (payload: UpdateErrorPayload) => void) => () => void
      onDownloadProgress: (listener: (payload: ProgressInfo) => void) => () => void
      onDownloaded: (listener: () => void) => () => void
    }
    i18nApi: {
      getCurrentLanguage: () => Promise<I18nLanguagePayload>
      getSupportedLanguages: () => Promise<I18nSupportedLanguagesPayload>
      getResources: (payload: { language: import('../../../config/types').AppLanguage; namespaces: string[] }) => Promise<I18nResourcePayload>
      setLanguage: (payload: I18nLanguagePayload) => Promise<I18nLanguagePayload>
    }
    licensingApi: {
      getStatus: () => Promise<LicensingStatusPayload>
      getDegradedModeState: () => Promise<LicensingDegradedModePayload>
      activateLicense: (payload: LicensingActivationPayload) => Promise<LicensingActivationResponse>
      requestReauthorization: () => Promise<LicensingReauthorizationResponse>
      confirmRebind: (payload: LicensingConfirmRebindPayload) => Promise<LicensingConfirmRebindResponse>
      getEntitlements: (payload: LicensingEntitlementsPayload) => Promise<LicenseEntitlementsResult>
    }
    databaseApi: {
      query: (payload: DatabaseQueryPayload) => Promise<DatabaseQueryResult>
    }
    settingsApi: {
      getLanguage: () => Promise<import('../../../config/types').AppLanguage | null>
      setLanguage: (language: import('../../../config/types').AppLanguage | null) => Promise<import('../../../config/types').AppLanguage | null>
      getUpdatePreferences: () => Promise<UpdatePreferences>
      setUpdatePreferences: (value: UpdatePreferences) => Promise<UpdatePreferences>
      getUiPreferences: () => Promise<UiPreferences>
      setUiPreferences: (value: UiPreferences) => Promise<UiPreferences>
    }
    mediaApi: {
      selectVideo: () => Promise<SelectedVideoSource | null>
    }
    projectApi: {
      load: (videoId: string) => Promise<VideoProject | null>
      saveSelection: (videoId: string, selection: SegmentSelection) => Promise<VideoProject>
      saveTranscription: (videoId: string, transcription: LocalTranscriptionResult) => Promise<VideoProject>
    }
    transcriptionApi: {
      start: (request: StartLocalTranscriptionRequest) => Promise<StartLocalTranscriptionResponse>
      cancel: (jobId: string) => Promise<void>
      updateSegmentText: (request: UpdateTranscriptSegmentTextRequest) => Promise<UpdateTranscriptSegmentTextResponse>
      resetSegmentText: (request: ResetTranscriptSegmentTextRequest) => Promise<ResetTranscriptSegmentTextResponse>
      onProgress: (listener: (payload: LocalTranscriptionProgress) => void) => () => void
      onBlocksAvailable: (listener: (payload: TranscriptBlocksAvailableEvent) => void) => () => void
      onCompleted: (listener: (payload: LocalTranscriptionResult) => void) => () => void
      onError: (listener: (payload: TranscriptionErrorPayload) => void) => () => void
      onCancelled: (listener: (payload: { jobId: string }) => void) => () => void
    }
  }
}

export {}
