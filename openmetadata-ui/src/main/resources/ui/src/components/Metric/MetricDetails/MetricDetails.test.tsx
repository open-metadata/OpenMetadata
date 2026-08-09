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
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import {
  EntityStatus,
  Language,
  Metric,
  MetricGranularity,
  MetricType,
  UnitOfMeasurement,
} from '../../../generated/entity/data/metric';
import { LabelType, State, TagSource } from '../../../generated/type/tagLabel';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import MetricDetails from './MetricDetails';
import { MetricDetailsProps } from './MetricDetails.interface';

const mockNavigate = jest.fn();
const mockActivityTab = jest.fn();
const mockApprovalTab = jest.fn();
const mockLineageTab = jest.fn();
const mockHandleOnAsyncEntityDeleteConfirm = jest
  .fn()
  .mockResolvedValue(undefined);
let activeTab = EntityTabs.OVERVIEW;

const metric = {
  id: 'test-metric-id',
  name: 'gross_margin_rate',
  displayName: 'Gross Margin Rate',
  fullyQualifiedName: 'finance.gross_margin_rate',
  description: 'Gross profit divided by revenue.',
  version: 1.2,
  updatedAt: 1234567890,
  updatedBy: 'analyst',
  metricType: MetricType.Percentage,
  granularity: MetricGranularity.Day,
  unitOfMeasurement: UnitOfMeasurement.Percentage,
  metricExpression: {
    language: Language.SQL,
    code: 'SUM(profit) / SUM(revenue)',
  },
  entityStatus: EntityStatus.InReview,
  metricGroup: {
    id: 'group-id',
    name: 'profitability',
    displayName: 'Profitability',
    fullyQualifiedName: 'profitability',
    type: 'metricGroup',
  },
  owners: [{ id: 'owner-id', name: 'data-team', type: 'team' }],
  experts: [{ id: 'expert-id', name: 'metric-expert', type: 'user' }],
  reviewers: [
    { id: 'reviewer-id', name: 'reviewer', type: 'user' },
    { id: 'reviewer-two-id', name: 'reviewer-two', type: 'user' },
  ],
  domains: [{ id: 'domain-id', name: 'finance', type: 'domain' }],
  dataProducts: [
    { id: 'product-id', name: 'finance-insights', type: 'dataProduct' },
  ],
  tags: [
    {
      displayName: 'Tier 1',
      labelType: LabelType.Manual,
      source: TagSource.Classification,
      state: State.Confirmed,
      tagFQN: 'Tier.Tier1',
    },
    {
      displayName: 'Gross Margin',
      labelType: LabelType.Manual,
      source: TagSource.Glossary,
      state: State.Confirmed,
      tagFQN: 'Business Glossary.Gross Margin',
    },
    {
      displayName: 'Critical',
      labelType: LabelType.Manual,
      source: TagSource.Classification,
      state: State.Confirmed,
      tagFQN: 'Classification.Critical',
    },
  ],
  assets: [{ id: 'asset-id', name: 'orders', type: 'table' }],
  extension: {
    thresholds: { warning: 75, critical: 50 },
  },
} as Metric;

const props: MetricDetailsProps = {
  currentUser: {
    id: 'current-user',
    name: 'current-user',
    email: 'current@example.com',
  },
  metricDetails: metric,
  metricPermissions: { ...DEFAULT_ENTITY_PERMISSION, EditAll: true },
  fetchMetricDetails: jest.fn(),
  onDeleteMetric: jest.fn(),
  onFollowMetric: jest.fn().mockResolvedValue(undefined),
  onMetricUpdate: jest.fn().mockResolvedValue(undefined),
  onRestoreMetric: jest.fn().mockResolvedValue(undefined),
  onUnFollowMetric: jest.fn().mockResolvedValue(undefined),
  onVersionChange: jest.fn(),
};

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: () => ({ tab: activeTab }),
}));

jest.mock('../../../hooks/useEntityRules', () => ({
  useEntityRules: () => ({
    entityRules: {
      canAddMultipleDataProducts: true,
      canAddMultipleDomains: true,
      canAddMultipleGlossaryTerm: true,
      canAddMultipleTeamOwner: true,
      canAddMultipleUserOwners: true,
      maxDataProducts: Infinity,
      maxDomains: Infinity,
      requireDomainForDataProduct: false,
    },
    isLoading: false,
    rules: [],
  }),
}));

jest.mock('../../../context/AsyncDeleteProvider/AsyncDeleteProvider', () => ({
  useAsyncDeleteProvider: () => ({
    handleOnAsyncEntityDeleteConfirm: mockHandleOnAsyncEntityDeleteConfirm,
  }),
}));

jest.mock('../MetricActivity/MetricFeedCountUtils', () => ({
  getMetricFeedCounts: jest.fn().mockResolvedValue({
    conversationCount: 0,
    openTaskCount: 0,
    closedTaskCount: 0,
    totalTasksCount: 0,
    totalCount: 0,
    mentionCount: 0,
  }),
}));

jest.mock('../MetricAssetsTab/useMetricAssetsTab', () => ({
  useMetricAssetsCount: () => ({ count: 7, isPending: false }),
}));

jest.mock('../MetricHeaderInfo/MetricHeaderInfo', () => ({
  __esModule: true,
  default: ({ status }: { status?: ReactNode }) => (
    <div data-testid="metric-header-info">{status}</div>
  ),
}));

jest.mock('../MetricHierarchyCard/useMetricHierarchyCard', () => ({
  useMetricHierarchyCard: () => ({
    group: {
      id: 'group-id',
      name: 'profitability',
      displayName: 'Profitability',
      fullyQualifiedName: 'profitability',
    },
    ancestors: [
      {
        id: 'ancestor-id',
        name: 'profit',
        displayName: 'Profit',
        fullyQualifiedName: 'finance.profit',
      },
    ],
    siblings: [],
    children: [],
    isPending: false,
    error: null,
    hasMoreChildren: false,
    hasMoreSiblings: false,
  }),
}));

jest.mock('../MetricHierarchyCard/MetricHierarchyCard', () => ({
  __esModule: true,
  default: () => <div data-testid="metric-hierarchy-card" />,
}));

jest.mock('../MetricDefinitionCard/MetricDefinitionCard', () => ({
  __esModule: true,
  default: () => <div data-testid="metric-definition-card" />,
}));

jest.mock('../../Lineage/EntityLineageTab/EntityLineageTab', () => ({
  EntityLineageTab: (componentProps: unknown) => {
    mockLineageTab(componentProps);

    return <div data-testid="metric-lineage-tab" />;
  },
}));

jest.mock('../MetricAssetsTab/MetricAssetsTab.component', () => ({
  __esModule: true,
  default: () => <div data-testid="metric-assets-tab" />,
}));

jest.mock('../MetricObservability/MetricObservabilityTab.component', () => ({
  __esModule: true,
  default: () => <div data-testid="metric-observability-tab" />,
}));

jest.mock('../MetricActivity/MetricActivityTab.component', () => ({
  __esModule: true,
  default: (componentProps: unknown) => {
    mockActivityTab(componentProps);

    return <div data-testid="metric-activity-tab" />;
  },
}));

jest.mock('../MetricApproval/MetricApprovalTab.component', () => ({
  __esModule: true,
  default: (componentProps: unknown) => {
    mockApprovalTab(componentProps);

    return <div data-testid="metric-approval-tab" />;
  },
}));

const renderDetails = (override: Partial<MetricDetailsProps> = {}) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }>
      <MemoryRouter>
        <MetricDetails {...props} {...override} />
      </MemoryRouter>
    </QueryClientProvider>
  );

describe('MetricDetails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    activeTab = EntityTabs.OVERVIEW;
  });

  it('renders the group-aware header, exact primary tabs, and complete Overview', () => {
    renderDetails();

    const title = screen.getByRole('heading', { name: 'Gross Margin Rate' });
    const fqn = screen.getByTestId('metric-header-fqn');
    const titleRow = screen.getByTestId('metric-title-row');

    expect(title.tagName).toBe('H1');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(title.querySelector('h1')).not.toBeInTheDocument();
    expect(screen.getByText('finance.gross_margin_rate')).toBeInTheDocument();
    expect(screen.getByText('Profitability')).toBeInTheDocument();
    expect(
      screen.getAllByText('Gross profit divided by revenue.')
    ).toHaveLength(1);
    expect(
      fqn.compareDocumentPosition(titleRow) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(titleRow).toContainElement(screen.getByTestId('metric-header-info'));
    expect(screen.getByTestId('metric-header-info')).toContainElement(
      screen.getByTestId('metric-status-pill')
    );
    expect(screen.getByRole('link', { name: 'Profit' })).toHaveAttribute(
      'href',
      expect.stringContaining('finance.profit')
    );
    expect(screen.getByTestId('metric-hierarchy-card')).toBeInTheDocument();
    expect(screen.getByTestId('metric-definition-card')).toBeInTheDocument();
    expect(screen.getByTestId('metric-metadata-rail')).toHaveTextContent(
      'data-team'
    );

    const peopleCard = screen.getByTestId('metric-metadata-people-card');
    const governanceCard = screen.getByTestId(
      'metric-metadata-governance-card'
    );
    const taxonomyCard = screen.getByTestId('metric-metadata-taxonomy-card');
    const additionalCard = screen.getByTestId(
      'metric-metadata-additional-card'
    );

    expect(peopleCard).toHaveTextContent('label.owner-plural');
    expect(peopleCard).toHaveTextContent('data-team');
    expect(peopleCard).toHaveTextContent('label.expert-plural');
    expect(peopleCard).toHaveTextContent('metric-expert');
    expect(peopleCard).toHaveTextContent('label.reviewer-plural');
    expect(
      within(peopleCard).getByTestId('metric-metadata-person-owner-id')
    ).toContainElement(within(peopleCard).getByText('data-team'));
    expect(
      within(peopleCard)
        .getByTestId('metric-metadata-person-owner-id')
        .querySelector('[data-avatar]')
    ).toBeInTheDocument();
    expect(
      within(peopleCard).getByTestId('metric-metadata-person-expert-id')
    ).toContainElement(within(peopleCard).getByText('metric-expert'));
    expect(
      within(peopleCard).getByRole('list', {
        name: 'label.reviewer-plural',
      })
    ).toBeInTheDocument();
    expect(
      within(peopleCard).getByRole('listitem', { name: 'reviewer' })
    ).toHaveClass('tw:-ml-2', 'first:tw:ml-0');
    expect(
      within(peopleCard).getByRole('listitem', { name: 'reviewer-two' })
    ).toHaveClass('tw:-ml-2', 'first:tw:ml-0');

    [
      'label.owner-plural',
      'label.expert-plural',
      'label.reviewer-plural',
    ].forEach((label) => {
      expect(within(peopleCard).getByText(label)).toHaveClass(
        'tw:uppercase',
        'tw:tracking-wide',
        'tw:text-tertiary'
      );
    });

    expect(governanceCard).toHaveTextContent('label.domain-plural');
    expect(governanceCard).toHaveTextContent('finance');
    expect(within(governanceCard).getByText('finance')).toHaveClass(
      'tw:text-primary'
    );
    expect(governanceCard).toHaveTextContent('label.tier');
    expect(governanceCard).toHaveTextContent('Tier 1');
    expect(within(governanceCard).getByText('Tier 1')).toHaveClass(
      'tw:bg-utility-purple-50',
      'tw:text-utility-purple-700'
    );
    expect(governanceCard).toHaveTextContent('label.granularity & label.unit');
    expect(within(governanceCard).getByText('label.day')).toHaveClass(
      'tw:font-mono',
      'tw:uppercase'
    );
    expect(within(governanceCard).getByText('label.percentage')).toHaveClass(
      'tw:font-mono',
      'tw:uppercase'
    );
    expect(taxonomyCard).toHaveTextContent('label.glossary-term-plural');
    expect(taxonomyCard).toHaveTextContent('Gross Margin');
    expect(within(taxonomyCard).getByText('Gross Margin')).toHaveClass(
      'tw:bg-utility-blue-50',
      'tw:text-utility-blue-700'
    );
    expect(
      within(taxonomyCard).getByText('Gross Margin').querySelector('svg')
    ).toBeInTheDocument();
    expect(taxonomyCard).toHaveTextContent('label.tag-plural');
    expect(taxonomyCard).toHaveTextContent('Critical');
    expect(within(taxonomyCard).getByText('Critical')).toHaveClass(
      'tw:bg-utility-purple-50',
      'tw:text-utility-purple-700'
    );
    expect(
      within(taxonomyCard).getByText('Critical').querySelector('svg')
    ).toBeInTheDocument();
    expect(additionalCard).toHaveTextContent('label.data-product-plural');
    expect(additionalCard).toHaveTextContent('finance-insights');
    expect(additionalCard).toHaveTextContent('thresholds');
    expect(
      within(peopleCard).getByTestId('edit-metric-metadata')
    ).toBeInTheDocument();
    expect(screen.getAllByTestId('edit-metric-metadata')).toHaveLength(1);
    expect(screen.getByTestId('metric-metadata-rail')).toHaveClass(
      'tw:xl:sticky',
      'tw:xl:self-start'
    );
    expect(screen.getByTestId('metric-header-owner')).toHaveTextContent(
      'data-team'
    );
    expect(screen.getByTestId('metric-header-owner-avatar')).toHaveTextContent(
      'DT'
    );
    expect(screen.getByTestId('metric-header-domain-icon')).toBeInTheDocument();
    expect(screen.getByTestId('metric-header-tier-icon')).toBeInTheDocument();
    expect(
      screen.getByTestId('metric-header-updated-icon')
    ).toBeInTheDocument();
    expect(screen.getByTestId('metric-header-updater-avatar')).toHaveAttribute(
      'aria-label',
      'analyst'
    );
    expect(
      screen.queryByRole('button', { name: 'message.copy-to-clipboard' })
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('metric-header-domain')).toHaveTextContent(
      'finance'
    );
    expect(
      screen.getByTestId('metric-custom-property-thresholds')
    ).toHaveTextContent('"warning": 75');
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument();
    expect(screen.getByTestId('metric-type-icon')).toHaveClass(
      'tw:bg-white',
      'tw:border',
      'tw:border-utility-brand-200',
      'tw:rounded-lg'
    );
    expect(screen.getByText('label.governance')).toBeInTheDocument();
    expect(title).toHaveClass('tw:text-display-xs', 'tw:font-bold');
    expect(screen.getByTestId('metric-overview')).toHaveClass(
      'tw:gap-6',
      'tw:xl:grid-cols-[minmax(0,1fr)_20rem]'
    );
    expect(screen.getByTestId('metric-overview-main')).toHaveClass('tw:gap-5');

    expect(screen.getAllByRole('tab')).toHaveLength(6);
    expect(screen.getAllByTestId(/metric-tab-icon-/)).toHaveLength(6);
    expect(
      screen.getByRole('tab', { name: /label.overview/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: /label.lineage/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: /label.asset-plural/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: /label.observability/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: /label.activity-and-task-plural/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: /label.approval.*label.workflow/i })
    ).toBeInTheDocument();
  });

  it('keeps the narrow detail shell compact without horizontal overflow', () => {
    renderDetails();

    expect(screen.getByTestId('metric-details-page')).toHaveClass(
      'tw:min-w-0',
      'tw:w-full',
      'tw:overflow-x-hidden'
    );
    expect(screen.getByTestId('metric-header-shell')).toHaveClass(
      'tw:px-4',
      'tw:md:px-8'
    );
    expect(screen.getByTestId('metric-detail-header')).toHaveClass(
      'tw:min-w-0',
      'tw:flex-col',
      'tw:sm:flex-row'
    );
    expect(screen.getByTestId('metric-breadcrumbs')).toHaveClass(
      'tw:[&>li:not(:first-child):not(:last-child)]:hidden',
      'tw:sm:[&>li:not(:first-child):not(:last-child)]:flex'
    );
    expect(screen.getByTestId('metric-header-primary')).toHaveClass(
      'tw:w-full',
      'tw:min-w-0',
      'tw:sm:flex-1'
    );
    expect(screen.getByTestId('metric-header-description')).toHaveClass(
      'tw:max-w-4xl',
      'tw:text-pretty'
    );
    expect(screen.getByTestId('metric-header-description')).not.toHaveClass(
      'tw:hidden'
    );
    expect(screen.getByTestId('metric-header-secondary-metadata')).toHaveClass(
      'tw:flex',
      'tw:flex-wrap'
    );
    expect(screen.getByTestId('metric-header-actions')).toHaveClass(
      'tw:w-full',
      'tw:flex-nowrap',
      'tw:sm:w-auto'
    );
    expect(screen.getByText('label.follow')).toHaveClass(
      'tw:hidden',
      'tw:sm:inline'
    );
    expect(screen.getByTestId('metric-detail-tabs')).toHaveClass(
      'tw:flex',
      'tw:overflow-x-auto'
    );
    expect(screen.getByTestId('metric-detail-content')).toHaveClass(
      'tw:w-full',
      'tw:min-w-0'
    );
    expect(screen.getByTestId('metric-detail-content')).not.toHaveClass(
      'tw:mx-auto',
      'tw:max-w-screen-2xl'
    );

    screen.getAllByRole('tab').forEach((tab) => {
      expect(tab).toHaveClass(
        'tw:font-semibold',
        'tw:min-w-0',
        'tw:w-auto',
        'tw:whitespace-nowrap'
      );
    });
  });

  it('renders accessible empty header metadata when ownership and domain are absent', () => {
    renderDetails({
      metricDetails: {
        ...metric,
        owners: undefined,
        domains: undefined,
        tags: undefined,
      },
    });

    expect(screen.getByTestId('metric-header-owner')).toHaveTextContent(
      'label.empty-dash'
    );
    expect(screen.getByTestId('metric-header-domain')).toHaveTextContent(
      'label.empty-dash'
    );
    expect(screen.getByTestId('metric-header-tier')).toHaveTextContent(
      'label.empty-dash'
    );
    expect(screen.getByTestId('metric-header-owner-icon')).toBeInTheDocument();
    expect(
      screen.queryByTestId('metric-header-owner-avatar')
    ).not.toBeInTheDocument();
  });

  it('omits the compact additional metadata card when no optional values exist', () => {
    renderDetails({
      metricDetails: {
        ...metric,
        dataProducts: undefined,
        extension: undefined,
      },
    });

    expect(
      screen.queryByTestId('metric-metadata-additional-card')
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId('metric-metadata-people-card')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('metric-metadata-governance-card')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('metric-metadata-taxonomy-card')
    ).toBeInTheDocument();
  });

  it('contains none of the deliberately excluded metric surfaces', () => {
    renderDetails();

    expect(screen.queryByText(/metric preview/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/current value/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/value trend/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/freshness/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sla/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('tab', { name: /custom propert/i })
    ).not.toBeInTheDocument();
  });

  it('preserves route-key test ids and navigates through the selected tab', () => {
    renderDetails();

    [
      EntityTabs.OVERVIEW,
      EntityTabs.LINEAGE,
      EntityTabs.ASSETS,
      EntityTabs.DATA_OBSERVABILITY,
      EntityTabs.ACTIVITY_FEED,
      EntityTabs.APPROVAL,
    ].forEach((tab) => {
      expect(screen.getByTestId(tab)).toHaveAttribute('role', 'tab');
    });

    fireEvent.click(screen.getByTestId(EntityTabs.ACTIVITY_FEED));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining(`/${EntityTabs.ACTIVITY_FEED}/all`),
      { replace: true }
    );
  });

  it('renders only the selected workflow surface', async () => {
    activeTab = EntityTabs.APPROVAL;
    renderDetails();

    expect(
      await screen.findByTestId('metric-approval-tab')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('metric-definition-card')
    ).not.toBeInTheDocument();
  });

  it('renders the generic lineage surface with Metric permissions', async () => {
    activeTab = EntityTabs.LINEAGE;
    renderDetails({
      metricPermissions: {
        ...DEFAULT_ENTITY_PERMISSION,
        EditLineage: true,
      },
    });

    expect(await screen.findByTestId('metric-lineage-tab')).toBeInTheDocument();
    expect(mockLineageTab).toHaveBeenLastCalledWith({
      deleted: false,
      entity: metric,
      entityType: EntityType.METRIC,
      hasEditAccess: true,
    });
  });

  it('follows the metric and copies a share link from accessible actions', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderDetails();

    fireEvent.click(screen.getByRole('button', { name: 'label.follow' }));
    const shareButton = screen.getByRole('button', { name: 'label.share' });

    expect(shareButton).not.toHaveTextContent('label.share');

    fireEvent.click(shareButton);

    await waitFor(() => expect(props.onFollowMetric).toHaveBeenCalled());

    expect(writeText).toHaveBeenCalledWith(window.location.href);
  });

  it('uses the branded selected treatment when the current user follows it', () => {
    renderDetails({
      metricDetails: {
        ...metric,
        followers: [{ id: 'current-user', name: 'current-user', type: 'user' }],
      },
    });

    expect(screen.getByRole('button', { name: 'label.following' })).toHaveClass(
      'tw:text-brand-secondary'
    );
  });

  it('opens the Untitled delete workflow only with delete permission', async () => {
    const onDeleteMetric = jest.fn();
    const view = renderDetails();

    fireEvent.click(screen.getByTestId('manage-button'));

    expect(screen.queryByTestId('delete-button')).not.toBeInTheDocument();

    view.unmount();
    mockHandleOnAsyncEntityDeleteConfirm.mockImplementationOnce(
      async (options: {
        afterDeleteAction?: (isSoftDelete?: boolean) => void;
      }) => options.afterDeleteAction?.(true)
    );
    renderDetails({
      metricPermissions: {
        ...DEFAULT_ENTITY_PERMISSION,
        Delete: true,
        EditAll: true,
      },
      onDeleteMetric,
    });

    fireEvent.click(screen.getByTestId('manage-button'));
    fireEvent.click(await screen.findByTestId('delete-button'));

    expect(await screen.findByTestId('delete-modal')).toBeInTheDocument();
    expect(screen.getByTestId('soft-delete')).toBeInTheDocument();
    expect(screen.getByTestId('hard-delete')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('hard-delete'));
    fireEvent.click(screen.getByTestId('confirm-button'));

    await waitFor(() =>
      expect(mockHandleOnAsyncEntityDeleteConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          deleteType: 'hard-delete',
          entityId: metric.id,
          entityType: EntityType.METRIC,
          isRecursiveDelete: true,
          onDeleteFailure: props.fetchMetricDetails,
        })
      )
    );

    expect(onDeleteMetric).toHaveBeenCalledWith(true);
    expect(screen.queryByTestId('delete-modal')).not.toBeInTheDocument();
  });

  it('keeps the delete dialog open when the request is not accepted', async () => {
    renderDetails({
      metricPermissions: {
        ...DEFAULT_ENTITY_PERMISSION,
        Delete: true,
      },
    });

    fireEvent.click(screen.getByTestId('manage-button'));
    fireEvent.click(await screen.findByTestId('delete-button'));
    fireEvent.click(await screen.findByTestId('confirm-button'));

    await waitFor(() =>
      expect(mockHandleOnAsyncEntityDeleteConfirm).toHaveBeenCalledTimes(1)
    );

    expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
  });

  it('marks deleted Metrics read-only and restores them from the overflow', async () => {
    let resolveRestore: () => void = () => undefined;
    const onRestoreMetric = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRestore = resolve;
        })
    );
    renderDetails({
      metricDetails: { ...metric, deleted: true },
      metricPermissions: {
        ...DEFAULT_ENTITY_PERMISSION,
        Delete: true,
        EditAll: true,
      },
      onRestoreMetric,
    });

    expect(screen.getByTestId('deleted-badge')).toHaveTextContent(
      'label.deleted'
    );
    expect(
      screen.queryByRole('button', { name: 'label.follow' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('edit-metric-metadata')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('manage-button'));

    expect(await screen.findByTestId('delete-button')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('restore-button'));
    fireEvent.click(
      await screen.findByRole('button', { name: 'label.restore' })
    );

    await waitFor(() => expect(onRestoreMetric).toHaveBeenCalledTimes(1));

    expect(
      screen.queryByRole('button', { name: 'Close' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'label.cancel' })).toBeDisabled();

    await act(async () => resolveRestore());

    await waitFor(() =>
      expect(
        screen.queryByTestId('restore-asset-modal')
      ).not.toBeInTheDocument()
    );
  });

  it('does not expose an empty management menu for a deleted Metric', () => {
    renderDetails({
      metricDetails: { ...metric, deleted: true },
      metricPermissions: {
        ...DEFAULT_ENTITY_PERMISSION,
        Delete: false,
      },
    });

    expect(screen.queryByTestId('manage-button')).not.toBeInTheDocument();
  });

  it('removes edit controls when the user cannot edit the metric', () => {
    renderDetails({
      metricPermissions: { ...DEFAULT_ENTITY_PERMISSION, EditAll: false },
    });

    expect(screen.getByTestId('metric-overview')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'label.edit' })
    ).not.toBeInTheDocument();
  });

  it('passes current-user and Metric permissions to workflow tabs', async () => {
    activeTab = EntityTabs.ACTIVITY_FEED;
    const metricPermissions = {
      ...DEFAULT_ENTITY_PERMISSION,
      EditAll: false,
      EditDescription: true,
    };
    const activityRender = renderDetails({ metricPermissions });

    await screen.findByTestId('metric-activity-tab');

    expect(mockActivityTab).toHaveBeenLastCalledWith(
      expect.objectContaining({
        currentUser: props.currentUser,
        canCreateThread: false,
        canCreateTasks: false,
        metricPermissions,
      })
    );
    expect(mockActivityTab).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ canResolveTasks: expect.anything() })
    );

    activityRender.unmount();

    activeTab = EntityTabs.APPROVAL;
    renderDetails();
    await screen.findByTestId('metric-approval-tab');

    expect(mockApprovalTab).toHaveBeenLastCalledWith(
      expect.objectContaining({ currentUser: props.currentUser })
    );
  });
});
