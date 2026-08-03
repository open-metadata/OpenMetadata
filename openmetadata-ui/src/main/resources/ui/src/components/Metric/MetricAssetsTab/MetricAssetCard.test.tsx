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
/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EntityType } from '../../../enums/entity.enum';
import {
  Direction,
  Health,
} from '../../../generated/api/data/metricObservability';
import MetricAssetCard from './MetricAssetCard';

const relation = {
  affectsHealth: true,
  asset: {
    fullyQualifiedName: 'service.database.schema.orders',
    id: 'table-1',
    name: 'orders',
    type: EntityType.TABLE,
  },
  direction: Direction.Upstream,
};

describe('MetricAssetCard', () => {
  it('is keyboard selectable and renders enriched localized metadata', async () => {
    const onActivate = jest.fn();
    const onToggle = jest.fn();
    render(
      <MemoryRouter>
        <MetricAssetCard
          showSelection
          details={{
            asset: relation.asset,
            columns: [],
            containment: [],
            description: 'Canonical orders table',
            domains: [{ id: 'domain-1', name: 'Commerce', type: 'domain' }],
            glossaryTerms: [],
            owners: [{ id: 'user-1', name: 'Alice', type: 'user' }],
            tags: [],
            tier: 'Tier.Tier1',
            usageCount: 42,
          }}
          health={{
            asset: relation.asset,
            health: Health.Healthy,
            score: 100,
            total: 2,
          }}
          isActive={false}
          isSelected={false}
          relation={relation}
          onActivate={onActivate}
          onToggle={onToggle}
        />
      </MemoryRouter>
    );

    const activation = screen.getByRole('button', { name: 'orders' });

    expect(activation).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('metric-asset-card-table-1')).toHaveTextContent(
      'Canonical orders table'
    );
    expect(screen.getByTestId('metric-asset-card-table-1')).toHaveTextContent(
      'label.owner-plural: Alice'
    );
    expect(screen.getByTestId('metric-asset-card-table-1')).toHaveTextContent(
      'label.domain-plural: Commerce'
    );
    expect(screen.getByTestId('metric-asset-card-table-1')).toHaveTextContent(
      'label.tier: Tier1'
    );
    expect(screen.getByTestId('metric-asset-card-table-1')).toHaveTextContent(
      'label.usage: 42'
    );

    act(() => activation.focus());
    fireEvent.keyDown(activation, { key: 'Enter' });
    fireEvent.keyUp(activation, { key: 'Enter' });
    fireEvent.keyDown(activation, { key: ' ' });
    fireEvent.keyUp(activation, { key: ' ' });

    expect(onActivate).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('checkbox'));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows unknown health and zero tests when an upstream source has no result', () => {
    render(
      <MemoryRouter>
        <MetricAssetCard
          details={{
            asset: relation.asset,
            columns: [],
            containment: [],
            domains: [],
            glossaryTerms: [],
            owners: [],
            tags: [],
          }}
          isActive={false}
          isSelected={false}
          relation={relation}
          showSelection={false}
          onActivate={jest.fn()}
          onToggle={jest.fn()}
        />
      </MemoryRouter>
    );

    expect(
      screen.getByTestId('metric-asset-health-table-1')
    ).toHaveAccessibleName('label.unknown');
    expect(screen.getByTestId('metric-asset-card-table-1')).toHaveTextContent(
      'label.test-plural: 0'
    );
  });

  it('announces detail loading and exposes a retry for an isolated error', () => {
    const onRetryDetails = jest.fn();
    const { rerender } = render(
      <MemoryRouter>
        <MetricAssetCard
          isDetailsLoading
          details={{
            asset: relation.asset,
            columns: [],
            containment: [],
            domains: [],
            glossaryTerms: [],
            owners: [],
            tags: [],
          }}
          isActive={false}
          isSelected={false}
          relation={relation}
          showSelection={false}
          onActivate={jest.fn()}
          onRetryDetails={onRetryDetails}
          onToggle={jest.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('status', { name: 'label.loading' })).toBeVisible();

    rerender(
      <MemoryRouter>
        <MetricAssetCard
          hasDetailsError
          details={{
            asset: relation.asset,
            columns: [],
            containment: [],
            domains: [],
            glossaryTerms: [],
            owners: [],
            tags: [],
          }}
          isActive={false}
          isSelected={false}
          relation={relation}
          showSelection={false}
          onActivate={jest.fn()}
          onRetryDetails={onRetryDetails}
          onToggle={jest.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'server.entity-fetch-error'
    );

    fireEvent.click(screen.getByTestId('metric-asset-details-retry-table-1'));

    expect(onRetryDetails).toHaveBeenCalledTimes(1);
  });
});
