import { loadFreelancerScan } from './search.js';
import { buildRecommendation } from '../jobs/recommend.js';

const scan = await loadFreelancerScan();
const recommendation = buildRecommendation(scan.jobs, scan.scanned);
console.log(
  JSON.stringify(
    {
      verdict: recommendation.verdict,
      reason: recommendation.reason,
      reviewed: recommendation.reviewed,
      shortlisted: scan.jobs.length,
      job: recommendation.job
        ? {
            title: recommendation.job.title,
            url: recommendation.job.upworkUrl,
            budget: recommendation.job.budgetLabel,
            country: recommendation.job.client.countryCode,
            verified: recommendation.job.client.verifiedPayment,
            bids: recommendation.job.proposals,
          }
        : null,
      bidText: recommendation.bidText,
    },
    null,
    2,
  ),
);
