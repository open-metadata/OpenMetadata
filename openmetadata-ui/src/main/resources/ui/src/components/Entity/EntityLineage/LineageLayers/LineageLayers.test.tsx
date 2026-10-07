/*
 *  Copyright 2024 Collate.
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
import userEvent from '@testing-library/user-event';
import { ReactFlowProvider } from 'reactflow';
import { EntityType } from '../../../../enums/entity.enum';
import { LineageLens } from '../../../../generated/api/lineage/lineageScene';
import { LineageLayer } from '../../../../generated/settings/settings';
import { LineagePlatformView } from '../../../../hooks/lineage/types';
import { SourceType } from '../../../SearchedData/SearchedData.interface';
import LineageLayers from './LineageLayers';

const mockSetActiveLayer = jest.fn();
const mockSetPlatformView = jest.fn();
let mockActiveLayer: LineageLayer[] = [];

jest.mock('../../../../hooks/useLineageStore', () => ({
  useLineageStore: jest.fn().mockImplementation(() => ({
    activeLayer: mockActiveLayer,
    platformView: 'None',
    setPlatformView: mockSetPlatformView,
    setActiveLayer: mockSetActiveLayer,
  })),
}));

const renderLayers = (props: Parameters<typeof LineageLayers>[0]) =>
  render(
    <ReactFlowProvider>
      <LineageLayers {...props} />
    </ReactFlowProvider>
  );

describe('LineageLayers component', () => {
  afterEach(() => {
    mockActiveLayer = [];
    jest.clearAllMocks();
  });

  it('offers the classic asset layers on an asset page', async () => {
    const user = userEvent.setup({ delay: null });
    renderLayers({
      entityType: EntityType.TABLE,
      entity: { domains: [{ id: 'd' }] } as unknown as SourceType,
    });

    expect(screen.getByText('label.none')).toBeInTheDocument();

    await user.click(screen.getByTestId('lineage-layer-btn'));

    expect(screen.getByTestId('lineage-layer-column-btn')).toBeInTheDocument();
    expect(
      screen.getByTestId('lineage-layer-observability-btn')
    ).toBeInTheDocument();
    expect(screen.getByTestId('lineage-layer-service-btn')).toBeInTheDocument();
    expect(screen.getByTestId('lineage-layer-domain-btn')).toBeInTheDocument();
    expect(
      screen.queryByTestId('lineage-layer-data-product-btn')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('lineage-layer-lens-service')
    ).not.toBeInTheDocument();
  });

  it('toggles store layers and platform view from the asset menu', async () => {
    const user = userEvent.setup({ delay: null });
    renderLayers({ entityType: EntityType.TABLE });

    await user.click(screen.getByTestId('lineage-layer-btn'));
    await user.click(screen.getByTestId('lineage-layer-column-btn'));

    expect(mockSetActiveLayer).toHaveBeenLastCalledWith([
      LineageLayer.ColumnLevelLineage,
    ]);

    await user.click(screen.getByTestId('lineage-layer-service-btn'));

    expect(mockSetPlatformView).toHaveBeenLastCalledWith(
      LineagePlatformView.Service
    );
  });

  it('turns an active asset layer off', async () => {
    mockActiveLayer = [LineageLayer.ColumnLevelLineage];
    const user = userEvent.setup({ delay: null });
    renderLayers({ entityType: EntityType.TABLE });

    expect(screen.getByText('label.column')).toBeInTheDocument();

    await user.click(screen.getByTestId('lineage-layer-btn'));

    expect(screen.getByTestId('lineage-layer-column-btn')).toHaveAttribute(
      'data-selected'
    );

    await user.click(screen.getByTestId('lineage-layer-column-btn'));

    expect(mockSetActiveLayer).toHaveBeenLastCalledWith([]);
  });

  it('switches the lens from the platform Layers menu', async () => {
    const user = userEvent.setup({ delay: null });
    const onSceneLensChange = jest.fn();
    renderLayers({
      sceneLens: LineageLens.Service,
      sceneLevelLabelKey: 'label.lineage-map-schema-level',
      onSceneLensChange,
    });

    expect(
      screen.getByText('label.lineage-map-schema-level')
    ).toBeInTheDocument();

    await user.click(screen.getByTestId('lineage-layer-btn'));

    expect(
      await screen.findByText('message.lineage-map-service-lens-description')
    ).toBeInTheDocument();
    expect(screen.getByTestId('lineage-layer-lens-service')).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(
      screen.queryByTestId('lineage-layer-column-btn')
    ).not.toBeInTheDocument();

    await user.click(screen.getByTestId('lineage-layer-lens-domain'));

    expect(onSceneLensChange).toHaveBeenCalledWith(LineageLens.Domain);
  });
});
