/**
 * AWS Lambda handler for S3 campaign file ingestion.
 * Deploy with API Gateway or S3 event notification.
 */
const CAMPAIGN_API_URL = process.env.CAMPAIGN_API_URL;

exports.handler = async (event) => {
  const campaigns = [];

  for (const record of event.Records || []) {
    if (record.campaigns) {
      campaigns.push(...record.campaigns);
    }
  }

  if (!campaigns.length) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No campaigns found' }) };
  }

  const res = await fetch(`${CAMPAIGN_API_URL}/api/campaigns/ingest/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaigns }),
  });

  const body = await res.json();
  return {
    statusCode: res.status,
    body: JSON.stringify(body),
  };
};
