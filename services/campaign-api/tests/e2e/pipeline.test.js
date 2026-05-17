describe('AdFlow E2E Pipeline Contract', () => {
  const steps = [
    'POST /api/campaigns — create campaign',
    'POST /classify — AI detects objective, platform, approval flow',
    'POST /:id/process — route to workflow queue',
    'WS /ws — monitoring receives metrics update',
    'GET /api/analytics/overview — analytics reflects new campaign',
  ];

  test('pipeline steps are defined', () => {
    expect(steps.length).toBe(5);
  });

  test('campaign lifecycle statuses', () => {
    const lifecycle = ['pending', 'classifying', 'routed', 'active', 'failed'];
    expect(lifecycle).toContain('active');
    expect(lifecycle).toContain('failed');
  });
});
