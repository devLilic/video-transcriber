import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { LocalTranscriptSegment, LocalTranscriptionResult } from '../../../../src/shared/local-transcription/types'
import type { SegmentSelection } from '../../../../src/shared/media/types'
import type { ProjectStoreData, StoredLocalTranscription, VideoProject } from '../../../../src/shared/projects/types'
import {
  resetStoredTranscriptSegmentText,
  updateStoredTranscriptSegmentText,
} from './updateStoredTranscript'

const STORE_FILE_NAME = 'video-transcriber-projects.json'

export class ProjectStore {
  private readonly filePath: string

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, STORE_FILE_NAME)
  }

  async load(videoId: string): Promise<VideoProject | null> {
    const data = await this.readData()
    return data.projects[videoId] ?? null
  }

  async saveSelection(videoId: string, selection: SegmentSelection): Promise<VideoProject> {
    assertValidSelection(selection)

    const data = await this.readData()
    const previousProject = data.projects[videoId]
    const project: VideoProject = {
      selection,
      transcription: previousProject?.transcription,
      updatedAt: new Date().toISOString(),
    }

    data.projects[videoId] = project
    await this.writeData(data)

    return project
  }

  async saveTranscription(videoId: string, transcription: LocalTranscriptionResult): Promise<VideoProject> {
    assertValidTranscriptionResult(transcription)

    const sourceSelection = {
      inSeconds: transcription.sourceInSeconds,
      outSeconds: transcription.sourceOutSeconds,
    }
    assertValidSelection(sourceSelection)

    const data = await this.readData()
    const previousProject = data.projects[videoId]
    const project: VideoProject = {
      selection: previousProject?.selection ?? sourceSelection,
      transcription: {
        engine: transcription.engine,
        model: transcription.model,
        language: transcription.language,
        sourceSelection,
        fullText: transcription.fullText,
        segments: transcription.segments,
        createdAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    }

    data.projects[videoId] = project
    await this.writeData(data)

    return project
  }

  async updateTranscriptSegmentText(
    videoId: string,
    transcriptionCreatedAt: string,
    segmentId: string,
    text: string,
  ): Promise<{ segment: LocalTranscriptSegment; fullText: string }> {
    const data = await this.readData()
    const result = updateStoredTranscriptSegmentText(data.projects[videoId] ?? null, {
      transcriptionCreatedAt,
      segmentId,
      text,
      editedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    data.projects[videoId] = result.project
    await this.writeData(data)

    return {
      segment: result.segment,
      fullText: result.fullText,
    }
  }

  async resetTranscriptSegmentText(
    videoId: string,
    transcriptionCreatedAt: string,
    segmentId: string,
  ): Promise<{ segment: LocalTranscriptSegment; fullText: string }> {
    const data = await this.readData()
    const result = resetStoredTranscriptSegmentText(data.projects[videoId] ?? null, {
      transcriptionCreatedAt,
      segmentId,
      updatedAt: new Date().toISOString(),
    })

    data.projects[videoId] = result.project
    await this.writeData(data)

    return {
      segment: result.segment,
      fullText: result.fullText,
    }
  }

  async readData(): Promise<ProjectStoreData> {
    try {
      return parseProjectStoreData(await readFile(this.filePath, 'utf8'))
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return createEmptyProjectStoreData()
      }

      throw error
    }
  }

  async writeData(data: ProjectStoreData) {
    await mkdir(path.dirname(this.filePath), { recursive: true })

    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`
    await writeFile(tempPath, serializeProjectStoreData(data), 'utf8')
    await rename(tempPath, this.filePath)
  }
}

export function createEmptyProjectStoreData(): ProjectStoreData {
  return {
    version: 1,
    projects: {},
  }
}

export function serializeProjectStoreData(data: ProjectStoreData) {
  return `${JSON.stringify(data, null, 2)}\n`
}

export function parseProjectStoreData(raw: string): ProjectStoreData {
  const parsed = JSON.parse(raw) as unknown

  if (!isObjectRecord(parsed) || parsed.version !== 1 || !isObjectRecord(parsed.projects)) {
    return createEmptyProjectStoreData()
  }

  const data = createEmptyProjectStoreData()

  for (const [videoId, value] of Object.entries(parsed.projects)) {
    const project = parseVideoProject(value)

    if (project) {
      data.projects[videoId] = project
    }
  }

  return data
}

function assertValidSelection(selection: SegmentSelection) {
  if (
    !Number.isFinite(selection.inSeconds)
    || !Number.isFinite(selection.outSeconds)
    || selection.inSeconds < 0
    || selection.inSeconds >= selection.outSeconds
  ) {
    throw new Error('Invalid segment selection.')
  }
}

function assertValidTranscriptionResult(transcription: LocalTranscriptionResult) {
  if (
    transcription.engine !== 'whisper.cpp'
    || transcription.model !== 'small-q5_1'
    || transcription.language !== 'ro'
    || typeof transcription.fullText !== 'string'
    || !Array.isArray(transcription.segments)
    || !transcription.segments.every(isValidTranscriptSegment)
  ) {
    throw new Error('Invalid local transcription.')
  }
}

function parseVideoProject(value: unknown): VideoProject | null {
  if (!isObjectRecord(value) || !isSegmentSelection(value.selection) || typeof value.updatedAt !== 'string') {
    return null
  }

  const project: VideoProject = {
    selection: value.selection,
    updatedAt: value.updatedAt,
  }

  const transcription = parseStoredLocalTranscription(value.transcription)

  if (transcription) {
    project.transcription = transcription
  }

  return project
}

function parseStoredLocalTranscription(value: unknown): StoredLocalTranscription | null {
  if (
    !isObjectRecord(value)
    || value.engine !== 'whisper.cpp'
    || value.model !== 'small-q5_1'
    || value.language !== 'ro'
    || !isSegmentSelection(value.sourceSelection)
    || typeof value.fullText !== 'string'
    || typeof value.createdAt !== 'string'
    || !Array.isArray(value.segments)
    || !value.segments.every(isValidTranscriptSegment)
  ) {
    return null
  }

  return {
    engine: value.engine,
    model: value.model,
    language: value.language,
    sourceSelection: value.sourceSelection,
    fullText: value.fullText,
    segments: value.segments,
    createdAt: value.createdAt,
  }
}

function isSegmentSelection(value: unknown): value is SegmentSelection {
  if (!isObjectRecord(value)) {
    return false
  }

  const { inSeconds, outSeconds } = value

  return isObjectRecord(value)
    && typeof inSeconds === 'number'
    && typeof outSeconds === 'number'
    && Number.isFinite(inSeconds)
    && Number.isFinite(outSeconds)
    && inSeconds >= 0
    && inSeconds < outSeconds
}

function isValidTranscriptSegment(value: unknown): value is LocalTranscriptSegment {
  if (!isObjectRecord(value)) {
    return false
  }

  const {
    relativeStartSeconds,
    relativeEndSeconds,
    absoluteStartSeconds,
    absoluteEndSeconds,
  } = value

  return typeof relativeStartSeconds === 'number'
    && typeof relativeEndSeconds === 'number'
    && typeof absoluteStartSeconds === 'number'
    && typeof absoluteEndSeconds === 'number'
    && typeof value.id === 'string'
    && Number.isFinite(relativeStartSeconds)
    && Number.isFinite(relativeEndSeconds)
    && Number.isFinite(absoluteStartSeconds)
    && Number.isFinite(absoluteEndSeconds)
    && relativeStartSeconds >= 0
    && relativeStartSeconds <= relativeEndSeconds
    && absoluteStartSeconds >= 0
    && absoluteStartSeconds <= absoluteEndSeconds
    && typeof value.originalText === 'string'
    && typeof value.text === 'string'
    && typeof value.isEdited === 'boolean'
    && (value.editedAt === null || typeof value.editedAt === 'string')
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}
