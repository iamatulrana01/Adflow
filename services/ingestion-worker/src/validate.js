const VALID_CHANNELS = ['search', 'social', 'display', 'email', 'video', 'other'];

function validateCampaign(c, index) {
  const errors = [];
  if (!c.name || typeof c.name !== 'string' || c.name.trim().length < 2) {
    errors.push(`[${index}] name must be at least 2 characters`);
  }
  if (c.budget === undefined || Number.isNaN(Number(c.budget)) || Number(c.budget) < 0) {
    errors.push(`[${index}] budget must be non-negative`);
  }
  if (c.channel && !VALID_CHANNELS.includes(c.channel)) {
    errors.push(`[${index}] invalid channel`);
  }
  return errors;
}

function validateBatch(campaigns) {
  if (!Array.isArray(campaigns)) return ['campaigns must be an array'];
  if (campaigns.length === 0) return ['campaigns must not be empty'];
  if (campaigns.length > 1000) return ['max 1000 campaigns per batch'];
  return campaigns.flatMap((c, i) => validateCampaign(c, i));
}

function sanitizeCampaign(c) {
  return {
    name: String(c.name).trim().slice(0, 200),
    description: String(c.description || '').trim().slice(0, 2000),
    budget: Number(c.budget),
    channel: VALID_CHANNELS.includes(c.channel) ? c.channel : 'other',
  };
}

module.exports = { validateBatch, sanitizeCampaign };
