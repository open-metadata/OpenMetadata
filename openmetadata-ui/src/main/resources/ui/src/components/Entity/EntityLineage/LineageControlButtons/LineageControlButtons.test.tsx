/*
 *  Copyright 2025 Collate.
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
import LineageControlButtons from './LineageControlButtons';

const mockZoomIn = jest.fn();
const mockZoomOut = jest.fn();
const mockFitView = jest.fn();
const mockReactFlowInstance = {
  zoomIn: mockZoomIn,
  zoomOut: mockZoomOut,
  fitView: mockFitView,
};
let mockZoom = 1;

const mockLineageState = {
  reactFlowInstance: mockReactFlowInstance as
    | typeof mockReactFlowInstance
    | undefined,
};

jest.mock('reactflow', () => ({
  useViewport: () => ({ x: 0, y: 0, zoom: mockZoom }),
}));

jest.mock('../../../../hooks/useLineageStore', () => ({
  useLineageStore: jest.fn((selector) =>
    selector ? selector(mockLineageState) : mockLineageState
  ),
}));

const mockOnToggleMiniMap = jest.fn();

const renderControls = (miniMapVisible = false, onFitView?: () => void) =>
  render(
    <LineageControlButtons
      miniMapVisible={miniMapVisible}
      onFitView={onFitView}
      onToggleMiniMap={mockOnToggleMiniMap}
    />
  );

describe('LineageControlButtons', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockZoom = 1;
    mockLineageState.reactFlowInstance = mockReactFlowInstance;
  });

  it('gives every icon button an accessible name', () => {
    renderControls();

    expect(
      screen.getByRole('button', { name: 'label.mind-map' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'label.zoom-in' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'label.zoom-out' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'label.fit-to-screen' })
    ).toBeInTheDocument();
  });

  it('shows the viewport zoom as a percentage', () => {
    mockZoom = 0.746;
    renderControls();

    expect(screen.getByTestId('zoom-level')).toHaveTextContent('75%');
  });

  it('marks the mini map toggle as pressed only while it is shown', () => {
    const { unmount } = renderControls(false);

    expect(screen.getByTestId('toggle-mind-map')).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    unmount();
    renderControls(true);

    expect(screen.getByTestId('toggle-mind-map')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('toggles the mini map', () => {
    renderControls();
    fireEvent.click(screen.getByTestId('toggle-mind-map'));

    expect(mockOnToggleMiniMap).toHaveBeenCalledTimes(1);
  });

  it('zooms in and out through the flow instance', () => {
    renderControls();
    fireEvent.click(screen.getByTestId('zoom-in'));
    fireEvent.click(screen.getByTestId('zoom-out'));

    expect(mockZoomIn).toHaveBeenCalledTimes(1);
    expect(mockZoomOut).toHaveBeenCalledTimes(1);
  });

  it('does not throw without a flow instance', () => {
    mockLineageState.reactFlowInstance = undefined;
    renderControls();

    expect(() => fireEvent.click(screen.getByTestId('zoom-in'))).not.toThrow();
  });

  it('fits the view with the map handler when one is given', () => {
    const onFitView = jest.fn();
    renderControls(false, onFitView);
    fireEvent.click(screen.getByTestId('fit-screen'));

    expect(onFitView).toHaveBeenCalledTimes(1);
    expect(mockFitView).not.toHaveBeenCalled();
  });

  it('falls back to the flow instance fitView', () => {
    renderControls();
    fireEvent.click(screen.getByTestId('fit-screen'));

    expect(mockFitView).toHaveBeenCalledWith({ padding: 0.2, maxZoom: 1 });
  });
});
