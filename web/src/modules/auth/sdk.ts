import {
  credentialsProvider,
  init as sdkInit,
  logout as sdkLogout,
  setCredentials as sdkSetCredentials,
} from '@tidal-music/auth';
import { SCOPES } from '../tidal/shared.ts';

let _initPromise: Promise<void> | null = null;
let _clientId = '';

/** Idempotent — safe to call from multiple places concurrently. */
export function initSdk(clientId: string): Promise<void> {
  if (!_initPromise || _clientId !== clientId) {
    _clientId = clientId;
    _initPromise = sdkInit({
      clientId,
      credentialsStorageKey: 'tidal_sdk_credentials',
      scopes: [...SCOPES],
    });
  }
  return _initPromise;
}

export function getClientId(): string {
  return _clientId;
}

export { credentialsProvider, sdkLogout as logout, sdkSetCredentials as setCredentials };
