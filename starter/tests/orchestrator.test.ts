import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: (args: unknown) => queryMock(args),
}));

import { CodeReviewOrchestrator } from '../src/orchestrator';
import { ReviewReportSchema } from '../src/types/report-types';

const validReport = {
  pullRequest: { owner: 'o', repo: 'r', number: 1 },
  fileReviews: [],
  summary: {
    totalFiles: 0,
    overallScore: 80,
    criticalIssues: 0,
    highPriorityTests: 0,
    refactoringOpportunities: 0,
  },
  recommendations: [],
  metadata: { analyzedAt: new Date().toISOString(), duration: 1, agentVersions: {} },
};

function streamOf(messages: unknown[]) {
  return (async function* () {
    for (const m of messages) yield m;
  })();
}

describe('CodeReviewOrchestrator', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  describe('Configuration', () => {
    it('should initialize with default options', () => {
      const o = new CodeReviewOrchestrator();
      const cfg = o.getConfig();
      expect(cfg.mcpServers).toEqual(expect.arrayContaining(['github', 'eslint']));
      expect(cfg.agents).toHaveLength(3);
    });

    it('should accept custom rate limit configuration', () => {
      const o = new CodeReviewOrchestrator({
        rateLimit: { maxRequestsPerMinute: 5 },
      });
      const status = o.getRateLimiter().getStatus() as { availableRequests: number };
      expect(status.availableRequests).toBe(5);
    });
  });

  describe('reviewPullRequest', () => {
    it('should fetch PR files from GitHub MCP', async () => {
      queryMock.mockReturnValue(
        streamOf([{ type: 'result', subtype: 'success', structured_output: validReport }])
      );
      await new CodeReviewOrchestrator().reviewPullRequest('o', 'r', 1);
      const args = queryMock.mock.calls[0][0];
      expect(Object.keys(args.options.mcpServers)).toContain('github');
      expect(args.prompt).toContain('o/r');
    });

    it('should spawn all 3 subagents in parallel', async () => {
      queryMock.mockReturnValue(
        streamOf([{ type: 'result', subtype: 'success', structured_output: validReport }])
      );
      await new CodeReviewOrchestrator().reviewPullRequest('o', 'r', 1);
      const args = queryMock.mock.calls[0][0];
      expect(Object.keys(args.options.agents)).toHaveLength(3);
      expect(args.options.allowedTools).toContain('Task');
    });

    it('should aggregate results into ReviewReport', async () => {
      queryMock.mockReturnValue(
        streamOf([{ type: 'result', subtype: 'success', structured_output: validReport }])
      );
      const report = await new CodeReviewOrchestrator().reviewPullRequest('o', 'r', 1);
      expect(report.summary.overallScore).toBe(80);
      expect(report.metadata.duration).toBeGreaterThanOrEqual(0);
    });

    it('should validate output with Zod schema', async () => {
      queryMock.mockReturnValue(
        streamOf([{ type: 'result', subtype: 'success', structured_output: { bad: true } }])
      );
      await expect(
        new CodeReviewOrchestrator({ maxRetries: 1 }).reviewPullRequest('o', 'r', 1)
      ).rejects.toThrow();
    });

    it('throws a clear error when the SDK never produces a structured_output', async () => {
      queryMock.mockReturnValue(streamOf([]));
      await expect(
        new CodeReviewOrchestrator({ maxRetries: 1 }).reviewPullRequest('o', 'r', 1)
      ).rejects.toThrow();
    });
  });

  describe('Integration', () => {
    it.skip('should review a real small PR', async () => {
      // Run manually with valid API keys: npm run dev -- octocat Hello-World 1
    });
  });
});
