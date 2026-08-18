import { randomUUID } from "node:crypto";
import { AppError } from "./errors.js";
import type { AppConfig } from "./config.js";
import type { PreparedReport, UploadedMedia } from "./types.js";
import { ReporterDatabase, type StoredComment } from "./database.js";
import { GitHubIssueClient } from "./github.js";
import { EvidenceStorage } from "./storage.js";
export class ReporterService {
  constructor(private config: AppConfig, private database: ReporterDatabase, private github: GitHubIssueClient, private storage: EvidenceStorage) {}
  async createIssue(clientId: string, userIdentifier: string, report: PreparedReport, metadata: Record<string, unknown>, video?: UploadedMedia) { const reportId = `rep_${randomUUID()}`, evidence = video ? await this.storage.store(video, metadata) : null, status = this.config.reporter.initialStatus, statusLabel = this.config.reporter.initialStatusLabel, issue = await this.github.createIssue(report, evidence?.video.locations[0]?.url, reportId, status, statusLabel), stored = { reportId, clientId, userIdentifier, owner: this.config.github.owner!, repository: this.config.github.repository!, issueNumber: issue.number, issueUrl: issue.html_url, title: issue.title, state: issue.state, workflowStatus: status, workflowStatusLabel: statusLabel, createdAt: issue.created_at, updatedAt: issue.updated_at }; this.database.createIssue(stored, report, evidence); return stored; }
  listIssues(clientId: string, user: string) { return this.database.listIssues(clientId, user); }
  private issue(clientId: string, user: string, reportId: string) { const issue = this.database.getIssue(clientId, reportId); if (!issue || issue.userIdentifier !== user) throw new AppError(404, "REPORT_NOT_FOUND", "No report was found for this user."); return issue; }
  async comments(clientId: string, user: string, reportId: string, refresh: boolean) { const issue = this.issue(clientId, user, reportId); if (refresh) this.database.upsertComments(reportId, await this.github.listComments(issue.issueNumber)); return this.database.listComments(reportId); }
  async createComment(clientId: string, user: string, reportId: string, body: string): Promise<StoredComment> { const issue = this.issue(clientId, user, reportId); if (!body.trim()) throw new AppError(400, "COMMENT_REQUIRED", "A comment body is required."); const comment = await this.github.createComment(issue.issueNumber, body.trim()); this.database.upsertComments(reportId, [comment]); return comment; }
}
