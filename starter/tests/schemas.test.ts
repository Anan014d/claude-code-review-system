import { describe, it, expect } from 'vitest';
import { ReviewReportSchema, ReviewReportJSONSchema } from '../src/types/report-types';
import {
  CodeQualityResultSchema,
  TestCoverageResultSchema,
  RefactoringSuggestionSchema,
} from '../src/types/analysis-results';

const base = {
  pullRequest: { owner: 'o', repo: 'r', number: 1 },
  fileReviews: [],
  summary: { totalFiles: 0, overallScore: 0, criticalIssues: 0, highPriorityTests: 0, refactoringOpportunities: 0 },
  recommendations: [],
  metadata: { analyzedAt: '2026-01-01T00:00:00Z', duration: 0, agentVersions: {} },
};

describe('Schema validation', () => {
  it('accepts a valid report', () => {
    expect(ReviewReportSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a report missing pullRequest', () => {
    const { pullRequest, ...rest } = base;
    expect(ReviewReportSchema.safeParse(rest).success).toBe(false);
  });

  it('accepts empty arrays', () => {
    expect(ReviewReportSchema.safeParse({ ...base, fileReviews: [], recommendations: [] }).success).toBe(true);
  });

  it('rejects an invalid recommendation priority', () => {
    const bad = { ...base, recommendations: [{ priority: 'urgent', category: 'x', description: 'y', files: [] }] };
    expect(ReviewReportSchema.safeParse(bad).success).toBe(false);
  });

  it('code quality score accepts 0 and 100, rejects 101', () => {
    const mk = (s: number) => ({ file: 'a.js', issues: [], overallScore: s, summary: 's' });
    expect(CodeQualityResultSchema.safeParse(mk(0)).success).toBe(true);
    expect(CodeQualityResultSchema.safeParse(mk(100)).success).toBe(true);
    expect(CodeQualityResultSchema.safeParse(mk(101)).success).toBe(false);
  });

  it('coverage estimate rejects negative values', () => {
    const r = { file: 'a.js', hasTests: false, testFiles: [], untestedPaths: [], coverageEstimate: -1, summary: 's' };
    expect(TestCoverageResultSchema.safeParse(r).success).toBe(false);
  });

  it('refactoring schema accepts empty suggestions', () => {
    expect(RefactoringSuggestionSchema.safeParse({ file: 'a.js', suggestions: [], summary: 's' }).success).toBe(true);
  });
});

describe('JSON schema export', () => {
  it('produces an object schema with the expected properties', () => {
    const s = ReviewReportJSONSchema as { type?: string; properties?: Record<string, unknown> };
    expect(s.type).toBe('object');
    expect(Object.keys(s.properties ?? {})).toEqual(
      expect.arrayContaining(['pullRequest', 'fileReviews', 'summary', 'recommendations', 'metadata'])
    );
  });
});
