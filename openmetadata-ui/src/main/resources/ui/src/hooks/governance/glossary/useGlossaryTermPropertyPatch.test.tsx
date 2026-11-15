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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import {
  getGlossaryTermsById,
  patchGlossaryTerm,
} from '../../../rest/glossaryAPI';
import { GlossaryTermWithProperties } from '../../../utils/governance/glossary/GlossaryTermProperties.types';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useGlossaryTermPropertyPatch } from './useGlossaryTermPropertyPatch';

jest.mock('../../../rest/glossaryAPI', () => ({
  getGlossaryTermsById: jest.fn(),
  patchGlossaryTerm: jest.fn(),
}));

const badRequest = { response: { status: 400 } };
const guarded = (name: string) => [
  { op: 'test' as const, path: '/propertyDefinitions/0/name', value: name },
  { op: 'remove' as const, path: '/propertyDefinitions/0' },
];

const stale = {
  id: 't1',
  propertyDefinitions: [{ name: 'a', datatype: 'string' }],
} as unknown as GlossaryTermWithProperties;

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

describe('useGlossaryTermPropertyPatch', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rebuilds a name-guarded patch from a fresh copy when the definition list moved', async () => {
    (patchGlossaryTerm as jest.Mock)
      .mockRejectedValueOnce(badRequest)
      .mockResolvedValueOnce({});
    (getGlossaryTermsById as jest.Mock).mockResolvedValue({
      id: 't1',
      propertyDefinitions: [
        { name: 'new', datatype: 'string' },
        { name: 'a', datatype: 'string' },
      ],
    });
    const { result } = renderHook(() => useGlossaryTermPropertyPatch(stale), {
      wrapper,
    });
    const build = jest.fn((term: GlossaryTermWithProperties) => {
      const index = term.propertyDefinitions?.findIndex(
        (definition) => definition.name === 'a'
      );

      return [
        {
          op: 'test' as const,
          path: `/propertyDefinitions/${index}/name`,
          value: 'a',
        },
        { op: 'remove' as const, path: `/propertyDefinitions/${index}` },
      ];
    });

    let saved: boolean | undefined;
    await act(async () => {
      saved = await result.current.applyPatch(build);
    });

    expect(saved).toBe(true);
    expect(patchGlossaryTerm).toHaveBeenNthCalledWith(1, 't1', [
      { op: 'test', path: '/propertyDefinitions/0/name', value: 'a' },
      { op: 'remove', path: '/propertyDefinitions/0' },
    ]);
    expect(patchGlossaryTerm).toHaveBeenNthCalledWith(2, 't1', [
      { op: 'test', path: '/propertyDefinitions/1/name', value: 'a' },
      { op: 'remove', path: '/propertyDefinitions/1' },
    ]);
  });

  it('reports a 400 that is not a moved list instead of retrying', async () => {
    (patchGlossaryTerm as jest.Mock).mockRejectedValue(badRequest);
    (getGlossaryTermsById as jest.Mock).mockResolvedValue({
      id: 't1',
      propertyDefinitions: stale.propertyDefinitions,
    });
    const { result } = renderHook(() => useGlossaryTermPropertyPatch(stale), {
      wrapper,
    });

    let saved: boolean | undefined;
    await act(async () => {
      saved = await result.current.applyPatch(() => guarded('a'));
    });

    expect(saved).toBe(false);
    expect(patchGlossaryTerm).toHaveBeenCalledTimes(1);
    expect(showErrorToast).toHaveBeenCalledWith(badRequest);
  });

  it('shows a 409 conflict message without refetching', async () => {
    const conflict = {
      response: { status: 409, data: { message: 'names Phone' } },
    };
    (patchGlossaryTerm as jest.Mock).mockRejectedValue(conflict);
    const { result } = renderHook(() => useGlossaryTermPropertyPatch(stale), {
      wrapper,
    });

    await act(async () => {
      await result.current.applyPatch(() => guarded('a'));
    });

    expect(getGlossaryTermsById).not.toHaveBeenCalled();
    expect(showErrorToast).toHaveBeenCalledWith(conflict);
  });

  it('drops the stale definitions when the fresh copy omits the emptied list', async () => {
    (patchGlossaryTerm as jest.Mock).mockRejectedValueOnce(badRequest);
    (getGlossaryTermsById as jest.Mock).mockResolvedValue({ id: 't1' });
    const { result } = renderHook(() => useGlossaryTermPropertyPatch(stale), {
      wrapper,
    });
    const build = jest.fn((term: GlossaryTermWithProperties) =>
      term.propertyDefinitions?.some((definition) => definition.name === 'a')
        ? guarded('a')
        : []
    );

    let saved: boolean | undefined;
    await act(async () => {
      saved = await result.current.applyPatch(build);
    });

    expect(saved).toBe(true);
    expect(patchGlossaryTerm).toHaveBeenCalledTimes(1);
    expect(build).toHaveBeenLastCalledWith(
      expect.objectContaining({ propertyDefinitions: undefined })
    );
  });

  it('stops after three rebuilds', async () => {
    (patchGlossaryTerm as jest.Mock).mockRejectedValue(badRequest);
    let version = 0;
    (getGlossaryTermsById as jest.Mock).mockImplementation(async () => ({
      id: 't1',
      propertyDefinitions: [{ name: `v${(version += 1)}`, datatype: 'string' }],
    }));
    const { result } = renderHook(() => useGlossaryTermPropertyPatch(stale), {
      wrapper,
    });

    await act(async () => {
      await result.current.applyPatch(() => guarded('a'));
    });

    expect(patchGlossaryTerm).toHaveBeenCalledTimes(4);
  });
});
