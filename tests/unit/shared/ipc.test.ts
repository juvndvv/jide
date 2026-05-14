import { describe, it, expect, expectTypeOf } from 'vitest';
import type { Channel, Req, Res } from '@shared/ipc';
import { CHANNELS } from '@shared/ipc';

describe('shared/ipc', () => {
  it('exports a frozen list of channels matching the Channel union', () => {
    expect(Object.isFrozen(CHANNELS)).toBe(true);
    expect(CHANNELS).toContain('ping');
    expect(CHANNELS).toContain('settings:get');
    expect(CHANNELS).toContain('settings:set');
  });

  it('ping channel: request is void, response is string', () => {
    expectTypeOf<Req<'ping'>>().toEqualTypeOf<void>();
    expectTypeOf<Res<'ping'>>().toEqualTypeOf<string>();
  });

  it('settings:get channel: request is a key, response is the value', () => {
    expectTypeOf<Req<'settings:get'>>().toEqualTypeOf<{ key: 'theme' | 'lastWorktreeId' }>();
  });

  it('Channel union is exactly the entries of CHANNELS', () => {
    expectTypeOf<Channel>().toEqualTypeOf<(typeof CHANNELS)[number]>();
  });
});
