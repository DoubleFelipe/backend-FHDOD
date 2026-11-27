import { describe, expect, it, vi } from 'vitest';
const { client, connect } = vi.hoisted(() => {
  const client = { query: vi.fn(), release: vi.fn() };
  return { client, connect: vi.fn(async () => client) };
});
vi.mock('../src/config/database.js', () => ({ pool: { connect } }));
import { transaction } from '../src/utils/database.js';

describe('transaction lifecycle', () => {
  it('rolls back a failed write and always releases the client', async () => {
    client.query.mockReset().mockResolvedValue({});
    client.release.mockClear();
    const failure = new Error('failed write');
    await expect(
      transaction(async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(client.query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'ROLLBACK']);
    expect(client.release).toHaveBeenCalledWith(false);
  });
  it('discards a broken connection when rollback also fails, preserving the original error', async () => {
    client.query
      .mockReset()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('connection lost'));
    client.release.mockClear();
    const failure = new Error('original error');
    await expect(
      transaction(async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(client.release).toHaveBeenCalledWith(true);
  });
});
