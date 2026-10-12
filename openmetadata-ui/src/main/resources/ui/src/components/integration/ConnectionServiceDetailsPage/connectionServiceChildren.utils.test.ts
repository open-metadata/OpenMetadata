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
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { ServiceCategory } from '../../../enums/service.enum';
import { Include } from '../../../generated/type/include';
import { getDataModels } from '../../../rest/dashboardAPI';
import { getDatabases } from '../../../rest/databaseAPI';
import { getDriveAssets } from '../../../rest/driveAPI';
import { getSearchIndexes } from '../../../rest/SearchIndexAPI';
import { getContainers } from '../../../rest/storageAPI';
import {
  fetchServiceChildren,
  fetchServiceTabCounts,
} from './connectionServiceChildren.utils';

const RESPONSE = { data: [], paging: { total: 0 } };

jest.mock('../../../rest/apiCollectionsAPI', () => ({
  getApiCollections: jest.fn(),
}));
jest.mock('../../../rest/dashboardAPI', () => ({
  getDashboards: jest.fn(),
  getDataModels: jest.fn(),
}));
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

describe('fetchServiceTabCounts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('counts the data models of a dashboard service', async () => {
    (getDataModels as jest.Mock).mockResolvedValueOnce({
      data: [],
      paging: { total: 173 },
    });

    await expect(
      fetchServiceTabCounts(
        ServiceCategory.DASHBOARD_SERVICES,
        'svc',
        Include.Deleted
      )
    ).resolves.toEqual({ [EntityTabs.DATA_Model]: 173 });

    expect(getDataModels).toHaveBeenCalledWith({
      service: 'svc',
      include: Include.Deleted,
      limit: 0,
    });
  });

  it('counts the top-level files and spreadsheets of a drive service', async () => {
    (getDriveAssets as jest.Mock).mockImplementation((entityType) =>
      Promise.resolve({
        data: [],
        paging: { total: entityType === EntityType.FILE ? 4 : 2 },
      })
    );

    await expect(
      fetchServiceTabCounts(
        ServiceCategory.DRIVE_SERVICES,
        'svc',
        Include.NonDeleted
      )
    ).resolves.toEqual({
      [EntityTabs.FILES]: 4,
      [EntityTabs.SPREADSHEETS]: 2,
    });

    // Files and spreadsheets inside a directory belong to that directory's page, not the service's.
    expect(getDriveAssets).toHaveBeenCalledWith(EntityType.FILE, {
      service: 'svc',
      root: true,
      include: Include.NonDeleted,
      paging: { limit: 0 },
    });
    expect(getDriveAssets).toHaveBeenCalledWith(EntityType.SPREADSHEET, {
      service: 'svc',
      root: true,
      include: Include.NonDeleted,
      paging: { limit: 0 },
    });
  });

  it('counts nothing for a category without extra tabs', async () => {
    await expect(
      fetchServiceTabCounts(
        ServiceCategory.DATABASE_SERVICES,
        'svc',
        Include.NonDeleted
      )
    ).resolves.toEqual({});

    expect(getDataModels).not.toHaveBeenCalled();
    expect(getDriveAssets).not.toHaveBeenCalled();
  });
});
