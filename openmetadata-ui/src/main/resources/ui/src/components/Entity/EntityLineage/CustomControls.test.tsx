/*
 *  Copyright 2023 Collate.
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
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { LOADING_STATE } from '../../../enums/common.enum';
import { MOCK_LINEAGE_DATA } from '../../../mocks/Lineage.mock';
import CustomControlsComponent from './CustomControls.component';

const mockFitView = jest.fn();
const mockZoomTo = jest.fn();
const mockOnOptionSelect = jest.fn();
const mockOnLineageConfigUpdate = jest.fn();
const mockOnEditLinageClick = jest.fn();
const mockOnExpandColumnClick = jest.fn();
const mockHandleFullScreenViewClick = jest.fn();
const mockOnExitFullScreenViewClick = jest.fn();
const mockOnZoomHandler = jest.fn();
const mockZoomValue = 1;

jest.mock('reactflow', () => ({
  useReactFlow: () => ({
    fitView: mockFitView,
    zoomTo: mockZoomTo,
  }),
  Position: () => ({
    Left: 'left',
    Top: 'top',
    Right: 'right',
    Bottom: 'bottom',
  }),
  MarkerType: () => ({
    Arrow: 'arrow',
    ArrowClosed: 'arrowclosed',
  }),
}));

const customProps = {
  fitView: mockFitView,
  zoomTo: mockZoomTo,
  onOptionSelect: mockOnOptionSelect,
  onLineageConfigUpdate: mockOnLineageConfigUpdate,
  onEditLinageClick: mockOnEditLinageClick,
  onExpandColumnClick: mockOnExpandColumnClick,
  handleFullScreenViewClick: mockHandleFullScreenViewClick,
  onExitFullScreenViewClick: mockOnExitFullScreenViewClick,
  onZoomHandler: mockOnZoomHandler,
  zoomValue: mockZoomValue,
  deleted: false,
  hasEditAccess: true,
  isEditMode: false,
  lineageData: MOCK_LINEAGE_DATA,
  isColumnsExpanded: false,
  loading: false,
  status: LOADING_STATE.INITIAL,
  lineageConfig: {
    upstreamDepth: 1,
    downstreamDepth: 1,
    nodesPerLayer: 50,
  },
};

describe('CustomControls', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('calls fitView on Fit View button click', () => {
    const { getByTestId } = render(
      <CustomControlsComponent {...customProps} />
    );
    const fitViewButton = getByTestId('fit-to-screen');
    fireEvent.click(fitViewButton);

    expect(mockFitView).toHaveBeenCalled();
  });

  it('calls zoomTo with zoomInValue on Zoom In button click', () => {
    const { getByTestId } = render(
      <CustomControlsComponent {...customProps} />
    );
    const zoomInButton = getByTestId('zoom-in-button');
    fireEvent.click(zoomInButton);
    const zoomRangeInput = getByTestId(
      'lineage-zoom-slider'
    ) as HTMLInputElement;

    expect(zoomRangeInput.value).toBe('0.75');
  });

  it('calls zoomTo with zoomOutValue on Zoom Out button click', () => {
    const { getByTestId } = render(
      <CustomControlsComponent {...customProps} />
    );
    const zoomOutButton = getByTestId('zoom-out-button');
    fireEvent.click(zoomOutButton);
    const zoomRangeInput = getByTestId(
      'lineage-zoom-slider'
    ) as HTMLInputElement;

    expect(zoomRangeInput.value).toBe('1.25');
  });

  it('calls onEditLinageClick on Edit Lineage button click', () => {
    const { getByTestId } = render(
      <CustomControlsComponent {...customProps} />
    );
    const editLineageButton = getByTestId('edit-lineage');
    fireEvent.click(editLineageButton);

    expect(mockOnEditLinageClick).toHaveBeenCalled();
  });

  it('calls onExpandColumnClick on Expand Column button click', () => {
    const { getByTestId } = render(
      <CustomControlsComponent {...customProps} />
    );
    const expandColumnButton = getByTestId('expand-column');
    fireEvent.click(expandColumnButton);

    expect(mockOnExpandColumnClick).toHaveBeenCalled();
  });

  it('calls mockHandleFullScreenViewClick on Full Screen button click', () => {
    const { getByTestId } = render(
      <CustomControlsComponent {...customProps} />
    );
    const fullScreenButton = getByTestId('full-screen');
    fireEvent.click(fullScreenButton);

    expect(mockHandleFullScreenViewClick).toHaveBeenCalled();
  });

  it('calls mockOnExitFullScreenViewClick on Exit Full Screen button click', () => {
    const { getByTestId } = render(
      <CustomControlsComponent {...customProps} />
    );
    const exitFullScreenButton = getByTestId('exit-full-screen');
    fireEvent.click(exitFullScreenButton);

    expect(mockOnExitFullScreenViewClick).toHaveBeenCalled();
  });

  it('should show lineage config dialog on setting button click', () => {
    const { getByTestId, getByRole } = render(
      <CustomControlsComponent {...customProps} />
    );
    const settingButton = getByTestId('lineage-config');
    fireEvent.click(settingButton);
    const dialog = getByRole('dialog');

    expect(dialog).toBeInTheDocument();
  });
});
