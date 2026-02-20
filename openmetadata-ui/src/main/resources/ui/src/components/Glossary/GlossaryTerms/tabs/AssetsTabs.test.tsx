/*
 *  Copyright 2024 Collate.
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

import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../../../../generated/entity/policies/policy';
import { searchQuery } from '../../../../rest/searchAPI';
import * as SearchUtils from '../../../../utils/SearchUtils';
import * as StringsUtils from '../../../../utils/StringsUtils';
import * as TagsUtils from '../../../../utils/TagsUtils';
import AssetsTabs from './AssetsTabs.component';
import { AssetsOfEntity } from './AssetsTabs.interface';

const buildOperationPermission = (
  overrides: Partial<Record<Operation, boolean>> = {}
): OperationPermission => {
  const permission = {} as OperationPermission;

  Object.values(Operation).forEach((operation) => {
    permission[operation] = overrides[operation] ?? false;
  });

  return permission;
};

const mockPermissions = buildOperationPermission({
  Create: true,
  EditAll: true,
  Delete: true,
});

const mockSearchResponse = {
  hits: {
    hits: [],
    total: { value: 0 },
  },
  aggregations: {},
};

jest.mock('../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn().mockResolvedValue({
    hits: {
      hits: [],
      total: { value: 0 },
    },
    aggregations: {},
  }),
}));

jest.mock('../../../../rest/glossaryAPI', () => ({
  getGlossaryTermByFQN: jest.fn().mockResolvedValue({}),
  removeAssetsFromGlossaryTerm: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../../rest/domainAPI', () => ({
  getDomainByName: jest.fn().mockResolvedValue({}),
  removeAssetsFromDomain: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../../rest/dataProductAPI', () => ({
  getDataProductByName: jest.fn().mockResolvedValue({}),
  removeAssetsFromDataProduct: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../../rest/tagAPI', () => ({
  getTagByFqn: jest.fn().mockResolvedValue({}),
  removeAssetsFromTags: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../common/SearchBarComponent/SearchBar.component', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => <div>Searchbar.component</div>),
}));

jest.mock('../../../common/NextPrevious/NextPrevious', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(() => <div>NextPrevious.component</div>),
}));

jest.mock('../../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(() => <div>ErrorPlaceHolder.component</div>),
}));

jest.mock('../../../common/ErrorWithPlaceholder/ErrorPlaceHolderNew', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(() => <div>ErrorPlaceHolderNew.component</div>),
}));

jest.mock('../../../Explore/ExploreQuickFilters', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(() => <div>ExploreQuickFilters.component</div>),
}));

jest.mock('../../../ExploreV1/ExploreSearchCard/ExploreSearchCard', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(() => <div>ExploreSearchCard.component</div>),
}));

jest.mock('../../../Modals/ConfirmationModal/ConfirmationModal', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(() => <div>ConfirmationModal.component</div>),
}));

jest.mock('../../../../hooks/useCustomLocation/useCustomLocation', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({
    pathname: '/',
    search: '',
    hash: '',
    state: null,
  }),
}));

const mockGetTermQuery = jest.fn();
const mockGetEncodedFqn = jest.fn((fqn) => fqn);
const mockEscapeESReservedCharacters = jest.fn((fqn) => fqn);
const mockGetTagAssetsQueryFilter = jest.fn();

jest.spyOn(SearchUtils, 'getTermQuery').mockImplementation(mockGetTermQuery);
jest.spyOn(StringsUtils, 'getEncodedFqn').mockImplementation(mockGetEncodedFqn);
jest
  .spyOn(StringsUtils, 'escapeESReservedCharacters')
  .mockImplementation(mockEscapeESReservedCharacters);
jest
  .spyOn(TagsUtils, 'getTagAssetsQueryFilter')
  .mockImplementation(mockGetTagAssetsQueryFilter);

const mockOnAddAsset = jest.fn();
const mockOnAssetClick = jest.fn();
const mockOnRemoveAsset = jest.fn();

const defaultProps = {
  permissions: mockPermissions,
  isEntityDeleted: false,
  isSummaryPanelOpen: false,
  onAddAsset: mockOnAddAsset,
  onAssetClick: mockOnAssetClick,
  onRemoveAsset: mockOnRemoveAsset,
};

const renderWithRouter = (component: React.ReactElement) => {
  return render(<MemoryRouter>{component}</MemoryRouter>);
};

describe('AssetsTabs queryParam logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (searchQuery as jest.Mock).mockResolvedValue(mockSearchResponse);
  });

  describe('DOMAIN type', () => {
    it('should use domain FQN query with mustNotTerms for dataProduct', async () => {
      const entityFqn = 'test.domain';
      mockGetTermQuery.mockReturnValue({ query: 'mock-domain-query' });

      renderWithRouter(
        <AssetsTabs
          {...defaultProps}
          entityFqn={entityFqn}
          type={AssetsOfEntity.DOMAIN}
        />
      );

      await waitFor(() => {
        expect(mockGetTermQuery).toHaveBeenCalledWith(
          { 'domains.fullyQualifiedName': entityFqn },
          'must',
          undefined,
          {
            mustNotTerms: { entityType: 'dataProduct' },
          }
        );
      });
    });

    it('should use queryFilter prop if provided for DOMAIN type', async () => {
      const customQueryFilter = { custom: 'filter' };

      renderWithRouter(
        <AssetsTabs
          {...defaultProps}
          entityFqn="test.domain"
          queryFilter={customQueryFilter}
          type={AssetsOfEntity.DOMAIN}
        />
      );

      await waitFor(() => {
        expect(searchQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            queryFilter: customQueryFilter,
          })
        );
      });
    });
  });

  describe('DATA_PRODUCT type', () => {
    it('should use dataProducts.fullyQualifiedName query', async () => {
      const entityFqn = 'test.dataproduct';
      mockGetTermQuery.mockReturnValue({ query: 'mock-dataproduct-query' });

      renderWithRouter(
        <AssetsTabs
          {...defaultProps}
          entityFqn={entityFqn}
          type={AssetsOfEntity.DATA_PRODUCT}
        />
      );

      await waitFor(() => {
        expect(mockGetTermQuery).toHaveBeenCalledWith({
          'dataProducts.fullyQualifiedName': entityFqn,
        });
      });
    });
  });

  describe('GLOSSARY type', () => {
    it('should use tags.tagFQN query for glossary terms', async () => {
      const entityFqn = 'glossary.term';
      mockGetTermQuery.mockReturnValue({ query: 'mock-glossary-query' });

      renderWithRouter(
        <AssetsTabs
          {...defaultProps}
          entityFqn={entityFqn}
          type={AssetsOfEntity.GLOSSARY}
        />
      );

      await waitFor(() => {
        expect(mockGetTermQuery).toHaveBeenCalledWith({
          'tags.tagFQN': entityFqn,
        });
      });
    });
  });

  describe('TAG type', () => {
    it('should call getTagAssetsQueryFilter with unencoded FQN', async () => {
      const entityFqn = 'classification.tag';
      mockGetTagAssetsQueryFilter.mockReturnValue({ query: 'mock-tag-query' });

      renderWithRouter(
        <AssetsTabs
          {...defaultProps}
          entityFqn={entityFqn}
          type={AssetsOfEntity.TAG}
        />
      );

      await waitFor(() => {
        expect(mockGetTagAssetsQueryFilter).toHaveBeenCalledWith(entityFqn);
      });
    });

    it('should use unencoded FQN for TAG type', async () => {
      const entityFqn = 'classification.tag';
      mockGetTagAssetsQueryFilter.mockReturnValue({ query: 'mock-tag-query' });

      renderWithRouter(
        <AssetsTabs
          {...defaultProps}
          entityFqn={entityFqn}
          type={AssetsOfEntity.TAG}
        />
      );

      await waitFor(() => {
        expect(mockGetTagAssetsQueryFilter).toHaveBeenCalledWith(entityFqn);
      });
    });
  });

  describe('TEAM, MY_DATA, FOLLOWING types', () => {
    it('should use queryFilter prop for TEAM type', async () => {
      const customQueryFilter = { team: 'filter' };

      renderWithRouter(
        <AssetsTabs
          {...defaultProps}
          queryFilter={customQueryFilter}
          type={AssetsOfEntity.TEAM}
        />
      );

      await waitFor(() => {
        expect(searchQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            queryFilter: customQueryFilter,
          })
        );
      });
    });

    it('should use undefined queryFilter if not provided for MY_DATA type', async () => {
      renderWithRouter(
        <AssetsTabs {...defaultProps} type={AssetsOfEntity.MY_DATA} />
      );

      await waitFor(() => {
        expect(searchQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            queryFilter: undefined,
          })
        );
      });
    });

    it('should use queryFilter prop for FOLLOWING type', async () => {
      const customQueryFilter = { following: 'filter' };

      renderWithRouter(
        <AssetsTabs
          {...defaultProps}
          queryFilter={customQueryFilter}
          type={AssetsOfEntity.FOLLOWING}
        />
      );

      await waitFor(() => {
        expect(searchQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            queryFilter: customQueryFilter,
          })
        );
      });
    });
  });

  describe('Default case', () => {
    it('should use encoded FQN with getTagAssetsQueryFilter for unknown types', async () => {
      const entityFqn = 'test.entity';
      const encodedFqn = 'encoded.test.entity';
      mockEscapeESReservedCharacters.mockReturnValue(entityFqn);
      mockGetEncodedFqn.mockReturnValue(encodedFqn);
      mockGetTagAssetsQueryFilter.mockReturnValue({
        query: 'mock-default-query',
      });

      renderWithRouter(
        <AssetsTabs
          {...defaultProps}
          entityFqn={entityFqn}
          type={'UNKNOWN_TYPE' as AssetsOfEntity}
        />
      );

      await waitFor(() => {
        expect(mockEscapeESReservedCharacters).toHaveBeenCalledWith(entityFqn);
        expect(mockGetEncodedFqn).toHaveBeenCalledWith(entityFqn);
        expect(mockGetTagAssetsQueryFilter).toHaveBeenCalledWith(encodedFqn);
      });
    });
  });

  describe('queryParam changes', () => {
    it('should update queryParam when entityFqn changes', async () => {
      const { rerender } = renderWithRouter(
        <AssetsTabs
          {...defaultProps}
          entityFqn="initial.fqn"
          type={AssetsOfEntity.GLOSSARY}
        />
      );

      await waitFor(() => {
        expect(mockGetTermQuery).toHaveBeenCalledWith({
          'tags.tagFQN': 'initial.fqn',
        });
      });

      mockGetTermQuery.mockClear();

      rerender(
        <MemoryRouter>
          <AssetsTabs
            {...defaultProps}
            entityFqn="updated.fqn"
            type={AssetsOfEntity.GLOSSARY}
          />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockGetTermQuery).toHaveBeenCalledWith({
          'tags.tagFQN': 'updated.fqn',
        });
      });
    });

    it('should update queryParam when type changes', async () => {
      const entityFqn = 'test.entity';
      const { rerender } = renderWithRouter(
        <AssetsTabs
          {...defaultProps}
          entityFqn={entityFqn}
          type={AssetsOfEntity.GLOSSARY}
        />
      );

      await waitFor(() => {
        expect(mockGetTermQuery).toHaveBeenCalledWith({
          'tags.tagFQN': entityFqn,
        });
      });

      mockGetTermQuery.mockClear();

      rerender(
        <MemoryRouter>
          <AssetsTabs
            {...defaultProps}
            entityFqn={entityFqn}
            type={AssetsOfEntity.DATA_PRODUCT}
          />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockGetTermQuery).toHaveBeenCalledWith({
          'dataProducts.fullyQualifiedName': entityFqn,
        });
      });
    });
  });

  describe('Empty entityFqn handling', () => {
    it('should handle empty entityFqn for DOMAIN type', async () => {
      mockGetTermQuery.mockReturnValue({ query: 'mock-empty-query' });

      renderWithRouter(
        <AssetsTabs
          {...defaultProps}
          entityFqn=""
          type={AssetsOfEntity.DOMAIN}
        />
      );

      await waitFor(() => {
        expect(mockGetTermQuery).toHaveBeenCalledWith(
          { 'domains.fullyQualifiedName': '' },
          'must',
          undefined,
          {
            mustNotTerms: { entityType: 'dataProduct' },
          }
        );
      });
    });

    it('should handle undefined entityFqn for GLOSSARY type', async () => {
      mockGetTermQuery.mockReturnValue({ query: 'mock-undefined-query' });

      renderWithRouter(
        <AssetsTabs {...defaultProps} type={AssetsOfEntity.GLOSSARY} />
      );

      await waitFor(() => {
        expect(mockGetTermQuery).toHaveBeenCalledWith({
          'tags.tagFQN': '',
        });
      });
    });
  });
});
