/**
 * Authentication module for BiblioCanvas CLI
 *
 * All authentication is handled server-side via the BiblioCanvas API.
 * No Firebase config or API keys are stored in the CLI.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as http from 'node:http';
import * as crypto from 'node:crypto';

const CREDENTIALS_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || '.',
  '.bibliocanvas'
);
const CREDENTIALS_FILE = path.join(CREDENTIALS_DIR, 'credentials.json');

const API_URLS = {
  production: 'https://bibliocanvas.web.app/api',
  development: 'https://bibliocanvas-dev.web.app/api',
};

interface StoredCredentials {
  refreshToken: string;
  uid: string;
  email: string;
  displayName: string;
  env: 'production' | 'development';
}

/**
 * Get API base URL based on environment
 */
export function getApiBaseUrl(env: 'production' | 'development'): string {
  return API_URLS[env];
}

/**
 * Load stored credentials
 */
function loadCredentials(): StoredCredentials | null {
  try {
    if (fs.existsSync(CREDENTIALS_FILE)) {
      const data = fs.readFileSync(CREDENTIALS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Save credentials to disk
 */
function saveCredentials(creds: StoredCredentials): void {
  if (!fs.existsSync(CREDENTIALS_DIR)) {
    fs.mkdirSync(CREDENTIALS_DIR, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2), {
    mode: 0o600,
  });
}

/**
 * Delete stored credentials
 */
export function deleteCredentials(): boolean {
  try {
    if (fs.existsSync(CREDENTIALS_FILE)) {
      fs.unlinkSync(CREDENTIALS_FILE);
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * Get a valid ID token (refresh via server-side API)
 */
export async function getIdToken(env: 'production' | 'development' = 'production'): Promise<string> {
  const creds = loadCredentials();
  if (!creds) {
    throw new Error('Not logged in. Run `bibliocanvas login` first.');
  }

  if (creds.env !== env) {
    throw new Error(
      `Logged in to ${creds.env} but trying to use ${env}. Run \`bibliocanvas login --dev\` or \`bibliocanvas login\`.`
    );
  }

  // Refresh token via server-side API (no API key needed on client)
  const baseUrl = getApiBaseUrl(env);
  const response = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: creds.refreshToken }),
  });

  if (!response.ok) {
    throw new Error('Token refresh failed. Run `bibliocanvas login` again.');
  }

  const data = await response.json();

  // Update stored refresh token if it changed
  if (data.refreshToken && data.refreshToken !== creds.refreshToken) {
    creds.refreshToken = data.refreshToken;
    saveCredentials(creds);
  }

  return data.idToken;
}

/**
 * Get current user info from stored credentials
 */
export function getCurrentUser(): { uid: string; email: string; displayName: string; env: string } | null {
  const creds = loadCredentials();
  if (!creds) return null;
  return {
    uid: creds.uid,
    email: creds.email,
    displayName: creds.displayName,
    env: creds.env,
  };
}

/**
 * Login via browser OAuth flow (server-side token exchange)
 *
 * 1. Fetch OAuth client ID from server
 * 2. Start local HTTP server
 * 3. Open browser to Google OAuth consent screen
 * 4. Receive authorization code via redirect
 * 5. Send code to server for token exchange
 * 6. Server returns Firebase tokens
 * 7. Save refresh token to disk
 */
export async function login(env: 'production' | 'development' = 'production'): Promise<{
  email: string;
  displayName: string;
}> {
  const baseUrl = getApiBaseUrl(env);

  // Fetch OAuth client ID from server (no secrets in CLI)
  const configResponse = await fetch(`${baseUrl}/auth/config`);
  if (!configResponse.ok) {
    throw new Error('Failed to fetch OAuth config from server');
  }
  const config = await configResponse.json();
  const clientId = config.clientId;

  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, '127.0.0.1', async () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to start local server'));
        return;
      }
      const port = address.port;
      const redirectUri = `http://127.0.0.1:${port}/callback`;

      // Generate state for CSRF protection
      const state = crypto.randomBytes(16).toString('hex');

      // Build Google OAuth URL
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'openid email profile');
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');

      console.log(`\nOpening browser for Google login...`);
      console.log(`If the browser doesn't open, visit:\n${authUrl.toString()}\n`);

      // Open browser
      const open = (await import('open')).default;
      open(authUrl.toString()).catch(() => {
        // Browser open failed, user can use the URL manually
      });

      // Handle the OAuth callback
      server.on('request', async (req, res) => {
        if (!req.url?.startsWith('/callback')) return;

        const url = new URL(req.url, `http://127.0.0.1:${port}`);
        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');

        if (returnedState !== state) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Error: Invalid state</h1>');
          server.close();
          reject(new Error('Invalid OAuth state'));
          return;
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Error: No authorization code</h1>');
          server.close();
          reject(new Error('No authorization code received'));
          return;
        }

        try {
          // Send code to server for token exchange (no secrets on client)
          const loginResponse = await fetch(`${baseUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, redirectUri }),
          });

          if (!loginResponse.ok) {
            const errorData = await loginResponse.json();
            throw new Error(errorData.error || 'Authentication failed');
          }

          const loginData = await loginResponse.json();

          // Save credentials (only refresh token, no API keys)
          saveCredentials({
            refreshToken: loginData.refreshToken,
            uid: loginData.uid,
            email: loginData.email || '',
            displayName: loginData.displayName || '',
            env,
          });

          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <html>
            <body style="font-family: sans-serif; text-align: center; padding: 50px;">
              <h1>✓ ログイン成功！</h1>
              <p>${loginData.displayName || loginData.email} としてログインしました。</p>
              <p>このウィンドウを閉じてください。</p>
            </body>
            </html>
          `);

          server.close();
          resolve({
            email: loginData.email || '',
            displayName: loginData.displayName || '',
          });
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(`<h1>Error: ${(err as Error).message}</h1>`);
          server.close();
          reject(err);
        }
      });

      // Timeout after 2 minutes
      setTimeout(() => {
        server.close();
        reject(new Error('Login timed out. Please try again.'));
      }, 120000);
    });
  });
}
