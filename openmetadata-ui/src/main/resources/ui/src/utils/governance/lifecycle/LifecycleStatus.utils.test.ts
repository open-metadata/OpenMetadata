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
import { EntityLifecycleStages } from '../../../generated/api/governance/entityLifecycleStages';
import { getEntityLifecycleStages } from '../../../rest/metadataTypeAPI';
import {
  fetchLifecycleStatuses,
  lifecycleStatusAutocomplete,
  resolveLifecycleStatuses,
} from './LifecycleStatus.utils';

jest.mock('../../../rest/metadataTypeAPI');

const lifecycles: EntityLifecycleStages = {
  stages: ['Approved', 'In Review', 'Superseded', 'Invalidated'],
  entityTypes: [
    {
      entityType: 'table',
      stages: ['Approved', 'In Review'],
      transitions: [],
      stageWorkflows: [],
    },
    {
      entityType: 'contextMemory',
      stages: ['Approved', 'Superseded', 'Invalidated'],
      transitions: [],
      stageWorkflows: [],
    },
  ],
};

describe('entity-specific lifecycle statuses', () => {
  it('keeps memory-only values out of table filters', () => {
    expect(resolveLifecycleStatuses(lifecycles, ['table'])).toEqual([
      'Approved',
      'In Review',
    ]);
    expect(resolveLifecycleStatuses(lifecycles, ['contextMemory'])).toEqual([
      'Approved',
      'Invalidated',
      'Superseded',
    ]);
  });

  it('combines vocabularies for searches across entity types', () => {
    expect(
      resolveLifecycleStatuses(lifecycles, ['table', 'contextMemory'])
    ).toEqual(lifecycles.stages.slice().sort());
  });

  it('offers workflow writes only when every target type accepts the status', () => {
    expect(
      resolveLifecycleStatuses(
        lifecycles,
        ['table', 'contextMemory'],
        'intersection'
      )
    ).toEqual(['Approved']);
    expect(
      resolveLifecycleStatuses(lifecycles, ['table', 'unknown'], 'intersection')
    ).toEqual([]);
    expect(resolveLifecycleStatuses(lifecycles, [], 'intersection')).toEqual(
      []
    );
  });

  it('uses discovery for all entities and does not invent statuses for an unknown type', () => {
    expect(resolveLifecycleStatuses(lifecycles, ['all'])).toEqual(
      lifecycles.stages.slice().sort()
    );
    expect(resolveLifecycleStatuses(lifecycles, ['unknown'])).toEqual([]);
  });

  it('searches the selected entity vocabulary from lifecycle discovery', async () => {
    (
      getEntityLifecycleStages as jest.MockedFunction<
        typeof getEntityLifecycleStages
      >
    ).mockResolvedValue(lifecycles);
    const fetchOptions = lifecycleStatusAutocomplete(['contextMemory']);

    await expect(fetchOptions('super', 0)).resolves.toEqual({
      values: [{ value: 'Superseded', title: 'Superseded' }],
      hasMore: false,
    });
    await expect(
      lifecycleStatusAutocomplete(['table'])('super', 0)
    ).resolves.toEqual({ values: [], hasMore: false });
  });

  it('resolves workflow targets without requiring a search index', async () => {
    (
      getEntityLifecycleStages as jest.MockedFunction<
        typeof getEntityLifecycleStages
      >
    ).mockResolvedValue(lifecycles);

    await expect(
      fetchLifecycleStatuses(['table', 'contextMemory'], 'intersection')
    ).resolves.toEqual(['Approved']);
    expect(getEntityLifecycleStages).toHaveBeenLastCalledWith(undefined);
  });

  it('keeps asset-wide workflow choices scoped to data assets', async () => {
    (
      getEntityLifecycleStages as jest.MockedFunction<
        typeof getEntityLifecycleStages
      >
    ).mockResolvedValue({
      stages: ['Approved', 'In Review'],
      entityTypes: [lifecycles.entityTypes[0]],
    });

    await expect(
      fetchLifecycleStatuses(['dataAsset'], 'intersection')
    ).resolves.toEqual(['Approved', 'In Review']);
    expect(getEntityLifecycleStages).toHaveBeenLastCalledWith(['dataAsset']);
  });
});
