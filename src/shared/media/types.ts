export interface SelectedVideoSource {
  id: string
  fileName: string
  mediaUrl: string
  sizeBytes: number
  modifiedAt: number
}

export interface SegmentSelection {
  inSeconds: number
  outSeconds: number
}
