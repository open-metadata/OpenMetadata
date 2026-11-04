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
import { DOMAIN_STORAGE_KEY } from '../constants/constants';
import { reloadOnPickFromOtherTab } from './useDomainStore';

const mockReload = jest.fn();

describe('reloadOnPickFromOtherTab', () => {
  const originalLocation = window.location;

  beforeAll(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: mockReload },
    });
  });

  afterAll(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  beforeEach(() => mockReload.mockClear());

  it('reloads when another tab changes the pick', () => {
    reloadOnPickFromOtherTab(
      new StorageEvent('storage', {
        key: DOMAIN_STORAGE_KEY,
        oldValue: '{"state":{"activeDomain":"All Domains"}}',
        newValue: '{"state":{"activeDomain":"Alpha"}}',
      })
    );

    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it('ignores other keys and unchanged values', () => {
    reloadOnPickFromOtherTab(
      new StorageEvent('storage', {
        key: 'some-other-key',
        oldValue: 'a',
        newValue: 'b',
      })
    );
    reloadOnPickFromOtherTab(
      new StorageEvent('storage', {
        key: DOMAIN_STORAGE_KEY,
        oldValue: 'same',
        newValue: 'same',
      })
    );

    expect(mockReload).not.toHaveBeenCalled();
  });

  it('ignores a rewrite that keeps the same pick', () => {
    reloadOnPickFromOtherTab(
      new StorageEvent('storage', {
        key: DOMAIN_STORAGE_KEY,
        oldValue:
          '{"state":{"activeDomain":"Alpha","activeDomainEntityRef":{"id":"1"}}}',
        newValue:
          '{"state":{"activeDomain":"Alpha","activeDomainEntityRef":{"id":"1","name":"Alpha"}}}',
      })
    );

    expect(mockReload).not.toHaveBeenCalled();
  });
});
