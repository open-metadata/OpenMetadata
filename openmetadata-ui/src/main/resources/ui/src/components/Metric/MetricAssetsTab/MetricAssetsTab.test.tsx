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
import { render, screen } from '@testing-library/react';
import { AssetsOfEntity } from '../../../enums/Assets.enum';
import { Metric } from '../../../generated/entity/data/metric';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import AssetsTabs from '../../Glossary/GlossaryTerms/tabs/AssetsTabs.component';
import { MetricAssetsTab } from './MetricAssetsTab';

jest.mock('../../Glossary/GlossaryTerms/tabs/AssetsTabs.component', () =>
  jest.fn().mockReturnValue(<div data-testid="assets-tabs" />)
);

jest.mock('../../Explore/EntitySummaryPanel/EntitySummaryPanel.component', () =>
  jest.fn().mockReturnValue(<div data-testid="entity-summary-panel" />)
);

jest.mock('../../common/ResizablePanels/ResizablePanels', () =>
  jest
    .fn()
    .mockImplementation(({ firstPanel }) => <div>{firstPanel.children}</div>)
);

jest.mock('../../common/Loader/Loader', () =>
  jest.fn().mockReturnValue(<div data-testid="loader" />)
);

const metric = {
  id: 'metric-id',
  name: 'revenue',
  fullyQualifiedName: 'revenue',
} as Metric;

const defaultProps = {
  metric,
  isLoading: false,
  permissions: DEFAULT_ENTITY_PERMISSION,
  onAddAsset: jest.fn(),
  onRemoveAsset: jest.fn(),
};

describe('MetricAssetsTab', () => {
  it('shows a loader until the linked assets are known', () => {
    render(<MetricAssetsTab {...defaultProps} isLoading />);

    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(screen.queryByTestId('assets-tabs')).not.toBeInTheDocument();
  });

  it('lists only the linked assets of the metric', () => {
    render(<MetricAssetsTab {...defaultProps} assetIds={['a', 'b']} />);

    expect(AssetsTabs).toHaveBeenCalledWith(
      expect.objectContaining({
        assetCount: 2,
        entityFqn: 'revenue',
        type: AssetsOfEntity.METRIC,
        queryFilter: {
          query: { bool: { must: [{ ids: { values: ['a', 'b'] } }] } },
        },
      }),
      expect.anything()
    );
  });
});
