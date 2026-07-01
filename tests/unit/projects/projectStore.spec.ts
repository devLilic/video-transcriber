import { describe, expect, it } from 'vitest'
import {
  createEmptyProjectStoreData,
  parseProjectStoreData,
  serializeProjectStoreData,
} from '../../../electron/main/modules/projects/ProjectStore'

describe('ProjectStore serialization', () => {
  it('serializes store data as versioned pretty JSON', () => {
    const serialized = serializeProjectStoreData({
      version: 1,
      projects: {
        'video-id': {
          selection: {
            inSeconds: 10.5,
            outSeconds: 45.2,
          },
          updatedAt: '2026-07-01T00:00:00.000Z',
        },
      },
    })

    expect(serialized).toContain('"version": 1')
    expect(serialized).toContain('"video-id"')
    expect(serialized.endsWith('\n')).toBe(true)
  })

  it('parses valid data and rejects unsupported shapes as empty data', () => {
    const data = {
      version: 1 as const,
      projects: {
        abc: {
          selection: {
            inSeconds: 1,
            outSeconds: 2,
          },
          updatedAt: '2026-07-01T00:00:00.000Z',
        },
      },
    }

    expect(parseProjectStoreData(JSON.stringify(data))).toEqual(data)
    expect(parseProjectStoreData(JSON.stringify({ version: 2, projects: {} }))).toEqual(createEmptyProjectStoreData())
  })
})
