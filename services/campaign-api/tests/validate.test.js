const { validateCampaignBody, sanitizeString } = require('../src/middleware/validate');

describe('validateCampaignBody', () => {
  test('accepts valid campaign', () => {
    expect(validateCampaignBody({ name: 'Test Campaign', budget: 1000, channel: 'social' })).toEqual([]);
  });

  test('rejects invalid name and budget', () => {
    const errors = validateCampaignBody({ name: 'X', budget: -1 });
    expect(errors.length).toBeGreaterThan(0);
  });

  test('rejects invalid channel', () => {
    const errors = validateCampaignBody({ name: 'Valid Name', budget: 100, channel: 'invalid' });
    expect(errors.some((e) => e.includes('channel'))).toBe(true);
  });
});

describe('sanitizeString', () => {
  test('strips HTML and trims', () => {
    expect(sanitizeString('  <script>alert(1)</script>Hello  ')).toBe('alert(1)Hello');
  });
});
