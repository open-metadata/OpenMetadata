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

import { renderHook, waitFor } from '@testing-library/react';
import { OnboardingPlaybook } from '../../../generated/entity/governance/onboardingPlaybook';
import { TargetEntityType } from '../../../generated/governance/intakeForm';
import { OnboardingProgress } from '../../../generated/governance/onboarding/onboardingProgress';
import { listOnboarding } from '../../../rest/governance/onboarding/Onboarding.api';
import { getOnboardingPlaybookForEntityType } from '../../../rest/governance/onboarding/OnboardingPlaybook.api';
import { useOnboardingRows } from './useOnboardingRows';

jest.mock('../../../rest/governance/onboarding/Onboarding.api', () => ({
  listOnboarding: jest.fn(),
}));
jest.mock('../../../rest/governance/onboarding/OnboardingPlaybook.api', () => ({
  getOnboardingPlaybookForEntityType: jest.fn(),
}));

const list = listOnboarding as jest.MockedFunction<typeof listOnboarding>;
const playbookOf = getOnboardingPlaybookForEntityType as jest.MockedFunction<
  typeof getOnboardingPlaybookForEntityType
>;

const playbook = {
  id: 'pb-1',
  name: 'dataProductPlaybook',
} as OnboardingPlaybook;
const boardRow = (id: string): OnboardingProgress =>
  ({
    entity: { id, type: 'dataProduct', name: id },
    stage: 'draft',
    steps: [],
  } as unknown as OnboardingProgress);

beforeEach(() => {
  jest.clearAllMocks();
  playbookOf.mockResolvedValue(playbook);
  list.mockResolvedValue({ data: [] });
});

describe('useOnboardingRows', () => {
  it('hydrates a whole page in one request, keyed by entity id', async () => {
    list.mockResolvedValue({ data: [boardRow('a'), boardRow('b')] });
    const { result } = renderHook(() =>
      useOnboardingRows(TargetEntityType.DataProduct, ['a', 'b'])
    );

    await waitFor(() =>
      expect(Object.keys(result.current.rows)).toHaveLength(2)
    );

    expect(list).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledWith(
      { entityType: 'dataProduct', entityId: ['a', 'b'] },
      expect.anything()
    );
    expect(result.current.rows.a.entity?.id).toBe('a');
  });

  it('asks for nothing when the asset type has no playbook', async () => {
    playbookOf.mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useOnboardingRows(TargetEntityType.DataProduct, ['a'])
    );

    await waitFor(() => expect(result.current.isPlaybookLoading).toBe(false));

    expect(result.current.playbook).toBeUndefined();
    expect(list).not.toHaveBeenCalled();
  });

  it('asks for nothing when the page is empty', async () => {
    const { result } = renderHook(() =>
      useOnboardingRows(TargetEntityType.DataProduct, [])
    );

    await waitFor(() => expect(result.current.isPlaybookLoading).toBe(false));

    expect(list).not.toHaveBeenCalled();
  });

  it('does not refetch when the same page renders again in a different order', async () => {
    const { result, rerender } = renderHook(
      ({ ids }) => useOnboardingRows(TargetEntityType.DataProduct, ids),
      { initialProps: { ids: ['a', 'b'] } }
    );

    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));

    rerender({ ids: ['b', 'a'] });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(list).toHaveBeenCalledTimes(1);
  });

  it('fetches again when the page changes', async () => {
    const { rerender } = renderHook(
      ({ ids }) => useOnboardingRows(TargetEntityType.DataProduct, ids),
      { initialProps: { ids: ['a'] } }
    );

    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));

    rerender({ ids: ['c'] });

    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));

    expect(list).toHaveBeenLastCalledWith(
      { entityType: 'dataProduct', entityId: ['c'] },
      expect.anything()
    );
  });

  it('leaves the list usable when onboarding is unavailable', async () => {
    list.mockRejectedValue(new Error('board unavailable'));
    const { result } = renderHook(() =>
      useOnboardingRows(TargetEntityType.DataProduct, ['a'])
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.rows).toEqual({});
  });

  it('drops a row the server returned without an entity', async () => {
    list.mockResolvedValue({
      data: [
        boardRow('a'),
        { stage: 'draft', steps: [] } as unknown as OnboardingProgress,
      ],
    });
    const { result } = renderHook(() =>
      useOnboardingRows(TargetEntityType.DataProduct, ['a', 'b'])
    );

    await waitFor(() =>
      expect(Object.keys(result.current.rows)).toEqual(['a'])
    );
  });
});
