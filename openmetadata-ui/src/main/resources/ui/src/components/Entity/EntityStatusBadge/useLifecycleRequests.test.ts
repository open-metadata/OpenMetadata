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
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import { getRequestableStages } from '../../../rest/metadataTypeAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useLifecycleRequests } from './useLifecycleRequests';

jest.mock('../../../rest/metadataTypeAPI', () => ({
  getRequestableStages: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

type Options = Parameters<typeof useLifecycleRequests>[0];

const renderRequests = (overrides: Partial<Options> = {}) => {
  const onRequest = jest.fn().mockResolvedValue(undefined);
  const hook = renderHook((props: Options) => useLifecycleRequests(props), {
    initialProps: {
      entityType: 'domain',
      entityId: 'domain-id',
      entityStatus: EntityStatus.Approved,
      canRequest: true,
      onRequest,
      ...overrides,
    },
  });

  return { ...hook, onRequest };
};

describe('useLifecycleRequests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getRequestableStages as jest.Mock).mockResolvedValue([
      'Archived',
      'Deprecated',
    ]);
  });

  it("offers the stages the asset's own lifecycle takes requests for", async () => {
    const { result } = renderRequests();

    await waitFor(() => expect(result.current.stages).toHaveLength(2));

    expect(getRequestableStages).toHaveBeenCalledWith('domain', 'domain-id');
    expect(result.current.stages).toEqual([
      EntityStatus.Archived,
      EntityStatus.Deprecated,
    ]);
  });

  it('sends the request for the stage chosen', async () => {
    const { result, onRequest } = renderRequests();

    await act(async () => result.current.request(EntityStatus.Deprecated));

    expect(onRequest).toHaveBeenCalledWith(EntityStatus.Deprecated);
  });

  it('reads the offer again once the asset moves to another stage', async () => {
    const { result, rerender, onRequest } = renderRequests();

    await waitFor(() => expect(result.current.stages).toHaveLength(2));

    (getRequestableStages as jest.Mock).mockResolvedValue(['Archived']);
    rerender({
      entityType: 'domain',
      entityId: 'domain-id',
      entityStatus: EntityStatus.Deprecated,
      canRequest: true,
      onRequest,
    });

    await waitFor(() =>
      expect(result.current.stages).toEqual([EntityStatus.Archived])
    );

    expect(getRequestableStages).toHaveBeenCalledTimes(2);
  });

  it('offers nothing while a request is pending', async () => {
    const { result } = renderRequests({
      lifecycleRequest: EntityStatus.Deprecated,
    });

    await act(async () => Promise.resolve());

    expect(result.current.stages).toEqual([]);
  });

  it('asks nothing for a user who may not edit the asset', async () => {
    const { result } = renderRequests({ canRequest: false });

    await act(async () => Promise.resolve());

    expect(getRequestableStages).not.toHaveBeenCalled();
    expect(result.current.stages).toEqual([]);
  });

  it('offers nothing when the offer cannot be read', async () => {
    (getRequestableStages as jest.Mock).mockRejectedValue(new Error('down'));
    const { result } = renderRequests();

    await act(async () => Promise.resolve());

    expect(result.current.stages).toEqual([]);
  });

  it('shows the error when the server refuses the request', async () => {
    const error = new Error('does not move it to Deprecated on request');
    const { result, onRequest } = renderRequests();
    onRequest.mockRejectedValue(error);

    await act(async () => result.current.request(EntityStatus.Deprecated));

    expect(showErrorToast).toHaveBeenCalledWith(error);
  });
});
