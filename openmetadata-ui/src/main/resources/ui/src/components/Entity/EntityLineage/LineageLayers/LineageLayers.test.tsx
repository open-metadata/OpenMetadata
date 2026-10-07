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
import {
  act,
  fireEvent,
  queryByText,
  render,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlowProvider } from 'reactflow';
import { EntityType } from '../../../../enums/entity.enum';
import {
  LineageBand,
  LineageLens,
} from '../../../../generated/api/lineage/lineageScene';
import { LineageLayer } from '../../../../generated/settings/settings';
import LineageLayers from './LineageLayers';

const mockSetActiveLayer = jest.fn();
const mockSetPlatformView = jest.fn();

let mockIsPlatformLineage = false;

jest.mock('../../../../hooks/useLineageStore', () => ({
  useLineageStore: jest.fn().mockImplementation(() => ({
    activeLayer: [],
    platformView: [],
    setPlatformView: mockSetPlatformView,
    isPlatformLineage: mockIsPlatformLineage,
    setActiveLayer: mockSetActiveLayer,
  })),
}));

describe('LineageLayers component', () => {
  afterEach(() => {
    mockIsPlatformLineage = false;
  });

  it('renders LineageLayers component', () => {
    const { container } = render(
      <ReactFlowProvider>
        <LineageLayers entityType={EntityType.TABLE} />
      </ReactFlowProvider>
    );
    const layerBtn = screen.getByText('label.layer-plural');

    expect(layerBtn).toBeInTheDocument();

    const columnButton = queryByText(container, 'label.column');
    const pipelineButton = queryByText(container, 'label.pipeline');
    const dataQualityButton = queryByText(container, 'label.data-quality');

    expect(columnButton).not.toBeInTheDocument();
    expect(pipelineButton).not.toBeInTheDocument();
    expect(dataQualityButton).not.toBeInTheDocument();
  });

  it('calls onUpdateLayerView when a button is clicked', async () => {
    render(
      <ReactFlowProvider>
        <LineageLayers entityType={EntityType.TABLE} />
      </ReactFlowProvider>
    );

    const layerBtn = screen.getByTestId('lineage-layer-btn');

    await act(async () => {
      fireEvent.click(layerBtn);
    });

    const columnButton = screen.getByText('label.column');
    const dataObservabilityBtn = screen.getByText('label.observability');

    expect(columnButton).toBeInTheDocument();
    expect(dataObservabilityBtn).toBeInTheDocument();

    fireEvent.click(columnButton as HTMLElement);

    expect(mockSetActiveLayer).toHaveBeenCalledWith([
      LineageLayer.ColumnLevelLineage,
    ]);

    fireEvent.click(dataObservabilityBtn as HTMLElement);

    expect(mockSetActiveLayer).toHaveBeenCalledWith([
      LineageLayer.DataObservability,
    ]);
  });

  it('toggles column level from the asset-page Layers menu', async () => {
    const user = userEvent.setup({ delay: null });
    const onSceneBandChange = jest.fn();

    const { unmount } = render(
      <ReactFlowProvider>
        <LineageLayers
          entityType={EntityType.TABLE}
          sceneBand={LineageBand.Asset}
          sceneLens={LineageLens.Service}
          onSceneBandChange={onSceneBandChange}
          onSceneLensChange={jest.fn()}
        />
      </ReactFlowProvider>
    );

    await user.click(screen.getByTestId('lineage-layer-btn'));

    expect(
      screen.queryByTestId('lineage-layer-lens-service')
    ).not.toBeInTheDocument();

    await user.click(screen.getByTestId('lineage-layer-band-FIELD'));

    expect(onSceneBandChange).toHaveBeenLastCalledWith(LineageBand.Field);

    unmount();
    render(
      <ReactFlowProvider>
        <LineageLayers
          entityType={EntityType.TABLE}
          sceneBand={LineageBand.Field}
          sceneLens={LineageLens.Service}
          onSceneBandChange={onSceneBandChange}
          onSceneLensChange={jest.fn()}
        />
      </ReactFlowProvider>
    );
    await user.click(screen.getByTestId('lineage-layer-btn'));

    expect(screen.getByTestId('lineage-layer-band-FIELD')).toHaveAttribute(
      'aria-checked',
      'true'
    );

    await user.click(screen.getByTestId('lineage-layer-band-FIELD'));

    expect(onSceneBandChange).toHaveBeenLastCalledWith(LineageBand.Asset);
  });

  it('switches the lens from the platform Layers menu', async () => {
    mockIsPlatformLineage = true;
    const user = userEvent.setup({ delay: null });
    const onSceneBandChange = jest.fn();
    const onSceneLensChange = jest.fn();

    render(
      <ReactFlowProvider>
        <LineageLayers
          entityType={EntityType.TABLE}
          sceneBand={LineageBand.Layer}
          sceneLens={LineageLens.Service}
          sceneLevelLabelKey="label.lineage-map-schema-level"
          onSceneBandChange={onSceneBandChange}
          onSceneLensChange={onSceneLensChange}
        />
      </ReactFlowProvider>
    );

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

    await user.click(screen.getByTestId('lineage-layer-lens-domain'));

    expect(onSceneLensChange).toHaveBeenCalledWith(LineageLens.Domain);
    expect(onSceneBandChange).not.toHaveBeenCalled();
  });
});
