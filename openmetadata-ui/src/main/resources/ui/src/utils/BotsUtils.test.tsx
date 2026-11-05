/*
 *  Copyright 2022 Collate.
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

import { getJWTTokenExpiryOptions, getTokenIssuedAtMs } from './BotsUtils';

describe('getJWTTokenExpiryOptions', () => {
  it('should return every expiry, shortest first, when filterUnlimited is false (default)', () => {
    const result = getJWTTokenExpiryOptions();

    expect(result).toHaveLength(7);
    expect(result[0]).toEqual({ id: 'OneHour', label: 'label.1-hr' });
    expect(result.map((option) => option.label)).toContain('label.unlimited');
  });

  it('should filter out Unlimited when filterUnlimited is true', () => {
    const result = getJWTTokenExpiryOptions(true);

    expect(result).toHaveLength(6);
    expect(result.map((option) => option.label)).not.toContain(
      'label.unlimited'
    );
  });
});

describe('getTokenIssuedAtMs', () => {
  const buildJwtWithIat = (iat: number | null): string => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString(
      'base64url'
    );
    const payload = Buffer.from(
      JSON.stringify(iat === null ? {} : { iat })
    ).toString('base64url');

    return `${header}.${payload}.signature`;
  };

  it('returns null when the token is undefined or empty', () => {
    expect(getTokenIssuedAtMs(undefined)).toBeNull();
    expect(getTokenIssuedAtMs('')).toBeNull();
  });

  it('returns null when the token is opaque / undecodable', () => {
    expect(getTokenIssuedAtMs('not-a-jwt')).toBeNull();
  });

  it('returns null when the JWT has no iat claim', () => {
    expect(getTokenIssuedAtMs(buildJwtWithIat(null))).toBeNull();
  });

  it('returns iat converted from seconds to milliseconds', () => {
    const iatSeconds = 1_700_000_000;

    expect(getTokenIssuedAtMs(buildJwtWithIat(iatSeconds))).toBe(
      iatSeconds * 1000
    );
  });
});
