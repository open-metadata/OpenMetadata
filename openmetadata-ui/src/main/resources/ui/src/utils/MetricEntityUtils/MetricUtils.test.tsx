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
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { FEED_COUNT_INITIAL_DATA } from '../../constants/entity.constants';
import { DetailPageWidgetKeys } from '../../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../../enums/entity.enum';
import type { Metric } from '../../generated/entity/data/metric';
import { DEFAULT_ENTITY_PERMISSION } from '../PermissionsUtils';
import type { MetricDetailPageTabProps } from './MetricDetailsClassBase';
import {
  getMetricDetailsPageTabs,
  getMetricWidgetsFromKey,
} from './MetricUtils';

const mockLineage = jest.fn();
const mockAssets = jest.fn();
const mockActivity = jest.fn();
const mockApproval = jest.fn();
const mockCommonWidget = jest.fn();

jest.mock('../../components/common/Loader/Loader', () => ({
  __esModule: true,
  default: () => <div data-testid="metric-utils-loader" />,
}));

jest.mock('../../components/common/TabsLabel/TabsLabel.component', () => ({
  __esModule: true,
  default: ({ id, name }: { id: string; name: string }) => (
    <span data-testid={`tab-label-${id}`}>{name}</span>
  ),
}));

jest.mock('../../components/Customization/GenericTab/GenericTab', () => ({
  GenericTab: () => <div data-testid="metric-generic-tab" />,
}));

jest.mock(
  '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component',
  () => ({
    ActivityFeedTab: (props: unknown) => {
      mockActivity(props);

      return <div data-testid="metric-activity-tab" />;
    },
  })
);

jest.mock('../../components/Lineage/EntityLineageTab/EntityLineageTab', () => ({
  EntityLineageTab: (props: unknown) => {
    mockLineage(props);

    return <div data-testid="metric-lineage-tab" />;
  },
}));

jest.mock(
  '../../components/Metric/MetricAssetsTab/MetricAssetsTab.component',
  () => ({
    __esModule: true,
    default: (props: unknown) => {
      mockAssets(props);

      return <div data-testid="metric-assets-tab" />;
    },
  })
);

jest.mock(
  '../../components/Metric/MetricObservability/MetricObservabilityTab.component',
  () => ({
    __esModule: true,
    default: () => <div data-testid="metric-observability-tab" />,
  })
);

jest.mock(
  '../../components/Metric/MetricApproval/MetricApprovalTab.component',
  () => ({
    __esModule: true,
    default: (props: unknown) => {
      mockApproval(props);

      return <div data-testid="metric-approval-tab" />;
    },
  })
);

jest.mock(
  '../../components/Metric/MetricHierarchyCard/MetricHierarchyCard',
  () => ({
    __esModule: true,
    default: () => <div data-testid="metric-hierarchy-widget" />,
  })
);

jest.mock(
  '../../components/Metric/MetricDefinitionCard/MetricDefinitionCard',
  () => ({
    __esModule: true,
    default: () => <div data-testid="metric-definition-widget" />,
  })
);

jest.mock('../../components/Metric/RelatedMetrics/RelatedMetrics', () => ({
  __esModule: true,
  default: () => <div data-testid="related-metrics-widget" />,
}));

jest.mock('../../components/DataAssets/CommonWidgets/CommonWidgets', () => ({
  CommonWidgets: (props: unknown) => {
    mockCommonWidget(props);

    return <div data-testid="common-metric-widget" />;
  },
}));

const metric: Metric = {
  id: 'metric-id',
  name: 'gross_margin',
  fullyQualifiedName: 'finance.gross_margin',
};

const fetchMetricDetails = jest.fn();
const metricPermissions = {
  ...DEFAULT_ENTITY_PERMISSION,
  EditAll: true,
  EditLineage: true,
};
const tabProps: MetricDetailPageTabProps = {
  activeTab: EntityTabs.OVERVIEW,
  editCustomAttributePermission: true,
  editLineagePermission: true,
  feedCount: FEED_COUNT_INITIAL_DATA,
  fetchMetricDetails,
  getEntityFeedCount: jest.fn().mockResolvedValue(undefined),
  handleFeedCount: jest.fn(),
  labelMap: {} as Record<EntityTabs, string>,
  metricDetails: metric,
  metricPermissions,
  viewAllPermission: true,
  viewCustomPropertiesPermission: true,
};

const renderNode = (node: ReactNode) =>
  render(<MemoryRouter>{node}</MemoryRouter>);

describe('MetricUtils customization adapters', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses a visible loading fallback while a lazy tab is resolving', async () => {
    const lineage = getMetricDetailsPageTabs(tabProps).find(
      ({ key }) => key === EntityTabs.LINEAGE
    );

    renderNode(lineage?.children);

    expect(screen.getByTestId('metric-utils-loader')).toBeInTheDocument();
    expect(await screen.findByTestId('metric-lineage-tab')).toBeInTheDocument();
  });

  it('returns exactly six primary tabs and renders every tab surface', async () => {
    const tabs = getMetricDetailsPageTabs(tabProps);

    expect(tabs.map(({ key }) => key)).toEqual([
      EntityTabs.OVERVIEW,
      EntityTabs.LINEAGE,
      EntityTabs.ASSETS,
      EntityTabs.DATA_OBSERVABILITY,
      EntityTabs.ACTIVITY_FEED,
      EntityTabs.APPROVAL,
    ]);

    renderNode(
      <>
        {tabs.map(({ children, key }) => (
          <div key={key}>{children}</div>
        ))}
      </>
    );

    await waitFor(() => {
      expect(screen.getByTestId('metric-generic-tab')).toBeInTheDocument();
      expect(screen.getByTestId('metric-lineage-tab')).toBeInTheDocument();
      expect(screen.getByTestId('metric-assets-tab')).toBeInTheDocument();
      expect(
        screen.getByTestId('metric-observability-tab')
      ).toBeInTheDocument();
      expect(screen.getByTestId('metric-activity-tab')).toBeInTheDocument();
      expect(screen.getByTestId('metric-approval-tab')).toBeInTheDocument();
    });
  });

  it('uses the Metric-specific Activity & Tasks label', async () => {
    const activityTab = getMetricDetailsPageTabs(tabProps).find(
      ({ key }) => key === EntityTabs.ACTIVITY_FEED
    );

    renderNode(activityTab?.label);

    expect(
      await screen.findByTestId(`tab-label-${EntityTabs.ACTIVITY_FEED}`)
    ).toHaveTextContent('label.activity-and-task-plural');
  });

  it('passes entity, permission, and refresh contracts to tab implementations', async () => {
    const tabs = getMetricDetailsPageTabs(tabProps);
    renderNode(
      <>
        {tabs.map(({ children, key }) => (
          <div key={key}>{children}</div>
        ))}
      </>
    );

    await waitFor(() => expect(mockAssets).toHaveBeenCalled());

    expect(mockLineage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        entity: metric,
        hasEditAccess: true,
      })
    );
    expect(mockAssets).toHaveBeenLastCalledWith(
      expect.objectContaining({
        metric,
        onAssetsChange: fetchMetricDetails,
        permissions: metricPermissions,
      })
    );
    expect(mockActivity).toHaveBeenLastCalledWith(
      expect.objectContaining({
        entityFeedTotalCount: FEED_COUNT_INITIAL_DATA.totalCount,
        onUpdateEntityDetails: fetchMetricDetails,
      })
    );
    expect(mockApproval).toHaveBeenLastCalledWith(
      expect.objectContaining({
        metric,
        onStatusChange: fetchMetricDetails,
      })
    );
  });

  it.each([
    [DetailPageWidgetKeys.METRIC_HIERARCHY, 'metric-hierarchy-widget'],
    [DetailPageWidgetKeys.METRIC_DEFINITION, 'metric-definition-widget'],
    [DetailPageWidgetKeys.RELATED_METRICS, 'related-metrics-widget'],
  ])('routes %s to its Metric widget', async (key, testId) => {
    renderNode(getMetricWidgetsFromKey({ i: key } as never));

    expect(await screen.findByTestId(testId)).toBeInTheDocument();
  });

  it('routes unrecognized widgets through the common Metric widget adapter', async () => {
    const widgetConfig = {
      h: 1,
      i: DetailPageWidgetKeys.DESCRIPTION,
      w: 1,
      x: 0,
      y: 0,
    };
    renderNode(getMetricWidgetsFromKey(widgetConfig));

    expect(
      await screen.findByTestId('common-metric-widget')
    ).toBeInTheDocument();
    expect(mockCommonWidget).toHaveBeenLastCalledWith(
      expect.objectContaining({ widgetConfig })
    );
  });
});
