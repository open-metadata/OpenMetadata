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

import { act, renderHook } from '@testing-library/react';
import axios from 'axios';
import { LabelType, State, TagSource } from '../../../../generated/type/tagLabel';
import tagClassBase from '../../../../utils/TagClassBase';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { RawTagResult } from '../../../Tag/TagSelector/TagSelector.utils';
import { useClassificationTreeData } from './useClassificationTreeData';

jest.mock('../../../../utils/TagClassBase', () => ({
  __esModule: true,
  default: { getTags: jest.fn() },
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('axios', () => ({
  isCancel: jest.fn(),
}));

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  Tag: jest.fn(() => null),
}));

const makeRawResult = (fqn: string): RawTagResult => ({
  label: fqn,
  value: fqn,
  data: {
    name: fqn.split('.').pop(),
    displayName: fqn.split('.').pop() + ' Display',
  },
});

describe('useClassificationTreeData', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns a stable callback reference across re-renders', () => {
    const { result, rerender } = renderHook(() => useClassificationTreeData());
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });

  it('transforms API results into TreeSelectNode array on success', async () => {
    const rawResults: RawTagResult[] = [
      makeRawResult('Personal.Email'),
      makeRawResult('Personal.SSN'),
    ];

    (tagClassBase.getTags as jest.Mock).mockResolvedValue({ data: rawResults });

    const { result } = renderHook(() => useClassificationTreeData());

    let nodes: ReturnType<typeof result.current> extends Promise<infer R>
      ? R extends { nodes: infer N }
        ? N
        : never
      : never = [];

    await act(async () => {
      const response = await result.current({ searchTerm: '' });

      nodes = response.nodes;
    });

    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toMatchObject({
      id: 'Personal.Email',
      value: 'Personal.Email',
      isLeaf: true,
      allowSelection: true,
    });
    expect(nodes[0].data).toMatchObject({
      tagFQN: 'Personal.Email',
      source: TagSource.Classification,
      labelType: LabelType.Manual,
      state: State.Confirmed,
    });
  });

  it('uses searchTerm when provided', async () => {
    (tagClassBase.getTags as jest.Mock).mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useClassificationTreeData());

    await act(async () => {
      await result.current({ searchTerm: 'personal' });
    });

    expect(tagClassBase.getTags).toHaveBeenCalledWith('personal', 1);
  });

  it('passes empty string when searchTerm is undefined', async () => {
    (tagClassBase.getTags as jest.Mock).mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useClassificationTreeData());

    await act(async () => {
      await result.current({});
    });

    expect(tagClassBase.getTags).toHaveBeenCalledWith('', 1);
  });

  it('calls showErrorToast and returns empty nodes on API error', async () => {
    const error = new Error('Network error');

    (tagClassBase.getTags as jest.Mock).mockRejectedValue(error);
    (
      axios.isCancel as jest.MockedFunction<typeof axios.isCancel>
    ).mockReturnValue(false);

    const { result } = renderHook(() => useClassificationTreeData());

    let nodes: unknown[] = ['non-empty'];

    await act(async () => {
      const response = await result.current({ searchTerm: '' });

      nodes = response.nodes;
    });

    expect(showErrorToast).toHaveBeenCalledWith(error);
    expect(nodes).toHaveLength(0);
  });

  it('re-throws without calling showErrorToast on cancellation', async () => {
    const cancelError = new Error('cancelled');

    (tagClassBase.getTags as jest.Mock).mockRejectedValue(cancelError);
    (
      axios.isCancel as jest.MockedFunction<typeof axios.isCancel>
    ).mockReturnValue(true);

    const { result } = renderHook(() => useClassificationTreeData());

    await act(async () => {
      await expect(result.current({ searchTerm: '' })).rejects.toThrow(
        'cancelled'
      );
    });

    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it('handles missing data field in response gracefully', async () => {
    (tagClassBase.getTags as jest.Mock).mockResolvedValue({ data: null });

    const { result } = renderHook(() => useClassificationTreeData());

    let nodes: unknown[] = [];

    await act(async () => {
      const response = await result.current({ searchTerm: '' });

      nodes = response.nodes;
    });

    expect(nodes).toHaveLength(0);
  });
});
