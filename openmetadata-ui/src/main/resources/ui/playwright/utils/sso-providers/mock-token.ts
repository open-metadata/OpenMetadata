/*
 *  Copyright 2026 Collate.
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

// Shared JWT minter for the mocked-SDK SSO fixtures (msal-mock, auth0-mock).
//
// Produces an unsigned (`alg: none`) three-segment JWT the AuthCoordinator can
// decode without cryptographic verification — its client-side path only reads
// `exp` and the principal claims. The signature segment is a fixed placeholder
// so `forceTokenExpiry` can round-trip it verbatim while mangling the payload.
//
// Deterministic (no randomness) so a test failure inspecting the token in
// storage matches what the fixture minted. The one non-deterministic bit —
// `iat`/`exp` — is caller-supplied.

export interface MockJwtOptions {
  email: string;
  name: string;
  sub: string;
  /** Seconds until expiry. Positive → future; negative → already expired. */
  expInSeconds: number;
}

/** Base64url-encodes a JSON-serialisable value (RFC 7515 §2). */
const base64url = (value: unknown): string =>
  btoa(JSON.stringify(value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

// Fixed placeholder — the AuthCoordinator doesn't verify signatures on the
// client, and keeping this static means `forceTokenExpiry` can rewrite the
// payload without touching the signature segment.
export const MOCK_JWT_SIGNATURE_PLACEHOLDER = 'signature-placeholder';

/**
 * Builds an unsigned JWT with the shape the client-side auth path expects.
 * Not usable against a real backend — for browser-side flows only, driven by
 * the mocked SDK fixtures.
 */
export const mintMockJwt = ({
  email,
  name,
  sub,
  expInSeconds,
}: MockJwtOptions): string => {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + expInSeconds;

  const header = base64url({ typ: 'JWT', alg: 'none' });
  const payload = base64url({
    exp,
    iat,
    email,
    name,
    sub,
    preferred_username: email,
  });

  return `${header}.${payload}.${MOCK_JWT_SIGNATURE_PLACEHOLDER}`;
};
