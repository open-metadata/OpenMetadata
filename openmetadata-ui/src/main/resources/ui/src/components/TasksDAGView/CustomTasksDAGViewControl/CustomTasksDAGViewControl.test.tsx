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
import { render, screen } from '@testing-library/react';
import React from 'react';
import {
  MAX_ZOOM_VALUE,
  MIN_ZOOM_VALUE,
} from '../../../constants/Lineage.constants';
import CustomTasksDAGViewControl from './CustomTasksDAGViewControl.component';

const mockProps = {
  zoomValue: 1,
  fitViewParams: {
    minZoom: MIN_ZOOM_VALUE,
    maxZoom: MAX_ZOOM_VALUE,
  },
};

jest.mock('reactflow', () => ({
  useReactFlow: jest.fn(() => ({
    fitView: jest.fn(),
    zoomTo: jest.fn(),
  })),
}));

describe('CustomTasksDAGViewControl', () => {
  it('component should render', async () => {
    render(<CustomTasksDAGViewControl {...mockProps} />);

    const component = await screen.findByTestId(
      'custom-tasks-dag-view-control'
    );
    const zoomInBtn = await screen.findByTestId('zoom-in-button');
    const zoomOutBtn = await screen.findByTestId('zoom-out-button');
    const zoomSlider = await screen.findByTestId('zoom-slider');
    const fitToScreen = await screen.findByTestId('fit-to-screen');

    expect(component).toBeInTheDocument();
    expect(zoomInBtn).toBeInTheDocument();
    expect(zoomOutBtn).toBeInTheDocument();
    expect(zoomSlider).toBeInTheDocument();
    expect(fitToScreen).toBeInTheDocument();
  });
});
