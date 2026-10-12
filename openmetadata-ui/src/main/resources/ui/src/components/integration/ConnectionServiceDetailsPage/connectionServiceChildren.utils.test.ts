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
import { EntityType } from '../../../enums/entity.enum';
import { ServiceCategory } from '../../../enums/service.enum';
import { Include } from '../../../generated/type/include';
import { getDatabases } from '../../../rest/databaseAPI';
import { getDriveAssets } from '../../../rest/driveAPI';
import { getSearchIndexes } from '../../../rest/SearchIndexAPI';
import { getContainers } from '../../../rest/storageAPI';
import { fetchServiceChildren } from './connectionServiceChildren.utils';

const RESPONSE = { data: [], paging: { total: 0 } };

jest.mock('../../../rest/apiCollectionsAPI', () => ({
  getApiCollections: jest.fn(),
}));
jest.mock('../../../rest/dashboardAPI', () => ({ getDashboards: jest.fn() }));
jest.mock('../../../rest/databaseAPI', () => ({
  getDatabases: jest.fn(() => Promise.resolve(RESPONSE)),
}));
jest.mock('../../../rest/driveAPI', () => ({
  getDriveAssets: jest.fn(() => Promise.resolve(RESPONSE)),
}));
jest.mock('../../../rest/mlModelAPI', () => ({ getMlModels: jest.fn() }));
jest.mock('../../../rest/pipelineAPI', () => ({ getPipelines: jest.fn() }));
jest.mock('../../../rest/SearchIndexAPI', () => ({
  getSearchIndexes: jest.fn(() => Promise.resolve(RESPONSE)),
}));
jest.mock('../../../rest/storageAPI', () => ({
  getContainers: jest.fn(() => Promise.resolve(RESPONSE)),
}));
jest.mock('../../../rest/topicsAPI', () => ({ getTopics: jest.fn() }));

const PARAMS = {
  service: 'svc',
  fields: 'owners,tags',
  paging: { after: 'cursor', limit: 15 },
  include: Include.NonDeleted,
};

describe('fetchServiceChildren', () => {
  it('passes paging and include through for databases', async () => {
    await expect(
      fetchServiceChildren(ServiceCategory.DATABASE_SERVICES, PARAMS)
    ).resolves.toBe(RESPONSE);

    expect(getDatabases).toHaveBeenCalledWith(
      'svc',
      'owners,tags',
      PARAMS.paging,
      Include.NonDeleted
    );
  });

  it.each([
    [ServiceCategory.STORAGE_SERVICES, getContainers],
    [ServiceCategory.SEARCH_SERVICES, getSearchIndexes],
  ])('keeps %s to its top level', async (category, fetcher) => {
    await fetchServiceChildren(category, PARAMS);

    expect(fetcher).toHaveBeenCalledWith({ ...PARAMS, root: true });
  });

  it('lists the top-level directories of a drive service', async () => {
    await fetchServiceChildren(ServiceCategory.DRIVE_SERVICES, PARAMS);

    expect(getDriveAssets).toHaveBeenCalledWith(EntityType.DIRECTORY, {
      ...PARAMS,
      root: true,
    });
  });

  it('lists nothing for a category it does not know, inherited object keys included', () => {
    expect(
      fetchServiceChildren('constructor' as ServiceCategory, PARAMS)
    ).toBeUndefined();
  });

  it('lists nothing for a service category without child assets', () => {
    expect(
      fetchServiceChildren(ServiceCategory.METADATA_SERVICES, PARAMS)
    ).toBeUndefined();
  });
});
