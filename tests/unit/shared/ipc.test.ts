import { describe, it, expect, expectTypeOf } from 'vitest';
import type { Channel, ChannelMap, JideApi, Req, Res } from '@shared/ipc';
import { CHANNELS } from '@shared/ipc';
import type { SettingsSchema, ThemeMode } from '@shared/settings';

describe('shared/ipc — runtime', () => {
  it('freezes CHANNELS and includes all expected entries', () => {
    expect(Object.isFrozen(CHANNELS)).toBe(true);
    expect(CHANNELS).toContain('ping');
    expect(CHANNELS).toContain('settings:get');
    expect(CHANNELS).toContain('settings:set');
  });

  it('CHANNELS keys match the runtime keys we use across the app', () => {
    // Sanity guard: if CHANNELS grows, this list is the human-readable
    // mirror future contributors should update.
    expect([...CHANNELS].sort()).toEqual(['ping', 'settings:get', 'settings:set']);
  });
});

describe('shared/ipc — type contract', () => {
  it('ping: request is void, response is string', () => {
    expectTypeOf<Req<'ping'>>().toEqualTypeOf<void>();
    expectTypeOf<Res<'ping'>>().toEqualTypeOf<string>();
  });

  it('settings:get: request is a keyed lookup', () => {
    expectTypeOf<Req<'settings:get'>>().toEqualTypeOf<{ key: 'theme' | 'lastWorktreeId' }>();
  });

  it('settings:get: response is the union over all setting value types', () => {
    expectTypeOf<Res<'settings:get'>>().toEqualTypeOf<SettingsSchema[keyof SettingsSchema]>();
  });

  it('CHANNELS covers every key in ChannelMap (drift guard)', () => {
    expectTypeOf<(typeof CHANNELS)[number]>().toEqualTypeOf<keyof ChannelMap>();
  });

  it('Channel union equals keyof ChannelMap', () => {
    expectTypeOf<Channel>().toEqualTypeOf<keyof ChannelMap>();
  });
});

describe('shared/ipc — settings:set discriminated payload', () => {
  it('matches key with value (positive)', () => {
    expectTypeOf<Req<'settings:set'>>().toEqualTypeOf<
      { key: 'theme'; value: ThemeMode } | { key: 'lastWorktreeId'; value: string | null }
    >();
  });

  it('rejects cross-key value contamination', () => {
    // @ts-expect-error theme cannot accept null (it is required ThemeMode)
    const a: Req<'settings:set'> = { key: 'theme', value: null };
    // @ts-expect-error theme cannot accept arbitrary strings
    const b: Req<'settings:set'> = { key: 'theme', value: 'not-a-theme' };
    // @ts-expect-error lastWorktreeId cannot accept a non-string, non-null value
    const c: Req<'settings:set'> = { key: 'lastWorktreeId', value: 123 };
    void a;
    void b;
    void c;
  });
});

describe('shared/ipc — JideApi precision', () => {
  type GetFn = JideApi['settings']['get'];
  type SetFn = JideApi['settings']['set'];
  type PingFn = JideApi['ping'];

  it('settings.get returns a precise type per key', () => {
    const get = (() => Promise.resolve('auto')) as GetFn;
    expectTypeOf(get('theme')).toEqualTypeOf<Promise<ThemeMode>>();
    expectTypeOf(get('lastWorktreeId')).toEqualTypeOf<Promise<string | null>>();
  });

  it('settings.set accepts only matching key/value pairs', () => {
    expectTypeOf<ReturnType<SetFn>>().toEqualTypeOf<Promise<void>>();
  });

  it('ping returns Promise<string>', () => {
    expectTypeOf<ReturnType<PingFn>>().toEqualTypeOf<Promise<string>>();
  });
});
