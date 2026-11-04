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
import { act, renderHook, waitFor } from '@testing-library/react';
import { AxiosError, AxiosResponse } from 'axios';
import { ReactNode } from 'react';
import APIClient from '../../../rest/axiosClient';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useOntologyReleaseShacl } from './useOntologyReleaseShacl';

jest.mock('../../../rest/axiosClient', () => ({ get: jest.fn() }));
jest.mock('../../../utils/ToastUtils', () => ({ showErrorToast: jest.fn() }));

const mockGet = (APIClient as jest.Mocked<typeof APIClient>).get;

const report = (releaseId: string, violationCount: number) => ({
  releaseId,
  shacl: { findings: [], violationCount },
  valid: violationCount === 0,
});

const refusal = (body: string) =>
  new AxiosError('Unprocessable', 'ERR_BAD_REQUEST', undefined, undefined, {
    data: body,
    status: 422,
  } as AxiosResponse);

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('useOntologyReleaseShacl', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('reads the refusal report out of a 422 whose body arrives as a JSON string', async () => {
    mockGet.mockRejectedValueOnce(refusal(JSON.stringify(report('r1', 1))));
    const { result } = renderHook(() => useOntologyReleaseShacl('r1'), {
      wrapper,
    });

    act(() =>
      result.current.download({
        format: 'turtle',
        options: { shaclGate: true },
      })
    );

    await waitFor(() => expect(result.current.report?.valid).toBe(false));

    expect(result.current.report?.shacl.violationCount).toBe(1);
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it('reports a refusal body that is not JSON as an ordinary error', async () => {
    mockGet.mockRejectedValueOnce(refusal('<html>gateway</html>'));
    const { result } = renderHook(() => useOntologyReleaseShacl('r1'), {
      wrapper,
    });

    act(() =>
      result.current.download({
        format: 'turtle',
        options: { shaclGate: true },
      })
    );

    await waitFor(() => expect(showErrorToast).toHaveBeenCalledTimes(1));

    expect(result.current.report).toBeUndefined();
  });

  it('drops the report of a release that is no longer the active one', async () => {
    mockGet.mockResolvedValueOnce({ data: report('r1', 1) });
    const { result, rerender } = renderHook(
      ({ releaseId }) => useOntologyReleaseShacl(releaseId),
      { initialProps: { releaseId: 'r1' }, wrapper }
    );
    act(() => result.current.run());
    await waitFor(() => expect(result.current.report?.releaseId).toBe('r1'));

    rerender({ releaseId: 'r2' });

    expect(result.current.report).toBeUndefined();
  });
});
