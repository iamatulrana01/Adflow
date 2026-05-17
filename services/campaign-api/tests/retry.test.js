const { retryWithBackoff } = require('../src/utils/retry');

describe('retryWithBackoff', () => {
  test('succeeds on first attempt', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await retryWithBackoff(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('retries then succeeds', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');
    const result = await retryWithBackoff(fn, { maxAttempts: 3, baseDelayMs: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('throws after max attempts', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('always fails'));
    await expect(retryWithBackoff(fn, { maxAttempts: 2, baseDelayMs: 10 })).rejects.toThrow(
      'always fails'
    );
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
