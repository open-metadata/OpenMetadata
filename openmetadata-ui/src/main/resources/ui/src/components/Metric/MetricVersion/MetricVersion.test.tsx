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
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Metric } from '../../../generated/entity/data/metric';
import {
  EntityStatus,
  MetricGranularity,
  MetricType,
  UnitOfMeasurement,
} from '../../../generated/entity/data/metric';
import { LabelType, State, TagSource } from '../../../generated/type/tagLabel';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import MetricVersion from './MetricVersion';
import type { MetricVersionProp } from './MetricVersion.interface';

jest.mock('../MetricExpression/MetricExpression', () => ({
  __esModule: true,
  default: ({ metric }: { metric: Metric }) => (
    <div data-testid="version-expression">{metric.metricExpression?.code}</div>
  ),
}));

jest.mock(
  '../../DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader',
  () => ({
    __esModule: true,
    default: ({
      displayName,
      onVersionClick,
    }: {
      displayName: string;
      onVersionClick: () => void;
    }) => (
      <button data-testid="version-header" onClick={onVersionClick}>
        {displayName}
      </button>
    ),
  })
);

jest.mock('../../Entity/EntityVersionTimeLine/EntityVersionTimeLine', () => ({
  __esModule: true,
  default: ({ versionHandler }: { versionHandler: (v: string) => void }) => (
    <button data-testid="version-0.1" onClick={() => versionHandler('0.1')}>
      timeline
    </button>
  ),
}));

jest.mock('../../common/EntityDescription/Description', () => ({
  __esModule: true,
  default: ({ description }: { description: string }) => (
    <div data-testid="version-description">{description}</div>
  ),
}));

jest.mock('../../common/CustomPropertyTable/CustomPropertyTable', () => ({
  CustomPropertyTable: ({ hasPermission }: { hasPermission: boolean }) => (
    <div data-testid="version-custom-properties">
      {hasPermission ? 'can-view' : 'no-view'}
    </div>
  ),
}));

jest.mock('../../Tag/TagsContainerV2/TagsContainerV2', () => ({
  __esModule: true,
  default: () => <div data-testid="version-tags" />,
}));

jest.mock(
  '../../DataProducts/DataProductsContainer/DataProductsContainer.component',
  () => ({
    __esModule: true,
    default: () => <div data-testid="version-data-products" />,
  })
);

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  GenericProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

const metric: Metric = {
  id: 'metric-id',
  name: 'margin',
  displayName: 'Margin',
  fullyQualifiedName: 'finance.margin',
  description: 'Gross profit divided by revenue',
  metricType: MetricType.Ratio,
  granularity: MetricGranularity.Day,
  unitOfMeasurement: UnitOfMeasurement.Other,
  customUnitOfMeasurement: 'Leads',
  entityStatus: EntityStatus.Approved,
  metricExpression: { code: 'profit / revenue' },
};

const props: MetricVersionProp = {
  version: '0.2',
  currentVersionData: metric,
  isVersionLoading: false,
  owners: [{ id: 'owner', name: 'analytics', type: 'team' }],
  domains: [{ id: 'domain', name: 'finance', type: 'domain' }],
  tier: {
    labelType: LabelType.Manual,
    source: TagSource.Classification,
    state: State.Confirmed,
    tagFQN: 'Tier.Tier1',
  },
  slashedMetricName: [{ name: 'Metrics', url: '/metrics' }],
  versionList: {
    entityType: 'metric',
    versions: [
      JSON.stringify({ ...metric, version: 0.2 }),
      JSON.stringify({ ...metric, version: 0.1 }),
    ],
  },
  backHandler: jest.fn(),
  versionHandler: jest.fn(),
  entityPermissions: {
    ...DEFAULT_ENTITY_PERMISSION,
    ViewAll: true,
    ViewBasic: true,
    ViewCustomFields: true,
  },
};

const renderVersion = (override: Partial<MetricVersionProp> = {}) =>
  render(
    <MemoryRouter>
      <MetricVersion {...props} {...override} />
    </MemoryRouter>
  );

describe('MetricVersion', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the standard version scaffold with Overview and Custom Properties tabs', () => {
    renderVersion();

    expect(screen.getByTestId('version-header')).toHaveTextContent('Margin');
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(
      screen.getByRole('tab', { name: 'label.overview' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'label.custom-property-plural' })
    ).toBeInTheDocument();
    expect(screen.getByTestId('version-expression')).toHaveTextContent(
      'profit / revenue'
    );
    expect(screen.getByTestId('version-description')).toHaveTextContent(
      'Gross profit divided by revenue'
    );
  });

  it('shows the definition metadata on the Overview tab', () => {
    renderVersion();

    const definition = screen.getByTestId('metric-definition-card');

    expect(definition).toHaveTextContent('label.ratio');
    expect(definition).toHaveTextContent('Leads');
    expect(definition).toHaveTextContent('label.day');
  });

  it('highlights changed definition fields from changeDescription', () => {
    renderVersion({
      currentVersionData: {
        ...metric,
        changeDescription: {
          fieldsAdded: [],
          fieldsDeleted: [],
          fieldsUpdated: [
            {
              name: 'metricType',
              oldValue: MetricType.Average,
              newValue: MetricType.Ratio,
            },
          ],
          previousVersion: 0.1,
        },
      },
    });

    const definition = screen.getByTestId('metric-definition-card');

    expect(definition).toHaveTextContent(MetricType.Average);
    expect(definition).toHaveTextContent(MetricType.Ratio);
    expect(screen.getByTestId('diff-added')).toBeInTheDocument();
    expect(screen.getByTestId('diff-removed')).toBeInTheDocument();
  });

  it('renders the custom properties tab content with view permission', () => {
    renderVersion();

    fireEvent.click(
      screen.getByRole('tab', { name: 'label.custom-property-plural' })
    );

    expect(screen.getByTestId('version-custom-properties')).toHaveTextContent(
      'can-view'
    );
  });

  it('renders a loading state', () => {
    renderVersion({ isVersionLoading: true });

    expect(screen.queryByTestId('version-header')).not.toBeInTheDocument();
  });

  it('navigates back from the header and selects a historical version', () => {
    renderVersion();

    fireEvent.click(screen.getByTestId('version-header'));
    fireEvent.click(screen.getByTestId('version-0.1'));

    expect(props.backHandler).toHaveBeenCalledTimes(1);
    expect(props.versionHandler).toHaveBeenCalledWith('0.1');
  });
});
