/*
 *  Copyright 2025 Collate.
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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { CURATED_ASSETS_LIST } from '../../../../../constants/AdvancedSearch.constants';
import { EntityType } from '../../../../../enums/entity.enum';
import { CuratedAssetsConfig } from '../CuratedAssetsModal/CuratedAssetsModal.interface';
import { SelectAssetTypeField } from './SelectAssetTypeField.component';

const mockOnChangeSearchIndex = jest.fn();

jest.mock(
  '../../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.component',
  () => ({
    useAdvanceSearch: jest.fn().mockImplementation(() => ({
      config: {},
      onChangeSearchIndex: mockOnChangeSearchIndex,
    })),
  })
);

jest.mock('../../../../../utils/SearchClassBase', () => ({
  __esModule: true,
  default: {
    getEntityTypeSearchIndexMapping: jest.fn().mockReturnValue({
      all: 'all',
      table: 'table_search_index',
      dashboard: 'dashboard_search_index',
    }),
    getEntityIconWithBg: jest.fn().mockReturnValue(null),
  },
}));

const mockFetchEntityCount = jest.fn().mockResolvedValue(undefined);

const ResourcesValue = () => {
  const resources = useWatch<CuratedAssetsConfig, 'resources'>({
    name: 'resources',
  });

  return <span data-testid="resources-value">{JSON.stringify(resources)}</span>;
};

const Wrapper = ({
  children,
  resources,
}: {
  children: ReactNode;
  resources: string[];
}) => {
  const form = useForm<CuratedAssetsConfig>({ defaultValues: { resources } });

  return (
    <FormProvider {...form}>
      {children}
      <ResourcesValue />
    </FormProvider>
  );
};

const renderField = (resources: string[] = [EntityType.TABLE]) =>
  render(
    <Wrapper resources={resources}>
      <SelectAssetTypeField
        fetchEntityCount={mockFetchEntityCount}
        selectedAssetsInfo={{ resourceCount: 0, resourcesWithNonZeroCount: [] }}
      />
    </Wrapper>
  );

const openTree = async () => {
  fireEvent.click(screen.getByTestId('asset-type-select'));
  await screen.findByTestId(`tree-node-${EntityType.ALL}`);
};

const clickNode = async (id: string) => {
  await act(async () => {
    fireEvent.click(screen.getByTestId(`tree-node-${id}`));
  });
};

const getResources = () =>
  JSON.parse(screen.getByTestId('resources-value').textContent ?? '[]');

describe('SelectAssetTypeField', () => {
  beforeAll(() => {
    global.ResizeObserver = class {
      observe() {
        return;
      }

      unobserve() {
        return;
      }

      disconnect() {
        return;
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the asset type label', () => {
    renderField();

    expect(screen.getAllByText('label.select-asset-type')).not.toHaveLength(0);
  });

  it('counts the selected resources and points the search index at them on mount', () => {
    renderField();

    expect(mockFetchEntityCount).toHaveBeenCalledWith({
      countKey: 'resourceCount',
      selectedResource: [EntityType.TABLE],
      shouldUpdateResourceList: false,
    });
    expect(mockOnChangeSearchIndex).toHaveBeenCalledWith([
      'table_search_index',
    ]);
  });

  it('does not count when nothing is selected', () => {
    renderField([]);

    expect(mockFetchEntityCount).not.toHaveBeenCalled();
  });

  it('adds a picked asset type to the form value', async () => {
    renderField();
    await openTree();
    await clickNode(EntityType.DASHBOARD);

    expect(getResources()).toEqual([EntityType.TABLE, EntityType.DASHBOARD]);
  });

  it('stores "all" when the All node is picked', async () => {
    renderField([]);
    await openTree();
    await clickNode(EntityType.ALL);

    expect(getResources()).toEqual([EntityType.ALL]);
  });

  it('expands "all" to the remaining types when one child is unchecked', async () => {
    renderField([EntityType.ALL]);
    await openTree();
    await clickNode(EntityType.TABLE);

    expect(getResources()).toEqual(
      CURATED_ASSETS_LIST.filter(
        (type) => type !== EntityType.ALL && type !== EntityType.TABLE
      )
    );
  });

  it('collapses to "all" once the last unchecked type is picked', async () => {
    renderField(
      CURATED_ASSETS_LIST.filter(
        (type) => type !== EntityType.ALL && type !== EntityType.TABLE
      )
    );
    await openTree();
    await clickNode(EntityType.TABLE);

    expect(getResources()).toEqual([EntityType.ALL]);
  });

  it('shows a single chip when every type is selected', async () => {
    renderField([EntityType.ALL]);
    await openTree();

    expect(screen.getByTestId(`${EntityType.ALL}-selected`)).toBeVisible();
    expect(
      screen.queryByTestId(`${EntityType.TABLE}-selected`)
    ).not.toBeInTheDocument();
  });
});
