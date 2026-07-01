import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { protocol } from 'electron'
import { mediaSourceRegistry, type MediaSourceRegistry } from './MediaSourceRegistry'

const MEDIA_SCHEME = 'media'
const MEDIA_HOST = 'local'

export function registerMediaProtocolScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        stream: true,
        supportFetchAPI: true,
      },
    },
  ])
}

export function registerMediaProtocolHandler(registry: MediaSourceRegistry = mediaSourceRegistry) {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    const videoId = parseMediaVideoId(request.url)

    if (!videoId || !registry.has(videoId)) {
      return notFoundResponse()
    }

    const filePath = registry.get(videoId)

    if (!filePath) {
      return notFoundResponse()
    }

    try {
      return await createMediaFileResponse(filePath, request)
    } catch {
      return notFoundResponse()
    }
  })
}

function parseMediaVideoId(rawUrl: string) {
  try {
    const url = new URL(rawUrl)

    if (url.protocol !== `${MEDIA_SCHEME}:` || url.hostname !== MEDIA_HOST) {
      return null
    }

    const pathParts = url.pathname.split('/').filter(Boolean)

    if (pathParts.length !== 1) {
      return null
    }

    return decodeURIComponent(pathParts[0])
  } catch {
    return null
  }
}

async function createMediaFileResponse(filePath: string, request: Request) {
  const fileStat = await stat(filePath)

  if (!fileStat.isFile()) {
    return notFoundResponse()
  }

  const range = parseRangeHeader(request.headers.get('range'), fileStat.size)
  const headers = createBaseMediaHeaders(filePath)

  if (!range) {
    headers.set('Content-Length', String(fileStat.size))

    return new Response(createResponseBody(filePath, request.method), {
      status: 200,
      headers,
    })
  }

  if (!range.satisfiable) {
    headers.set('Content-Range', `bytes */${fileStat.size}`)

    return new Response(null, {
      status: 416,
      headers,
    })
  }

  const { start, end } = range
  const contentLength = end - start + 1

  headers.set('Content-Length', String(contentLength))
  headers.set('Content-Range', `bytes ${start}-${end}/${fileStat.size}`)

  return new Response(createResponseBody(filePath, request.method, start, end), {
    status: 206,
    headers,
  })
}

function createBaseMediaHeaders(filePath: string) {
  return new Headers({
    'Accept-Ranges': 'bytes',
    'Content-Type': getVideoMimeType(filePath),
  })
}

function createResponseBody(filePath: string, method: string, start?: number, end?: number) {
  if (method === 'HEAD') {
    return null
  }

  const stream = createReadStream(filePath, { start, end })
  return Readable.toWeb(stream) as unknown as BodyInit
}

function parseRangeHeader(rangeHeader: string | null, fileSize: number) {
  if (!rangeHeader) {
    return null
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader)

  if (!match) {
    return { satisfiable: false as const }
  }

  const [, rawStart, rawEnd] = match
  let start = rawStart ? Number(rawStart) : 0
  let end = rawEnd ? Number(rawEnd) : fileSize - 1

  if (!rawStart && rawEnd) {
    const suffixLength = Number(rawEnd)
    start = Math.max(fileSize - suffixLength, 0)
    end = fileSize - 1
  }

  if (
    !Number.isSafeInteger(start)
    || !Number.isSafeInteger(end)
    || start < 0
    || end < start
    || start >= fileSize
  ) {
    return { satisfiable: false as const }
  }

  return {
    satisfiable: true as const,
    start,
    end: Math.min(end, fileSize - 1),
  }
}

function getVideoMimeType(filePath: string) {
  switch (path.extname(filePath).toLowerCase()) {
    case '.mp4':
    case '.m4v':
      return 'video/mp4'
    case '.webm':
      return 'video/webm'
    case '.mov':
      return 'video/quicktime'
    case '.mkv':
      return 'video/x-matroska'
    case '.avi':
      return 'video/x-msvideo'
    default:
      return 'application/octet-stream'
  }
}

function notFoundResponse() {
  return new Response(null, { status: 404 })
}
