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

import { AuthCoordinator } from '../AuthCoordinator';

jest.mock('../../../SwTokenStorageUtils', () => ({
  clearOidcToken: jest.fn(),
  getOidcToken: jest.fn(() => 'stale-token'),
  setOidcToken: jest.fn(),
}));

describe('AuthCoordinator', () => {
  let coordinator: AuthCoordinator;

  beforeEach(() => {
    coordinator = new AuthCoordinator();
  });

  afterEach(() => coordinator.dispose());

  it('de-dupes concurrent ensureFreshToken calls into a single renewer invocation', async () => {
    const renewer = jest.fn(async () => ({
      expiresAt: Date.now() + 300_000,
      idToken: 'fresh',
    }));
    coordinator.registerRenewer(renewer);

    const [a, b, c] = await Promise.all([
      coordinator.ensureFreshToken(),
      coordinator.ensureFreshToken(),
      coordinator.ensureFreshToken(),
    ]);

    expect(renewer).toHaveBeenCalledTimes(1);
    expect([a, b, c]).toEqual(['fresh', 'fresh', 'fresh']);
  });

  it('emits refreshed on success', async () => {
    const renewer = jest.fn(async () => ({ expiresAt: 42, idToken: 'fresh' }));
    coordinator.registerRenewer(renewer);
    const events: unknown[] = [];
    coordinator.on('refreshed', (p) => events.push(p));

    await coordinator.ensureFreshToken();

    expect(events).toEqual([{ expiresAt: 42, idToken: 'fresh' }]);
  });

  it('emits refresh-failed and rejects on renewer error', async () => {
    coordinator.registerRenewer(async () => {
      throw new Error('boom');
    });
    const failures: unknown[] = [];
    coordinator.on('refresh-failed', (p) => failures.push(p));

    await expect(coordinator.ensureFreshToken()).rejects.toThrow('boom');

    expect(failures).toEqual([{ reason: 'boom' }]);
  });

  it('rejects when no renewer is registered', async () => {
    await expect(coordinator.ensureFreshToken()).rejects.toThrow(/no renewer/i);
  });
});
