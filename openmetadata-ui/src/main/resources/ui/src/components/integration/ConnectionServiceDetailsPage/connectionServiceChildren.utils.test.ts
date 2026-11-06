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
  countServiceChildren,
  fetchServiceChildren,
  getSecondaryAssetTabs,
} from './connectionServiceChildren.utils';

const RESPONSE = { data: [], paging: { total: 0 } };
const COUNTED = { data: [], paging: { total: 12 } };

jest.mock('../../../rest/apiCollectionsAPI', () => ({
  getApiCollections: jest.fn(),
}));
jest.mock('../../../rest/dashboardAPI', () => ({
  getDashboards: jest.fn(),
  getDataModels: jest.fn(() => Promise.resolve(COUNTED)),
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

describe('countServiceChildren', () => {
  it('asks for the total alone, with no rows or fields', async () => {
    (getDatabases as jest.Mock).mockResolvedValueOnce(COUNTED);

    await expect(
      countServiceChildren(
        ServiceCategory.DATABASE_SERVICES,
        'svc',
        Include.Deleted
      )
    ).resolves.toBe(12);

    expect(getDatabases).toHaveBeenCalledWith(
      'svc',
      '',
      { limit: 0 },
      Include.Deleted
    );
  });

  it('counts nothing for a service category without child assets', async () => {
    await expect(
      countServiceChildren(
        ServiceCategory.METADATA_SERVICES,
        'svc',
        Include.NonDeleted
      )
    ).resolves.toBeUndefined();
  });
});

describe('getSecondaryAssetTabs', () => {
  const tabKeys = (category: ServiceCategory) =>
    getSecondaryAssetTabs(category).map(({ key }) => key);

  it('offers a dashboard service its data models, and a drive service its files and spreadsheets', () => {
    expect(tabKeys(ServiceCategory.DASHBOARD_SERVICES)).toEqual([
      EntityTabs.DATA_Model,
    ]);
    expect(tabKeys(ServiceCategory.DRIVE_SERVICES)).toEqual([
      EntityTabs.FILES,
      EntityTabs.SPREADSHEETS,
    ]);
  });

  it('offers none to other categories, inherited object keys included', () => {
    expect(tabKeys(ServiceCategory.DATABASE_SERVICES)).toEqual([]);
    expect(tabKeys('constructor' as ServiceCategory)).toEqual([]);
  });

  it("counts a dashboard service's data models", async () => {
    const [dataModels] = getSecondaryAssetTabs(
      ServiceCategory.DASHBOARD_SERVICES
    );

    await expect(dataModels.countAssets('svc', Include.Deleted)).resolves.toBe(
      12
    );
    expect(getDataModels).toHaveBeenCalledWith({
      service: 'svc',
      include: Include.Deleted,
      limit: 0,
    });
  });

  it.each([
    [0, EntityType.FILE],
    [1, EntityType.SPREADSHEET],
  ])(
    "counts a drive service's top-level assets (tab %i: %s)",
    async (index, entityType) => {
      (getDriveAssets as jest.Mock).mockResolvedValueOnce(COUNTED);
      const tab = getSecondaryAssetTabs(ServiceCategory.DRIVE_SERVICES)[index];

      await expect(tab.countAssets('svc', Include.NonDeleted)).resolves.toBe(
        12
      );
      expect(getDriveAssets).toHaveBeenLastCalledWith(entityType, {
        service: 'svc',
        root: true,
        paging: { limit: 0 },
        include: Include.NonDeleted,
      });
    }
  );
});
