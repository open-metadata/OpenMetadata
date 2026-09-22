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

import { render, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { DataProduct } from '../../generated/entity/domains/dataProduct';
import { OnboardingPlaybook } from '../../generated/entity/governance/onboardingPlaybook';
import { listOnboarding } from '../../rest/governance/onboarding/Onboarding.api';
import { getOnboardingPlaybookForEntityType } from '../../rest/governance/onboarding/OnboardingPlaybook.api';
import { DataProductListPage } from './DataProductListPage';
import { useDataProductListingData } from './hooks/useDataProductListingData';

jest.mock('./hooks/useDataProductListingData', () => ({
  useDataProductListingData: jest.fn(),
}));
jest.mock('../../rest/governance/onboarding/Onboarding.api', () => ({
  listOnboarding: jest.fn(),
}));
jest.mock('../../rest/governance/onboarding/OnboardingPlaybook.api', () => ({
  getOnboardingPlaybookForEntityType: jest.fn(),
}));
jest.mock('../common/atoms/domain/ui/useDataProductFilters', () => ({
  useDataProductFilters: () => ({ quickFilters: null, defaultFilters: [] }),
}));
jest.mock('../common/atoms/domain/ui/useDomainCardTemplates', () => ({
  useDomainCardTemplates: () => ({ renderDataProductCard: () => null }),
}));
jest.mock('../common/atoms/filters/useFilterSelection', () => ({
  useFilterSelection: () => ({ filterSelectionDisplay: null }),
}));
jest.mock('../common/atoms/actions/useDelete', () => ({
  useDelete: () => ({ deleteIconButton: null, deleteModal: null }),
}));
jest.mock('../common/HeaderBreadcrumb/HeaderBreadcrumb.component', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../Learning/LearningIcon/LearningIcon.component', () => ({
  LearningIcon: () => null,
}));
const applicationState = {
  currentUser: { id: 'me', name: 'me', teams: [] },
};
jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: (selector?: (state: unknown) => unknown) =>
    selector ? selector(applicationState) : applicationState,
}));
jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    permissions: { dataProduct: { Create: true } },
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-US' },
  }),
}));

const listing = useDataProductListingData as jest.MockedFunction<
  typeof useDataProductListingData
>;
const list = listOnboarding as jest.MockedFunction<typeof listOnboarding>;
const playbookOf = getOnboardingPlaybookForEntityType as jest.MockedFunction<
  typeof getOnboardingPlaybookForEntityType
>;

const product = {
  id: 'dp-1',
  name: 'customer_360',
  displayName: 'Customer 360',
  fullyQualifiedName: 'customer_360',
  domains: [{ id: 'dom-1', type: 'domain', name: 'Marketing' }],
} as DataProduct;

const listingValue = {
  entities: [product],
  loading: false,
  totalEntities: 1,
  currentPage: 1,
  totalPages: 1,
  pageSize: 15,
  columns: [],
  renderers: {},
  selectedEntities: [],
  isAllSelected: false,
  isIndeterminate: false,
  handleSelectAll: jest.fn(),
  handleSelect: jest.fn(),
  isSelected: () => false,
  clearSelection: jest.fn(),
  urlState: {},
  parsedFilters: [],
  actionHandlers: { onEntityClick: jest.fn() },
  handleSearchChange: jest.fn(),
  handleFilterChange: jest.fn(),
  handleClearAll: jest.fn(),
  handlePageChange: jest.fn(),
  refetch: jest.fn(),
} as unknown as ReturnType<typeof useDataProductListingData>;

const mountList = () =>
  render(
    <BrowserRouter>
      <DataProductListPage pageTitle="label.data-product-plural" />
    </BrowserRouter>
  );

const boardRow = (steps: unknown[]) => ({
  entity: { id: 'dp-1', type: 'dataProduct', name: 'customer_360' },
  stage: 'draft',
  createdAt: Date.now() - 6 * 24 * 60 * 60 * 1000,
  steps,
});

beforeEach(() => {
  jest.clearAllMocks();
  listing.mockReturnValue(listingValue);
  playbookOf.mockResolvedValue({
    id: 'pb-1',
    name: 'dataProductPlaybook',
  } as OnboardingPlaybook);
  list.mockResolvedValue({ data: [] });
});

describe('DataProductListPage with a playbook', () => {
  it('replaces its columns with the playbook ones and offers the board', async () => {
    mountList();

    expect(
      await screen.findByRole('columnheader', { name: 'label.next-step' })
    ).toBeVisible();
    expect(
      screen.getByRole('columnheader', { name: 'label.age' })
    ).toBeVisible();
    expect(
      screen.getByRole('columnheader', { name: 'label.stage' })
    ).toBeVisible();
    expect(
      screen.queryByRole('columnheader', { name: 'label.expert-plural' })
    ).toBeNull();
    expect(screen.getByTestId('onboarding-board')).toBeVisible();
    expect(
      screen.getByText('message.every-product-follows-the-playbook')
    ).toBeVisible();
  });

  it("invites the producer into their own open check and dates the product's creation", async () => {
    list.mockResolvedValue({
      data: [
        boardRow([
          {
            step: { id: 'description', title: 'Business description' },
            required: true,
            state: 'Pending',
            assignees: [{ id: 'me', type: 'user', name: 'me' }],
          },
        ]),
      ],
    } as never);
    mountList();

    expect(await screen.findByTestId('continue-setup')).toHaveAttribute(
      'href',
      '/dataProduct/customer_360?check=description'
    );
    expect(screen.getByText('6d')).toBeVisible();
  });

  it('names the other role rather than inviting the viewer in', async () => {
    list.mockResolvedValue({
      data: [
        boardRow([
          {
            step: { id: 'expert', title: 'Data expert' },
            required: true,
            state: 'Pending',
            assignees: [{ id: 'someone-else', type: 'user', name: 'priya' }],
          },
        ]),
      ],
    } as never);
    mountList();

    await waitFor(() =>
      expect(screen.getByText('label.waiting-for-check')).toBeVisible()
    );

    expect(screen.queryByTestId('continue-setup')).toBeNull();
  });
});

describe('DataProductListPage without a playbook', () => {
  beforeEach(() => playbookOf.mockResolvedValue(undefined));

  it('keeps the columns and the header it always had', async () => {
    mountList();

    expect(
      await screen.findByRole('columnheader', { name: 'label.expert-plural' })
    ).toBeVisible();
    expect(
      screen.queryByRole('columnheader', { name: 'label.next-step' })
    ).toBeNull();
    expect(screen.queryByTestId('onboarding-board')).toBeNull();
    expect(list).not.toHaveBeenCalled();
  });
});

// Keeps the file's ReactNode import honest for the drawer mock signature.
export type DrawerSlot = ReactNode;
