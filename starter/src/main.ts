import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { CodeReviewOrchestrator } from './orchestrator';
import { ReportGenerator } from './utils/report-generator';
import { logger, logReviewStart } from './utils/logger';

// Load environment variables
dotenv.config();

const USAGE = 'Usage: npm run dev -- <owner> <repo> <pr-number>\nExample: npm run dev -- octocat Hello-World 1';

function fail(message: string): never {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

/**
 * Main entry point for the Claude Multi-Agent Code Review System
 * Usage: npm run dev -- <owner> <repo> <pr-number>
 */
async function main() {
  const [owner, repo, prStr] = process.argv.slice(2);

  // 1. Validate command line arguments
  if (!owner || !repo || !prStr) {
    fail(`Missing arguments.\n${USAGE}`);
  }
  if (!/^\d+$/.test(prStr) || Number(prStr) < 1) {
    fail(`PR number must be a positive integer, got "${prStr}".\n${USAGE}`);
  }
  const prNumber = Number(prStr);

  // 2. Validate authentication (Anthropic API OR AWS Bedrock)
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  const hasBedrock = Boolean(
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
  );

  if (hasBedrock) {
    if (!process.env.AWS_REGION) {
      fail('AWS_REGION is required when using AWS Bedrock.');
    }
    console.log('🔐 Using AWS Bedrock authentication');
  } else if (hasAnthropic) {
    console.log('🔐 Using Anthropic API authentication');
  } else {
    fail(
      'No authentication configured. Use one of:\n' +
        '  Option 1 (Anthropic API): set ANTHROPIC_API_KEY\n' +
        '  Option 2 (AWS Bedrock):   set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_REGION'
    );
  }

  // 3. Validate model
  if (!process.env.ANTHROPIC_MODEL) {
    fail(
      'ANTHROPIC_MODEL is not set.\n' +
        '  Anthropic API: claude-sonnet-4-5-20250929\n' +
        '  AWS Bedrock:   us.anthropic.claude-sonnet-4-5-20250929-v1:0'
    );
  }

  try {
    logger.info(`Starting review of ${owner}/${repo} PR #${prNumber}...`);
    logReviewStart(owner, repo, prNumber);

    // 4. Run the review
    const orchestrator = new CodeReviewOrchestrator();
    const report = await orchestrator.reviewPullRequest(owner, repo, prNumber);

    // 5. Generate and save reports
    const generator = new ReportGenerator();
    const reportsDir = path.join(process.cwd(), 'reports');
    fs.mkdirSync(reportsDir, { recursive: true });

    const base = `${owner}_${repo}_${prNumber}`;
    const jsonPath = path.join('reports', `${base}.json`);
    const mdPath = path.join('reports', `${base}.md`);
    const htmlPath = path.join('reports', `${base}.html`);

    fs.writeFileSync(jsonPath, generator.generateJSONReport(report), 'utf-8');
    fs.writeFileSync(mdPath, generator.generateMarkdownReport(report), 'utf-8');
    fs.writeFileSync(htmlPath, generator.generateHTMLReport(report), 'utf-8');

    logger.info('Review complete. Reports saved:');
    logger.info(`  JSON:     ${jsonPath}`);
    logger.info(`  Markdown: ${mdPath}`);
    logger.info(`  HTML:     ${htmlPath}`);
    logger.info(`  Overall score: ${report.summary.overallScore}/100`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Review failed: ${message}`);
    console.error(`\n❌ Review failed: ${message}\n`);
    process.exit(1);
  }
}

main();
