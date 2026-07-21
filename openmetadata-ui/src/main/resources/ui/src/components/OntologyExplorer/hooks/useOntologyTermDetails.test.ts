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
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { getGlossaryTermsById } from '../../../rest/glossaryAPI';
import { useOntologyTermDetails } from './useOntologyTermDetails';

jest.mock('../../../rest/glossaryAPI', () => ({
  getGlossaryTermsById: jest.fn(),
}));

const mockGetGlossaryTermsById = getGlossaryTermsById as jest.MockedFunction<
  typeof getGlossaryTermsById
>;

const VALID_UUID = '12345678-1234-1234-1234-123456789abc';
const OTHER_UUID = 'abcdef01-2345-6789-abcd-ef0123456789';

const term = (id: string, name: string): GlossaryTerm =>
  ({ id, name } as GlossaryTerm);

describe('useOntologyTermDetails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips fetch and leaves termDetails null when termId is not a valid UUID', () => {
    const { result } = renderHook(() => useOntologyTermDetails('not-a-uuid'));

    expect(result.current.termDetails).toBeNull();
    expect(mockGetGlossaryTermsById).not.toHaveBeenCalled();
  });

  it('fetches with conceptMappings and attributes fields and sets termDetails on success', async () => {
    const fetched = term(VALID_UUID, 'term-1');
    mockGetGlossaryTermsById.mockResolvedValue(fetched);

    const { result } = renderHook(() => useOntologyTermDetails(VALID_UUID));

    await waitFor(() => expect(result.current.termDetails).toBe(fetched));

    expect(mockGetGlossaryTermsById).toHaveBeenCalledWith(VALID_UUID, {
      fields: ['conceptMappings', 'attributes'],
    });
  });

  it('resets termDetails to null on fetch rejection', async () => {
    mockGetGlossaryTermsById.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useOntologyTermDetails(VALID_UUID));

    await waitFor(() =>
      expect(mockGetGlossaryTermsById).toHaveBeenCalledTimes(1)
    );

    expect(result.current.termDetails).toBeNull();
  });

  it('does not set stale state when termId changes before the fetch resolves', async () => {
    let resolveFirst: (value: GlossaryTerm) => void = () => undefined;
    const firstTerm = term(VALID_UUID, 'stale-term');
    const secondTerm = term(OTHER_UUID, 'fresh-term');

    mockGetGlossaryTermsById.mockImplementationOnce(
      () =>
        new Promise<GlossaryTerm>((resolve) => {
          resolveFirst = resolve;
        })
    );
    mockGetGlossaryTermsById.mockResolvedValueOnce(secondTerm);

    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useOntologyTermDetails(id),
      { initialProps: { id: VALID_UUID } }
    );

    rerender({ id: OTHER_UUID });

    await waitFor(() => expect(result.current.termDetails).toBe(secondTerm));

    await act(async () => {
      resolveFirst(firstTerm);
      await Promise.resolve();
    });

    expect(result.current.termDetails).toBe(secondTerm);
  });
});
