function sanitizeString(str, maxLen = 500) {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .slice(0, maxLen)
    .replace(/<[^>]*>/g, '');
}

function validateCampaignBody(body) {
  const errors = [];
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length < 2) {
    errors.push('name must be at least 2 characters');
  }
  if (body.budget === undefined || Number.isNaN(Number(body.budget)) || Number(body.budget) < 0) {
    errors.push('budget must be a non-negative number');
  }
  const validChannels = ['search', 'social', 'display', 'email', 'video', 'other'];
  if (body.channel && !validChannels.includes(body.channel)) {
    errors.push(`channel must be one of: ${validChannels.join(', ')}`);
  }
  return errors;
}

function validateCampaignMiddleware(req, res, next) {
  const errors = validateCampaignBody(req.body);
  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  req.body.name = sanitizeString(req.body.name, 200);
  req.body.description = sanitizeString(req.body.description || '', 2000);
  req.body.budget = Number(req.body.budget);
  next();
}

function validateBulkMiddleware(req, res, next) {
  const { campaigns } = req.body;
  if (!Array.isArray(campaigns) || campaigns.length === 0) {
    return res.status(400).json({ error: 'campaigns must be a non-empty array' });
  }
  if (campaigns.length > 500) {
    return res.status(400).json({ error: 'Maximum 500 campaigns per bulk request' });
  }
  const allErrors = [];
  campaigns.forEach((c, i) => {
    const errs = validateCampaignBody(c);
    if (errs.length) allErrors.push({ index: i, errors: errs });
  });
  if (allErrors.length) {
    return res.status(400).json({ error: 'Bulk validation failed', details: allErrors });
  }
  req.body.campaigns = campaigns.map((c) => ({
    ...c,
    name: sanitizeString(c.name, 200),
    description: sanitizeString(c.description || '', 2000),
    budget: Number(c.budget),
  }));
  next();
}

module.exports = {
  validateCampaignMiddleware,
  validateBulkMiddleware,
  validateCampaignBody,
  sanitizeString,
};
