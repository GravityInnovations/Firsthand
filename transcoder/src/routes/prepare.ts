import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppError } from "../errors.js";
import type { PrepareReportExecutor } from "../application/prepare-report.js";
import { prepareFieldsSchema } from "../schemas.js";
import type { UploadedMedia } from "../types.js";

const VIDEO_TYPES = new Set(["video/webm", "video/mp4", "video/quicktime"]);
const AUDIO_TYPES = new Set(["audio/webm", "audio/ogg", "audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp4", "audio/x-m4a"]);

function baseMimeType(mimeType: string): string {
  return mimeType.toLowerCase().split(";", 1)[0]?.trim() || "application/octet-stream";
}

function validateMedia(fieldName: "audio" | "video", media: UploadedMedia): void {
  const allowed = fieldName === "audio" ? AUDIO_TYPES : VIDEO_TYPES;
  if (!allowed.has(baseMimeType(media.mimeType))) {
    throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", `${fieldName} has unsupported media type ${media.mimeType}.`);
  }
}

async function readMultipart(request: FastifyRequest): Promise<{
  description: string;
  metadata: Record<string, unknown>;
  language?: string;
  audio?: UploadedMedia;
  video?: UploadedMedia;
}> {
  if (!request.isMultipart()) {
    throw new AppError(415, "MULTIPART_REQUIRED", "Content-Type must be multipart/form-data.");
  }

  const fields: Record<string, string> = {};
  let audio: UploadedMedia | undefined;
  let video: UploadedMedia | undefined;

  for await (const part of request.parts()) {
    if (part.type === "field") {
      if (["description", "metadata", "language"].includes(part.fieldname)) {
        fields[part.fieldname] = String(part.value);
      }
      continue;
    }

    const normalizedField = part.fieldname === "recording" ? "video" : part.fieldname;
    if (normalizedField !== "audio" && normalizedField !== "video") {
      await part.toBuffer();
      throw new AppError(400, "UNSUPPORTED_FILE_FIELD", `Unsupported file field: ${part.fieldname}.`);
    }
    if ((normalizedField === "audio" && audio) || (normalizedField === "video" && video)) {
      await part.toBuffer();
      throw new AppError(400, "DUPLICATE_MEDIA_FIELD", `Only one ${normalizedField} file may be supplied.`);
    }

    const media: UploadedMedia = {
      buffer: await part.toBuffer(),
      fileName: part.filename || `${normalizedField}.bin`,
      mimeType: part.mimetype
    };
    validateMedia(normalizedField, media);
    if (normalizedField === "audio") audio = media;
    else video = media;
  }

  let metadata: unknown = {};
  if (fields.metadata) {
    try {
      metadata = JSON.parse(fields.metadata);
    } catch {
      throw new AppError(400, "INVALID_METADATA", "metadata must contain valid JSON.");
    }
  }

  const parsed = prepareFieldsSchema.safeParse({
    description: fields.description || "",
    metadata,
    ...(fields.language ? { language: fields.language } : {})
  });
  if (!parsed.success) {
    throw new AppError(400, "INVALID_REQUEST", "One or more request fields are invalid.", parsed.error.flatten());
  }

  const { language, ...requiredFields } = parsed.data;
  return {
    ...requiredFields,
    ...(language ? { language } : {}),
    ...(audio ? { audio } : {}),
    ...(video ? { video } : {})
  };
}

export async function registerPrepareRoute(app: FastifyInstance, service: PrepareReportExecutor): Promise<void> {
  app.post("/v1/prepare", async (request, reply) => {
    const input = await readMultipart(request);
    return reply.code(200).send(await service.execute(input));
  });
}
