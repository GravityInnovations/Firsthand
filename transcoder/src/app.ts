import { timingSafeEqual } from "node:crypto";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { PrepareReportService, type PrepareReportExecutor } from "./application/prepare-report.js";
import type { AppConfig } from "./config.js";
import { loadConfig } from "./config.js";
import { AppError } from "./errors.js";
import { FfmpegAudioProcessor } from "./media/audio-processor.js";
import { HeuristicReportTransformer } from "./providers/transformer/heuristic.js";
import { OpenAiReportTransformer } from "./providers/transformer/llm.js";
import type { ReportTransformer } from "./providers/transformer/types.js";
import { DisabledTranscriptionProvider } from "./providers/transcription/disabled.js";
import { TransformersWhisperTranscriptionProvider } from "./providers/transcription/transformers.js";
import type { TranscriptionProvider } from "./providers/transcription/types.js";
import { registerPrepareRoute } from "./routes/prepare.js";
export interface BuildAppOptions { config?: AppConfig; prepareService?: PrepareReportExecutor; logger?: boolean; }
function secure(value: string | undefined, expected: string) { if (!value?.startsWith("Bearer ")) return false; const got = Buffer.from(value.slice(7)), wanted = Buffer.from(expected); return got.length === wanted.length && timingSafeEqual(got, wanted); }
function transcription(config: AppConfig): TranscriptionProvider { return config.transcription.provider === "disabled" ? new DisabledTranscriptionProvider() : new TransformersWhisperTranscriptionProvider({ model: config.transcription.model, cacheDir: config.transcription.cacheDir, chunkLengthSeconds: config.transcription.chunkLengthSeconds }); }
function transformer(config: AppConfig): ReportTransformer { return config.transformer.provider === "heuristic" ? new HeuristicReportTransformer() : new OpenAiReportTransformer({ apiKey: config.transformer.apiKey!, model: config.transformer.model || "gpt-5.6-luna", baseUrl: config.transformer.baseUrl, ...(config.transformer.instructions ? { instructions: config.transformer.instructions } : {}) }); }
export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> { const config = options.config || loadConfig(), app = Fastify({ logger: options.logger ?? false }); await app.register(cors, { origin: config.corsOrigins.includes("*") ? "*" : config.corsOrigins }); await app.register(multipart, { limits: { files: 2, fields: 10, parts: 12, fileSize: config.maxMediaBytes } }); if (config.apiAuthToken) app.addHook("onRequest", async (request) => { if (request.url !== "/health" && !secure(request.headers.authorization, config.apiAuthToken!)) throw new AppError(401, "UNAUTHORIZED", "A valid bearer token is required."); }); app.get("/health", async () => ({ status: "ok" })); await registerPrepareRoute(app, options.prepareService || new PrepareReportService(new FfmpegAudioProcessor(), transcription(config), transformer(config), { defaultLanguage: config.transcription.language })); app.setErrorHandler((error, request, reply) => { if (error instanceof AppError) return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) }, requestId: request.id }); if (error instanceof ZodError) return reply.code(400).send({ error: { code: "INVALID_REQUEST", message: "The request is invalid.", details: error.flatten() }, requestId: request.id }); if (typeof error === "object" && error !== null && "code" in error && error.code === "FST_REQ_FILE_TOO_LARGE") return reply.code(413).send({ error: { code: "MEDIA_TOO_LARGE", message: `A media file exceeds the ${config.maxMediaBytes} byte limit.` }, requestId: request.id }); request.log.error(error); return reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: "The report could not be prepared." }, requestId: request.id }); }); return app; }
