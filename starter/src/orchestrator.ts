import type { RateLimiterConfig } from './utils/rate-limiter';
import { query } from '@anthropic-ai/claude-agent-sdk';
import {
  ReviewReport,
  ReviewReportSchema,
  ReviewReportJSONSchema,
} from './types/report-types';
import { mcpServersConfig } from './config/mcp.config';
import {
  codeQualityAnalyzer,
  testCoverageAnalyzer,
  refactoringSuggester,
} from './agents';
import { buildOrchestratorPrompt } from './prompts';
import {
  RateLimiter,
  withRetry,
  withTimeout,
  ReviewError,
  ErrorCodes,
} from './utils';

/**
 * Orchestrator configuration options
 */
export interface OrchestratorOptions {
  model?: string;
  rateLimit?: Partial<RateLimiterConfig>;
  timeoutMs?: number;
  maxRetries?: number;
}

/**
 * Main Code Review Orchestrator
 * Coordinates subagents to analyze pull requests and generate comprehensive reports
 */
export class CodeReviewOrchestrator {
  private readonly model?: string;
  private readonly rateLimiter: RateLimiter;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: OrchestratorOptions = {}) {
    this.model = options.model ?? process.env.ANTHROPIC_MODEL;
    this.rateLimiter = new RateLimiter(options.rateLimit);
    this.timeoutMs = options.timeoutMs ?? 10 * 60 * 1000;
    this.maxRetries = options.maxRetries ?? 2;
  }

  getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }

  getConfig() {
    return {
      model: this.model,
      timeoutMs: this.timeoutMs,
      maxRetries: this.maxRetries,
      mcpServers: Object.keys(mcpServersConfig),
      agents: [
        'code-quality-analyzer',
        'test-coverage-analyzer',
        'refactoring-suggester',
      ],
    };
  }

  /**
   * Review a pull request using parallel subagent analysis
   */
  async reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ReviewReport> {
    const startedAt = Date.now();

    const report = await withRetry(
      () => this.runReview(owner, repo, prNumber),
      this.maxRetries,
      2000
    );

    // Make sure metadata is always filled in
    report.metadata = {
      ...report.metadata,
      analyzedAt: report.metadata?.analyzedAt || new Date().toISOString(),
      duration: Date.now() - startedAt,
      agentVersions: report.metadata?.agentVersions ?? {
        'code-quality-analyzer': '1.0.0',
        'test-coverage-analyzer': '1.0.0',
        'refactoring-suggester': '1.0.0',
      },
    };

    return report;
  }

  private async runReview(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ReviewReport> {
    await this.rateLimiter.acquire(20000);
    try {
      return await withTimeout(
        () => this.execute(owner, repo, prNumber),
        this.timeoutMs,
        `Review of ${owner}/${repo}#${prNumber} timed out after ${this.timeoutMs}ms`
      );
    } finally {
      this.rateLimiter.release();
    }
  }

  private async execute(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ReviewReport> {
    const stream = query({
      prompt: buildOrchestratorPrompt(owner, repo, prNumber),
      options: {
        model: this.model,
        cwd: process.cwd(),
        mcpServers: mcpServersConfig,
        allowedTools: [
          'Task',
          'Read',
          'Grep',
          'Glob',
          'Skill',
          'mcp__github__*',
          'mcp__eslint__*',
        ],
        agents: {
          'code-quality-analyzer': codeQualityAnalyzer,
          'test-coverage-analyzer': testCoverageAnalyzer,
          'refactoring-suggester': refactoringSuggester,
        },
        settingSources: ['project'],
        outputFormat: {
          type: 'json_schema',
          schema: ReviewReportJSONSchema,
        },
      },
    });

    let structured: unknown;

    for await (const message of stream) {
      const msg = message as unknown as {
        type: string;
        subtype?: string;
        structured_output?: unknown;
        errors?: string[];
      };
      if (msg.type !== 'result') continue;

      if (msg.subtype === 'success') {
        structured = msg.structured_output;
      } else {
        throw new ReviewError(
          `Agent run failed: ${msg.subtype ?? 'unknown'} ${(msg.errors ?? []).join('; ')}`,
          ErrorCodes.AGENT_FAILED,
          { subtype: msg.subtype }
        );
      }
    }

    if (!structured) {
      throw new ReviewError(
        'The agent finished without producing a structured_output',
        ErrorCodes.STRUCTURED_OUTPUT_FAILED
      );
    }

    const parsed = ReviewReportSchema.safeParse(structured);
    if (!parsed.success) {
      throw new ReviewError(
        `Agent output did not match ReviewReport schema: ${parsed.error.message}`,
        ErrorCodes.VALIDATION_FAILED
      );
    }
    return parsed.data;
  }
}
