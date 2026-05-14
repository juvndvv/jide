import type { SettingsKey, SettingsSchema } from './settings.js';

export const CHANNELS = ['ping', 'settings:get', 'settings:set'] as const;
export type Channel = (typeof CHANNELS)[number];

export type ChannelMap = {
  ping: { req: void; res: string };
  'settings:get': {
    req: { key: SettingsKey };
    res: SettingsSchema[SettingsKey];
  };
  'settings:set': {
    req: { [K in SettingsKey]: { key: K; value: SettingsSchema[K] } }[SettingsKey];
    res: void;
  };
};

export type Req<C extends Channel> = ChannelMap[C]['req'];
export type Res<C extends Channel> = ChannelMap[C]['res'];

export interface JideApi {
  ping: () => Promise<string>;
  settings: {
    get: <K extends SettingsKey>(key: K) => Promise<SettingsSchema[K]>;
    set: <K extends SettingsKey>(key: K, value: SettingsSchema[K]) => Promise<void>;
  };
}

declare global {
  interface Window {
    jide: JideApi;
  }
}

// runtime: freeze to prevent accidental mutation
Object.freeze(CHANNELS);
