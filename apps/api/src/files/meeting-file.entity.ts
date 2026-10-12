export type MeetingFileStatus = 'uploaded';

/** A file as the API exposes it: the storage key never leaves the server. */
export interface MeetingFile {
  id: string;
  meetingId: string;
  /** Name the client sent, without any path. */
  originalName: string;
  mimeType: string;
  /** Bytes written to disk. */
  size: number;
  status: MeetingFileStatus;
  /** ISO 8601 string. */
  uploadedAt: string;
}

export interface MeetingFilesList {
  items: MeetingFile[];
}

/** An upload already streamed to a temp file, waiting to be attached to a meeting. */
export interface PendingUpload {
  tempPath: string;
  originalName: string;
  mimeType: string;
  size: number;
}
