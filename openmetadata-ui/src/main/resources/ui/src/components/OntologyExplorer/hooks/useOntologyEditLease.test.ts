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

import { act, renderHook, waitFor } from '@testing-library/react';
import { OntologyEditLock } from '../../../generated/type/ontologyEditLock';
import {
  acquireOntologyEditLock,
  getOntologyEditLock,
  releaseOntologyEditLock,
  renewOntologyEditLock,
} from '../../../rest/ontologyAPI';
import { useOntologyEditLease } from './useOntologyEditLease';

jest.mock('../../../rest/ontologyAPI', () => ({
  acquireOntologyEditLock: jest.fn(),
  getOntologyEditLock: jest.fn(),
  releaseOntologyEditLock: jest.fn(),
  renewOntologyEditLock: jest.fn(),
}));

const mockAcquire = acquireOntologyEditLock as jest.MockedFunction<
  typeof acquireOntologyEditLock
>;
const mockGet = getOntologyEditLock as jest.MockedFunction<
  typeof getOntologyEditLock
>;
const mockRelease = releaseOntologyEditLock as jest.MockedFunction<
  typeof releaseOntologyEditLock
>;
const mockRenew = renewOntologyEditLock as jest.MockedFunction<
  typeof renewOntologyEditLock
>;

const LOCK: OntologyEditLock = {
  acquiredAt: 1,
  expiresAt: 61_000,
  holder: { id: 'holder-id', name: 'editor', type: 'user' },
  renewedAt: 1,
  resourceId: 'glossary-id',
  resourceType: 'glossary',
  sessionId: 'session-id',
  version: 1,
};

describe('useOntologyEditLease', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockRelease.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('acquires for sixty seconds, renews every twenty seconds, and releases', async () => {
    mockAcquire.mockResolvedValue(LOCK);
    mockRenew.mockResolvedValue({ ...LOCK, version: 2 });
    const { result, unmount } = renderHook(() =>
      useOntologyEditLease({
        isActive: true,
        resourceId: 'glossary-id',
        resourceType: 'glossary',
      })
    );

    await waitFor(() => expect(result.current.state).toBe('owned'));

    expect(mockAcquire).toHaveBeenCalledWith(
      expect.objectContaining({ leaseSeconds: 60, resourceId: 'glossary-id' })
    );

    act(() => jest.advanceTimersByTime(20_000));
    await waitFor(() =>
      expect(mockRenew).toHaveBeenCalledWith(
        expect.objectContaining({ expectedVersion: 1, leaseSeconds: 60 })
      )
    );

    unmount();

    expect(mockRelease).toHaveBeenCalledWith(
      'glossary',
      'glossary-id',
      expect.any(String)
    );
  });

  it('reports the active holder when another session owns the lease', async () => {
    mockAcquire.mockRejectedValue(new Error('conflict'));
    mockGet.mockResolvedValue({
      ...LOCK,
      holder: { id: 'other-holder', name: 'other-editor', type: 'user' },
    });
    const { result } = renderHook(() =>
      useOntologyEditLease({
        isActive: true,
        resourceId: 'glossary-id',
        resourceType: 'glossary',
      })
    );

    await waitFor(() => expect(result.current.state).toBe('contended'));

    expect(result.current.isOwned).toBe(false);
    expect(result.current.lock?.holder.name).toBe('other-editor');
  });

  it('does not acquire without an active selected resource', () => {
    const { result } = renderHook(() =>
      useOntologyEditLease({
        isActive: false,
        resourceType: 'glossary',
      })
    );

    expect(result.current.state).toBe('idle');
    expect(mockAcquire).not.toHaveBeenCalled();
  });
});
