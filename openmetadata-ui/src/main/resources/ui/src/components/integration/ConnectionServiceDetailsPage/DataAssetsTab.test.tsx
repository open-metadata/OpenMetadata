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
import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../enums/entity.enum';
import { ServiceCategory } from '../../../enums/service.enum';
import {
  LabelType,
  State,
  TagLabel,
  TagSource,
} from '../../../generated/type/tagLabel';
import { ServicesType } from '../../../interface/service.interface';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import Description from '../../common/EntityDescription/Description';
import DataAssetsTab from './DataAssetsTab';

// The right panel runs on the real GenericProvider and entity-page widgets. Mocked: the hooks
// that fetch (change summary, entity rules), and the pickers the widgets render — they are where
// a user's selection enters, so their callbacks stand in for a pick.
jest.mock('../../../hooks/useChangeSummary', () => ({
  useChangeSummary: () => ({ changeSummary: {} }),
}));

jest.mock('../../../hooks/useEntityRules', () => ({
  useEntityRules: () => ({
    entityRules: {
      canAddMultipleDataProducts: true,
      canAddMultipleGlossaryTerm: true,
      requireDomainForDataProduct: false,
    },
    isRulesLoaded: true,
  }),
}));

jest.mock('../../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel', () =>
  jest.fn(() => null)
);

const mockDataProductsContainer = jest.fn();
jest.mock(
  '../../DataProducts/DataProductsContainer/DataProductsContainer.component',
  () => ({
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      mockDataProductsContainer(props);

      return <div data-testid="data-products-container" />;
    },
  })
);

const mockTagsContainer = jest.fn();
jest.mock('../../Tag/TagsContainerV2/TagsContainerV2', () => ({
  __esModule: true,
  default: (props: { tagType: TagSource }) => {
    mockTagsContainer(props);

    return <div data-testid={`tags-container-${props.tagType}`} />;
  },
}));

const mockServiceMainTabContent = jest.fn();
jest.mock(
  '../../../pages/ServiceDetailsPage/ServiceMainTabContent',
  () => (props: Record<string, unknown>) => {
    mockServiceMainTabContent(props);

    return <div data-testid="service-main-tab-content" />;
  }
);

jest.mock('../../common/EntityDescription/Description', () =>
  jest.fn(() => <div data-testid="description" />)
);

const EDIT_ALL = {
  ...DEFAULT_ENTITY_PERMISSION,
  EditAll: true,
  EditDescription: true,
  EditTags: true,
  EditGlossaryTerms: true,
  ViewAll: true,
} as OperationPermission;

const tag = (tagFQN: string, source: TagSource): TagLabel => ({
  tagFQN,
  source,
  labelType: LabelType.Manual,
  state: State.Confirmed,
});

const TIER = tag('Tier.Tier1', TagSource.Classification);
const PII = tag('PII.Sensitive', TagSource.Classification);
const TERM = tag('Business.Revenue', TagSource.Glossary);

const SERVICE = {
  id: 'svc-1',
  name: 'svc',
  fullyQualifiedName: 'svc',
  description: 'About svc',
  tags: [TIER],
  dataProducts: [],
} as unknown as ServicesType;

const saveUpdatedServiceData = jest.fn();
const onDescriptionUpdate = jest.fn();

const renderTab = ({
  permission = EDIT_ALL,
  deleted = false,
}: {
  permission?: OperationPermission;
  deleted?: boolean;
} = {}) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <DataAssetsTab
          currentPage={1}
          data={[]}
          isServiceLoading={false}
          paging={{ total: 0 }}
          pagingInfo={{} as never}
          saveUpdatedServiceData={saveUpdatedServiceData}
          serviceCategory={ServiceCategory.DATABASE_SERVICES}
          serviceDetails={{ ...SERVICE, deleted }}
          servicePermission={permission}
          setFilters={jest.fn()}
          setIsServiceLoading={jest.fn()}
          showDeleted={false}
          onDataProductUpdate={jest.fn()}
          onDescriptionUpdate={onDescriptionUpdate}
          onShowDeletedChange={jest.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>
  );

// The widgets lazy-load their containers; wait for all three before reading their props.
const renderPanel = async (options?: Parameters<typeof renderTab>[0]) => {
  renderTab(options);
  const panel = screen.getByTestId('service-right-panel');
  await within(panel).findByTestId('data-products-container');
  await within(panel).findByTestId(
    `tags-container-${TagSource.Classification}`
  );
  await within(panel).findByTestId(`tags-container-${TagSource.Glossary}`);

  return panel;
};

const lastTagsProps = (tagType: TagSource) =>
  mockTagsContainer.mock.calls
    .filter(([p]) => p.tagType === tagType)
    .at(-1)?.[0];

const lastDataProductsProps = () =>
  mockDataProductsContainer.mock.calls.at(-1)?.[0];

const lastDescriptionProps = () =>
  (Description as unknown as jest.Mock).mock.calls.at(-1)?.[0];

describe('DataAssetsTab', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('right panel', () => {
    it('shows data products, tags and glossary terms, in that order', async () => {
      const panel = await renderPanel();

      expect(
        within(panel)
          .getAllByTestId(/-container/)
          .map((el) => el.dataset.testid)
      ).toEqual([
        'data-products-container',
        `tags-container-${TagSource.Classification}`,
        `tags-container-${TagSource.Glossary}`,
      ]);
    });

    it('saves a picked data product on the service as a reference', async () => {
      await renderPanel();

      await act(() =>
        lastDataProductsProps().onSave([
          { id: 'dp-1', name: 'revenue', fullyQualifiedName: 'revenue' },
        ])
      );

      expect(saveUpdatedServiceData).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'svc-1',
          dataProducts: [
            expect.objectContaining({
              id: 'dp-1',
              type: EntityType.DATA_PRODUCT,
            }),
          ],
        })
      );
    });

    it('saves picked tags on the service, keeping its tier', async () => {
      await renderPanel();

      await act(() =>
        lastTagsProps(TagSource.Classification).onSelectionChange([PII])
      );

      expect(saveUpdatedServiceData).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'svc-1',
          tags: [TIER, expect.objectContaining({ tagFQN: PII.tagFQN })],
        })
      );
    });

    it('saves picked glossary terms on the service, keeping its tier', async () => {
      await renderPanel();

      await act(() =>
        lastTagsProps(TagSource.Glossary).onSelectionChange([TERM])
      );

      expect(saveUpdatedServiceData).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: [
            TIER,
            expect.objectContaining({
              tagFQN: TERM.tagFQN,
              source: TagSource.Glossary,
            }),
          ],
        })
      );
    });

    it('is editable with the service permissions', async () => {
      await renderPanel();

      expect(lastDataProductsProps().hasPermission).toBe(true);
      expect(lastTagsProps(TagSource.Classification).permission).toBe(true);
      expect(lastTagsProps(TagSource.Glossary).permission).toBe(true);
    });

    it('is read-only on a soft-deleted service', async () => {
      await renderPanel({ deleted: true });

      expect(lastDataProductsProps().hasPermission).toBe(false);
      expect(lastTagsProps(TagSource.Classification).permission).toBe(false);
      expect(lastTagsProps(TagSource.Glossary).permission).toBe(false);
    });

    it('is read-only without edit permissions', async () => {
      await renderPanel({
        permission: { ...DEFAULT_ENTITY_PERMISSION, ViewAll: true },
      });

      expect(lastDataProductsProps().hasPermission).toBe(false);
      expect(lastTagsProps(TagSource.Classification).permission).toBe(false);
      expect(lastTagsProps(TagSource.Glossary).permission).toBe(false);
    });
  });

  describe('layout', () => {
    it('shows the service description as a card above the asset list', () => {
      renderTab();

      expect(lastDescriptionProps()).toEqual(
        expect.objectContaining({
          wrapInCard: true,
          description: 'About svc',
          entityType: EntityType.DATABASE_SERVICE,
          hasEditAccess: true,
          onDescriptionUpdate,
        })
      );
    });

    it('keeps the description read-only on a soft-deleted service', () => {
      renderTab({ deleted: true });

      expect(lastDescriptionProps()).toEqual(
        expect.objectContaining({ hasEditAccess: false, showActions: false })
      );
    });

    // The tab already sits in the page's frame, and renders its own right panel: a card around the
    // table would be a box in a box, and a second right panel a duplicate fetch.
    it('shows the asset table without a card or right panel of its own', () => {
      renderTab();

      expect(mockServiceMainTabContent).toHaveBeenCalledWith(
        expect.objectContaining({ wrapInCard: false, hideRightPanel: true })
      );
    });

    // data-assets-tab.less stops the classic tab body sizing itself off the viewport (dead space
    // below a short table) and hides its own description through these wrappers. jsdom applies
    // no stylesheet, so this pins the hook the rules hang on.
    it('nests the asset list in the wrappers its stylesheet targets', () => {
      renderTab();

      const list = screen.getByTestId('service-main-tab-content');

      expect(list.parentElement).toHaveClass('data-assets-table-wrapper');
      expect(list.closest('.data-assets-tab')).not.toBeNull();
    });
  });
});
