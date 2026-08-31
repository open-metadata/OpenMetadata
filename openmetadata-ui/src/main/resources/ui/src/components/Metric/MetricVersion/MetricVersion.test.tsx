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
  MetricType,
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

const metric: Metric = {
  id: 'metric-id',
  name: 'margin',
  displayName: 'Margin',
  fullyQualifiedName: 'finance.margin',
  description: 'Gross profit divided by revenue',
  metricType: MetricType.Ratio,
  entityStatus: EntityStatus.Approved,
  metricExpression: { code: 'profit / revenue' },
  extension: {
    stewardNote: 'Reviewed',
    thresholds: { warning: 75, critical: 50 },
  },
};

const props: MetricVersionProp = {
  version: '1.1',
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
  versionList: { entityType: 'metric', versions: ['1.0', '1.1'] },
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

  it('renders one Overview tab with custom properties inside its content', () => {
    renderVersion();

    expect(screen.getAllByRole('tab')).toHaveLength(1);
    expect(
      screen.getByRole('tab', { name: 'label.overview' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('tab', { name: /custom-property/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId('metric-version-custom-properties')
    ).toHaveTextContent('stewardNote');
    expect(
      screen.getByTestId('metric-version-custom-properties')
    ).toHaveTextContent('"warning": 75');
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument();
    expect(screen.getByTestId('version-expression')).toHaveTextContent(
      'profit / revenue'
    );
    expect(screen.getByText('label.ratio')).toBeInTheDocument();
    expect(screen.getByText('label.approved')).toBeInTheDocument();
  });

  it('hides custom properties without view permission', () => {
    renderVersion({ entityPermissions: DEFAULT_ENTITY_PERMISSION });

    expect(
      screen.queryByTestId('metric-version-custom-properties')
    ).not.toBeInTheDocument();
  });

  it('renders an accessible loading state', () => {
    renderVersion({ isVersionLoading: true });

    expect(
      screen.getByRole('status', { name: 'label.loading' })
    ).toBeInTheDocument();
  });

  it('navigates back and selects a historical version from keyboard-ready buttons', () => {
    renderVersion();

    fireEvent.click(screen.getByRole('button', { name: 'label.back' }));
    fireEvent.click(screen.getByTestId('version-1.0'));

    expect(props.backHandler).toHaveBeenCalledTimes(1);
    expect(props.versionHandler).toHaveBeenCalledWith('1.0');
  });
});
