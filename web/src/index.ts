import './app-shell.ts';
import './modules/playlist/playlist-view.ts';
import './modules/playlist/result-view.ts';
import './modules/auth/login-page.ts';
import './modules/settings/settings-view.ts';
import './modules/library/library-view.ts';
import './modules/library/search-sheet.ts';
import './components/ui-top-bar.ts';
import './components/ui-bottom-sheet.ts';
import './components/ui-snackbar.ts';
import './components/ui-search-sheet.ts';
import { showSnackbar } from './components/ui-snackbar.ts';
import { credentialsProvider, initSdk } from './modules/auth/sdk.ts';
import { setAuthenticated } from './modules/auth/store.ts';
import { viewStack } from './app-shell.ts';
import { loadRuntimeConfig } from './modules/tidal/settings.ts';
globalThis.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  event.preventDefault();
  const msg = event.reason instanceof Error ? event.reason.message : String(event.reason);
  showSnackbar(msg || 'An unexpected error occurred.', 'error');
});

// Check for existing SDK credentials — restores session across page reloads.
loadRuntimeConfig()
  .then(async (config) => {
    await initSdk(config.clientId);
    const creds = await credentialsProvider.getCredentials().catch(() => null);
    if (creds?.token) {
      setAuthenticated(true);
      if (viewStack.get()[0] === 'login') {
        viewStack.set(['playlist']);
      }
    }
  })
  .catch(() => {
    // Stay on login — startup failure should not crash the app.
  });
