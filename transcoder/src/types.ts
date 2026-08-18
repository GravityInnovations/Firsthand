export interface UploadedMedia {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

export interface Transcript {
  provider: string;
  language: string;
  text: string;
  confidence?: number;
}

export interface PrepareReportInput {
  description: string;
  metadata: Record<string, unknown>;
  language?: string;
  audio?: UploadedMedia;
  video?: UploadedMedia;
}

export interface PreparedReport {
  title: string;
  summary: string;
  stepsToReproduce: string[];
  expectedBehaviour: string;
  actualBehaviour: string;
  technicalContext: Record<string, unknown>;
  uncertainties: string[];
  developerNotes?: string | undefined;
  suggestedLabels: string[];
}

export interface PreparationWarning {
  code: string;
  message: string;
}

export interface PrepareReportResult {
  requestId: string;
  status: "completed";
  transcription: Transcript | null;
  report: PreparedReport;
  warnings: PreparationWarning[];
}
