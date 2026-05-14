import { describe, it, expectTypeOf } from 'vitest';
import type {
  Message,
  SessionStatus,
  SessionSnapshot,
  DiffLine,
  RateLimitInfo,
  SessionId,
  PersistedSession,
} from '@shared/session';

describe('shared/session — type contract', () => {
  it('Message is a closed discriminated union over the 5 renderer types', () => {
    type Tags = Message['type'];
    expectTypeOf<Tags>().toEqualTypeOf<'user' | 'claude' | 'tool' | 'diff' | 'system'>();
  });

  it('SessionStatus enumerates all CLI-observable states', () => {
    expectTypeOf<SessionStatus>().toEqualTypeOf<
      'idle' | 'starting' | 'requesting' | 'streaming' | 'awaiting' | 'error' | 'exited'
    >();
  });

  it('tool message status covers the full lifecycle', () => {
    type ToolStatus = Extract<Message, { type: 'tool' }>['status'];
    expectTypeOf<ToolStatus>().toEqualTypeOf<
      'pending' | 'approved' | 'denied' | 'running' | 'done' | 'error'
    >();
  });

  it('claude message can flag thinking content', () => {
    const m: Extract<Message, { type: 'claude' }> = {
      type: 'claude',
      id: 'm1',
      text: '…',
      ts: 0,
      thinking: true,
    };
    expectTypeOf(m.thinking).toEqualTypeOf<boolean | undefined>();
  });

  it('system message has level info|warn|error', () => {
    type Level = Extract<Message, { type: 'system' }>['level'];
    expectTypeOf<Level>().toEqualTypeOf<'info' | 'warn' | 'error'>();
  });

  it('SessionSnapshot exposes the expected surface', () => {
    expectTypeOf<SessionSnapshot['messages']>().toEqualTypeOf<Message[]>();
    expectTypeOf<SessionSnapshot['rateLimit']>().toEqualTypeOf<RateLimitInfo | null>();
    expectTypeOf<SessionSnapshot['awaitingToolUseId']>().toEqualTypeOf<string | null>();
    expectTypeOf<SessionSnapshot['totalCostUsd']>().toEqualTypeOf<number>();
    expectTypeOf<SessionSnapshot['id']>().toEqualTypeOf<SessionId>();
  });

  it('SessionSnapshot exposes title and createdAt', () => {
    expectTypeOf<SessionSnapshot['title']>().toEqualTypeOf<string>();
    expectTypeOf<SessionSnapshot['createdAt']>().toEqualTypeOf<number>();
  });

  it('PersistedSession is structurally a SessionSnapshot', () => {
    expectTypeOf<PersistedSession>().toEqualTypeOf<SessionSnapshot>();
  });

  it('DiffLine sign is one of + - space', () => {
    expectTypeOf<DiffLine['sign']>().toEqualTypeOf<'+' | '-' | ' '>();
  });
});
