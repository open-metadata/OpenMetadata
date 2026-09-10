/*
 *  Copyright 2025 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

const { Provider } = require('oidc-provider');
const express = require('express');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT || '9090', 10);
const ISSUER = process.env.ISSUER || `http://localhost:${PORT}`;

// Mutable test state — controlled via /test/* endpoints
const DEFAULT_LOGIN_ACCOUNT = 'admin';

const testState = {
  accessTokenTTL: 3600,
  idTokenTTL: 3600,
  forceInteractionRequired: false,
  refreshTokenEnabled: true,
  tokenEndpointError: null, // { errorCode: 'invalid_grant', httpStatus: 400 }
  // Account auto-approved on the next interactive login. Lets a test exercise a
  // specific identity (e.g. one whose sub differs from the email local-part).
  defaultLoginAccount: DEFAULT_LOGIN_ACCOUNT,
};

const resetTestState = () => {
  testState.accessTokenTTL = 3600;
  testState.idTokenTTL = 3600;
  testState.forceInteractionRequired = false;
  testState.refreshTokenEnabled = true;
  testState.tokenEndpointError = null;
  testState.defaultLoginAccount = DEFAULT_LOGIN_ACCOUNT;
};

// Request metrics — reset via /test/metrics/reset
const metrics = { tokenRequests: 0, authRequests: 0, refreshAttempts: 0 };

// Pre-seeded test accounts — auto-approved, no interactive login
const TEST_ACCOUNTS = new Map([
  [
    'admin',
    {
      email: 'admin@open-metadata.org',
      email_verified: true,
      name: 'Test Admin',
      sub: 'admin',
      preferred_username: 'admin',
    },
  ],
  [
    'user1',
    {
      email: 'user1@open-metadata.org',
      email_verified: true,
      name: 'Test User 1',
      sub: 'user1',
      preferred_username: 'user1',
    },
  ],
  // Identity whose sub ('claim-user') deliberately differs from the email
  // local-part ('claim.user.mapped'). Used to verify OIDC self-signup persists
  // the mapped email claim instead of deriving <sub>@<domain>. See issue #29189.
  [
    'claim-user',
    {
      email: 'claim.user.mapped@open-metadata.org',
      email_verified: true,
      name: 'Claim Mapped User',
      sub: 'claim-user',
      preferred_username: 'claim-user',
    },
  ],
]);

const findAccount = (_ctx, id) => {
  const account = TEST_ACCOUNTS.get(id);
  if (!account) return undefined;
  return {
    accountId: id,
    async claims(_use, _scope) {
      return { sub: id, ...account };
    },
  };
};

// Every browser-side SPA client (public OIDC, mocked Auth0 tenant, mocked
// MSAL tenant) shares the same redirect set. Every SDK we host — oidc-client,
// @auth0/auth0-react, @azure/msal-browser — points at the OM SPA's own
// /callback (interactive) and /silent-callback (hidden iframe, oidc-client
// only). Keeping the list on one constant means adding a new port later is a
// single edit; forgetting to sync a client's list has bit us before.
const SPA_REDIRECT_URIS = [
  'http://localhost:8585/callback',
  'http://localhost:3000/callback',
  'http://localhost:8585/silent-callback',
];
const SPA_POST_LOGOUT_REDIRECT_URIS = [
  'http://localhost:8585',
  'http://localhost:3000',
];

const clients = [
  {
    client_id: 'openmetadata-test',
    client_secret: 'openmetadata-test-secret',
    grant_types: ['authorization_code', 'refresh_token'],
    redirect_uris: SPA_REDIRECT_URIS,
    post_logout_redirect_uris: SPA_POST_LOGOUT_REDIRECT_URIS,
    response_types: ['code'],
    token_endpoint_auth_method: 'client_secret_post',
    scope: 'openid email profile offline_access',
  },
  {
    client_id: 'openmetadata-test-public',
    grant_types: ['authorization_code', 'refresh_token'],
    redirect_uris: SPA_REDIRECT_URIS,
    post_logout_redirect_uris: SPA_POST_LOGOUT_REDIRECT_URIS,
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    scope: 'openid email profile offline_access',
  },
  // Auth0 SPA client. @auth0/auth0-react runs Authorization Code + PKCE with
  // no client secret, discovering endpoints from
  //   https://<domain>/.well-known/openid-configuration
  // — we serve that at the /auth0 path prefix (see the tenant-shape
  // responders below). This client_id is what the auth0-oidc fixture sets in
  // OM's `authenticationConfiguration.clientId`, so the SDK sends it on the
  // /authorize request and on the /oauth/token PKCE exchange.
  {
    client_id: 'openmetadata-auth0-client',
    grant_types: ['authorization_code', 'refresh_token'],
    redirect_uris: SPA_REDIRECT_URIS,
    post_logout_redirect_uris: SPA_POST_LOGOUT_REDIRECT_URIS,
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    scope: 'openid email profile offline_access',
  },
  // MSAL SPA client. @azure/msal-browser runs Authorization Code + PKCE
  // against `${authority}/oauth2/v2.0/authorize` and
  // `${authority}/oauth2/v2.0/token`; the fixture points `authority` at
  //   http://localhost:9090/msal/<tid>/v2.0
  // and MSAL will discover endpoints via
  //   {authority}/.well-known/openid-configuration
  // which the tenant responder below serves. Same PKCE-only flow as Auth0.
  {
    client_id: 'openmetadata-msal-client',
    grant_types: ['authorization_code', 'refresh_token'],
    redirect_uris: SPA_REDIRECT_URIS,
    post_logout_redirect_uris: SPA_POST_LOGOUT_REDIRECT_URIS,
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    scope: 'openid email profile offline_access',
  },
];

const providerConfig = {
  clients,
  findAccount,
  claims: {
    openid: ['sub'],
    email: ['email', 'email_verified'],
    profile: ['name', 'preferred_username'],
  },
  scopes: ['openid', 'email', 'profile', 'offline_access'],
  features: {
    devInteractions: { enabled: false },
    rpInitiatedLogout: { enabled: true },
  },
  pkce: {
    required: () => false,
  },
  ttl: {
    AccessToken: (_ctx, _token, _client) => testState.accessTokenTTL,
    IdToken: (_ctx, _token, _client) => testState.idTokenTTL,
    RefreshToken: (_ctx, _token, _client) =>
      testState.refreshTokenEnabled ? 86400 : 0,
    AuthorizationCode: 600,
    Session: 86400,
    Grant: 86400,
    Interaction: 600,
  },
  cookies: {
    keys: [crypto.randomBytes(32).toString('hex')],
  },
  jwks: {
    keys: [
      {
        kty: 'RSA',
        kid: 'mock-oidc-key-1',
        use: 'sig',
        alg: 'RS256',
        // Generated at startup; see init() below
      },
    ],
  },
  // Auto-approve all interactions (skip login/consent screens)
  interactions: {
    url(_ctx, _interaction) {
      return `/interaction/${_interaction.uid}`;
    },
  },
  renderError: async (ctx, out, _error) => {
    ctx.type = 'html';
    ctx.body = `<html><body><pre>${JSON.stringify(out, null, 2)}</pre></body></html>`;
  },
};

async function init() {
  const { generateKeyPair, exportJWK } = await import('jose');
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const privateJwk = await exportJWK(privateKey);
  const publicJwk = await exportJWK(publicKey);

  privateJwk.kid = 'mock-oidc-key-1';
  privateJwk.use = 'sig';
  privateJwk.alg = 'RS256';

  publicJwk.kid = 'mock-oidc-key-1';
  publicJwk.use = 'sig';
  publicJwk.alg = 'RS256';

  providerConfig.jwks = { keys: [privateJwk] };

  const provider = new Provider(ISSUER, providerConfig);

  // Auto-approve interaction: when the OIDC library redirects to /interaction/:uid,
  // we automatically log in as 'admin' and grant consent without any user input.
  provider.use(async (ctx, next) => {
    await next();

    if (
      ctx.path.startsWith('/interaction/') &&
      ctx.method === 'GET' &&
      !ctx.path.endsWith('/abort')
    ) {
      const uid = ctx.path.split('/interaction/')[1];
      if (!uid || uid.includes('/')) return;

      try {
        const interactionDetails = await provider.interactionDetails(
          ctx.req,
          ctx.res
        );
        const { prompt } = interactionDetails;

        if (testState.forceInteractionRequired) {
          testState.forceInteractionRequired = false;
          ctx.status = 403;
          ctx.body = JSON.stringify({
            error: 'interaction_required',
            error_description:
              'Forced interaction_required for testing silent renewal failure',
          });
          return;
        }

        if (prompt.name === 'login') {
          const loginUser =
            ctx.query.login_hint ||
            interactionDetails.params.login_hint ||
            testState.defaultLoginAccount ||
            'admin';
          const result = {
            login: { accountId: loginUser },
          };
          await provider.interactionFinished(ctx.req, ctx.res, result, {
            mergeWithLastSubmission: false,
          });
          return;
        }

        if (prompt.name === 'consent') {
          const grant = new provider.Grant({
            accountId: interactionDetails.session.accountId,
            clientId: interactionDetails.params.client_id,
          });

          const requestedScopes = interactionDetails.params.scope;
          if (requestedScopes) {
            grant.addOIDCScope(requestedScopes);
          }
          grant.addOIDCScope('openid email profile offline_access');

          const grantId = await grant.save();

          const result = { consent: { grantId } };
          await provider.interactionFinished(ctx.req, ctx.res, result, {
            mergeWithLastSubmission: true,
          });
        }
      } catch (_err) {
        // Interaction may have already been handled
      }
    }
  });

  const app = express();
  app.use(express.json());

  // Server-facing base URL for endpoints that the OM server calls from
  // inside Docker (token exchange, JWKS, userinfo). Defaults to ISSUER
  // so that outside-Docker usage (tests hitting localhost) works unchanged.
  const INTERNAL_BASE =
    process.env.INTERNAL_BASE_URL || ISSUER;

  // Custom discovery endpoint returning hybrid URLs:
  //   - Browser-facing (authorization, end_session): ISSUER (localhost:9090)
  //   - Server-facing (token, jwks, userinfo): INTERNAL_BASE (mock-oidc-provider:9090 in Docker)
  // This is mounted before oidc-provider so it takes precedence.
  app.get('/.well-known/openid-configuration', (_req, res) => {
    res.json({
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/auth`,
      token_endpoint: `${INTERNAL_BASE}/token`,
      jwks_uri: `${INTERNAL_BASE}/jwks`,
      userinfo_endpoint: `${INTERNAL_BASE}/me`,
      end_session_endpoint: `${ISSUER}/session/end`,
      pushed_authorization_request_endpoint: `${INTERNAL_BASE}/request`,
      claims_parameter_supported: false,
      claims_supported: [
        'sub',
        'email',
        'email_verified',
        'name',
        'preferred_username',
        'sid',
        'auth_time',
        'iss',
      ],
      code_challenge_methods_supported: ['S256'],
      grant_types_supported: [
        'implicit',
        'authorization_code',
        'refresh_token',
      ],
      response_modes_supported: ['form_post', 'fragment', 'query'],
      response_types_supported: ['code id_token', 'code', 'id_token', 'none'],
      scopes_supported: ['openid', 'email', 'profile', 'offline_access'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      token_endpoint_auth_methods_supported: [
        'client_secret_basic',
        'client_secret_jwt',
        'client_secret_post',
        'private_key_jwt',
        'none',
      ],
      token_endpoint_auth_signing_alg_values_supported: [
        'HS256',
        'RS256',
        'PS256',
        'ES256',
        'EdDSA',
      ],
      authorization_response_iss_parameter_supported: true,
      request_parameter_supported: false,
      request_uri_parameter_supported: false,
      claim_types_supported: ['normal'],
    });
  });

  // Test control endpoints
  app.post('/test/configure', (req, res) => {
    const {
      accessTokenTTL,
      idTokenTTL,
      refreshTokenEnabled,
      forceInteractionRequired,
      tokenEndpointError,
      defaultLoginAccount,
    } = req.body;
    if (accessTokenTTL !== undefined)
      testState.accessTokenTTL = accessTokenTTL;
    if (idTokenTTL !== undefined) testState.idTokenTTL = idTokenTTL;
    if (refreshTokenEnabled !== undefined)
      testState.refreshTokenEnabled = refreshTokenEnabled;
    if (forceInteractionRequired !== undefined)
      testState.forceInteractionRequired = forceInteractionRequired;
    if (tokenEndpointError !== undefined)
      testState.tokenEndpointError = tokenEndpointError;
    if (defaultLoginAccount !== undefined)
      testState.defaultLoginAccount = defaultLoginAccount;

    res.json({ ok: true, state: { ...testState } });
  });

  app.post('/test/force-interaction-required', (_req, res) => {
    testState.forceInteractionRequired = true;
    res.json({ ok: true, forceInteractionRequired: true });
  });

  app.post('/test/reset', (_req, res) => {
    resetTestState();
    res.json({ ok: true, state: { ...testState } });
  });

  app.get('/test/state', (_req, res) => {
    res.json({ ...testState });
  });

  // Metrics endpoints
  app.get('/test/metrics', (_req, res) => {
    res.json({ ...metrics });
  });

  app.post('/test/metrics/reset', (_req, res) => {
    metrics.tokenRequests = 0;
    metrics.authRequests = 0;
    metrics.refreshAttempts = 0;
    res.json({ ok: true });
  });

  // Token endpoint interceptor — must be BEFORE oidc-provider mount.
  // Tracks metrics and optionally injects errors for testing.
  app.post('/token', (req, res, next) => {
    metrics.tokenRequests++;

    const grantType = req.body?.grant_type;
    if (grantType === 'refresh_token') {
      metrics.refreshAttempts++;
    }

    if (testState.tokenEndpointError) {
      const { errorCode, httpStatus } = testState.tokenEndpointError;
      testState.tokenEndpointError = null; // one-shot
      return res.status(httpStatus).json({ error: errorCode });
    }
    next();
  });

  // Auth endpoint interceptor — tracks authorization request metrics.
  app.get('/auth', (req, res, next) => {
    metrics.authRequests++;
    next();
  });

  // ── Auth0 SPA SDK path aliases ─────────────────────────────────────────
  //
  // @auth0/auth0-spa-js hard-codes tenant-flavored URL paths regardless of
  // what discovery advertises: it POSTs `${domain}/oauth/token`, redirects
  // to `${domain}/authorize`, logs out at `${domain}/v2/logout`, and pulls
  // signing keys from `${domain}/.well-known/jwks.json`. Setting `domain`
  // to this mock (http://localhost:9090) therefore needs those exact
  // paths to work — which they can't hit oidc-provider directly because
  // oidc-provider owns /auth, /token, /session/end, /jwks. The aliases
  // below rewrite the URL in place and hand off to oidc-provider so the
  // real SDK, running unmodified, drives the real protocol against the
  // shared provider state (same clients, same JWKS, same accounts). See
  // sso-providers/auth0.ts for the fixture that consumes these paths.
  //
  // The redirect_uri (http://localhost:8585/callback) and client_id
  // (openmetadata-auth0-client) are already registered on the shared
  // provider above, so no per-alias client bookkeeping is needed.
  const rewriteTo = (targetPath) => (req, _res, next) => {
    const [, search = ''] = req.originalUrl.split('?');
    req.url = search ? `${targetPath}?${search}` : targetPath;
    next();
  };
  app.all('/authorize', rewriteTo('/auth'));
  app.all('/oauth/token', rewriteTo('/token'));
  app.all('/userinfo', rewriteTo('/me'));
  app.all('/v2/logout', rewriteTo('/session/end'));
  app.get('/.well-known/jwks.json', rewriteTo('/jwks'));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Mount the OIDC provider
  app.use(provider.callback());

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Mock OIDC Provider listening on ${ISSUER}`
    );
    console.log(
      `Discovery: ${ISSUER}/.well-known/openid-configuration`
    );
    console.log(`Test control: POST ${ISSUER}/test/configure`);
  });
}

init().catch((err) => {
  console.error('Failed to start mock OIDC provider:', err);
  process.exit(1);
});
