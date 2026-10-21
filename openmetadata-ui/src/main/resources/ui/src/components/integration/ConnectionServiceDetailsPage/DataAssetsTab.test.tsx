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
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
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

// The right panel runs for real — GenericProvider, the entity-page widgets and their pickers —
// down to the REST calls, which are mocked here. A test picks a value the way a user does and
// checks the service handed to the page's save.
jest.mock('../../../rest/dataProductAPI', () => ({
  fetchDataProductsElasticSearch: jest.fn().mockResolvedValue({
    data: [
      {
        label: 'revenue',
        value: {
          id: 'dp-1',
          name: 'revenue',
          displayName: 'Revenue',
          fullyQualifiedName: 'revenue',
          domains: [],
        },
      },
    ],
    paging: { total: 1 },
  }),
}));

jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: jest.fn().mockResolvedValue({
    hits: {
      hits: [
        {
          _source: {
            fullyQualifiedName: 'PII.Sensitive',
            name: 'Sensitive',
            displayName: 'Sensitive',
          },
        },
      ],
      total: { value: 1 },
    },
  }),
}));

jest.mock('../../../rest/glossaryAPI', () => ({
  getGlossariesList: jest.fn().mockResolvedValue({
    data: [
      {
        id: 'glossary-1',
        name: 'Business',
        fullyQualifiedName: 'Business',
        termCount: 1,
      },
    ],
    paging: { total: 1 },
  }),
  getGlossaryTermChildrenLazy: jest.fn().mockResolvedValue({
    data: [
      {
        id: 'term-1',
        name: 'Revenue',
        displayName: 'Revenue',
        fullyQualifiedName: 'Business.Revenue',
        childrenCount: 0,
      },
    ],
    paging: { total: 1 },
  }),
  searchGlossaryTerms: jest.fn().mockResolvedValue([]),
}));

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
const PERSONAL = tag('PersonalData.Personal', TagSource.Classification);
const OLD_TERM = tag('Business.Cost', TagSource.Glossary);

const SERVICE = {
  id: 'svc-1',
  name: 'svc',
  fullyQualifiedName: 'svc',
  description: 'About svc',
  tags: [TIER, PERSONAL, OLD_TERM],
  dataProducts: [],
} as unknown as ServicesType;

const EDIT_BUTTON = /^(add-data-product|add-tag|edit-button)$/;

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

// The widgets lazy-load their cards; wait for all three.
const renderPanel = async (options?: Parameters<typeof renderTab>[0]) => {
  renderTab(options);
  const panel = screen.getByTestId('service-right-panel');

  return {
    panel,
    dataProducts: await within(panel).findByTestId('data-products-container'),
    tags: await within(panel).findByTestId('tags-container'),
    glossaryTerms: await within(panel).findByTestId('glossary-container'),
  };
};

const lastSaved = () => saveUpdatedServiceData.mock.calls.at(-1)?.[0];

const lastDescriptionProps = () =>
  (Description as unknown as jest.Mock).mock.calls.at(-1)?.[0];

describe('DataAssetsTab', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('right panel', () => {
    it('shows data products, tags and glossary terms, in that order', async () => {
      const { panel } = await renderPanel();

      expect(
        within(panel)
          .getAllByTestId(/-container$/)
          .map((el) => el.dataset.testid)
      ).toEqual([
        'data-products-container',
        'tags-container',
        'glossary-container',
      ]);
    });

    it('saves a picked data product on the service', async () => {
      const { dataProducts } = await renderPanel();

      fireEvent.click(within(dataProducts).getByTestId(EDIT_BUTTON));
      fireEvent.click(await screen.findByTestId('revenue'));
      fireEvent.click(screen.getByTestId('update-btn'));

      await waitFor(() =>
        expect(saveUpdatedServiceData).toHaveBeenCalledTimes(1)
      );

      expect(lastSaved()).toEqual(
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

    it('saves a picked tag, keeping the tier, other tags and glossary terms', async () => {
      const { tags } = await renderPanel();

      fireEvent.click(within(tags).getByTestId(EDIT_BUTTON));
      fireEvent.click(await screen.findByTestId('tree-node-PII.Sensitive'));
      fireEvent.click(screen.getByTestId('update-btn'));

      await waitFor(() =>
        expect(saveUpdatedServiceData).toHaveBeenCalledTimes(1)
      );

      expect(lastSaved().tags.map((t: TagLabel) => t.tagFQN)).toEqual(
        expect.arrayContaining([
          TIER.tagFQN,
          PERSONAL.tagFQN,
          'PII.Sensitive',
          OLD_TERM.tagFQN,
        ])
      );
    });

    it('saves a picked glossary term, keeping the tier, tags and other terms', async () => {
      const { glossaryTerms } = await renderPanel();

      fireEvent.click(within(glossaryTerms).getByTestId(EDIT_BUTTON));
      fireEvent.click(await screen.findByTestId('tree-expand-btn'));
      fireEvent.click(await screen.findByTestId('tree-node-Business.Revenue'));
      fireEvent.click(screen.getByTestId('update-btn'));

      await waitFor(() =>
        expect(saveUpdatedServiceData).toHaveBeenCalledTimes(1)
      );

      expect(lastSaved().tags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ tagFQN: TIER.tagFQN }),
          expect.objectContaining({ tagFQN: PERSONAL.tagFQN }),
          expect.objectContaining({ tagFQN: OLD_TERM.tagFQN }),
          expect.objectContaining({
            tagFQN: 'Business.Revenue',
            source: TagSource.Glossary,
          }),
        ])
      );
    });

    it('offers no edits on a soft-deleted service', async () => {
      const { panel } = await renderPanel({ deleted: true });

      expect(within(panel).queryAllByTestId(EDIT_BUTTON)).toHaveLength(0);
    });

    it('offers no edits without edit permissions', async () => {
      const { panel } = await renderPanel({
        permission: { ...DEFAULT_ENTITY_PERMISSION, ViewAll: true },
      });

      expect(within(panel).queryAllByTestId(EDIT_BUTTON)).toHaveLength(0);
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
