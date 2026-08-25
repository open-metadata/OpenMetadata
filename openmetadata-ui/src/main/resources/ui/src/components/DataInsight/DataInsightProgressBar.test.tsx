/*
 *  Copyright 2022 Collate.
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
import { MemoryRouter } from 'react-router-dom';
import { act } from 'react-test-renderer';
import DataInsightProgressBar from './DataInsightProgressBar';

const MOCK_DATA = {
  changeInValue: -0.32000000000000006,
  className: 'm-b-md',
  duration: 30,
  label: undefined,
  progress: 99.66,
  showEndValueAsLabel: true,
  showLabel: false,
  showSuccessInfo: false,
  startValue: undefined,
  successValue: 'No Tier',
  suffix: '%',
  target: 55.00000000000001,
  width: 100,
};

jest.mock('./CustomStatistic', () => {
  return jest
    .fn()
    .mockImplementation(() => <div>CustomStatistic.component</div>);
});

describe('Test DataInsightProgressBar Component', () => {
  it('Should render the ProgressBar Component', async () => {
    await act(async () => {
      render(<DataInsightProgressBar {...MOCK_DATA} />, {
        wrapper: MemoryRouter,
      });
    });

    const progressBarContainer = screen.getByTestId('progress-bar-container');

    expect(progressBarContainer).toBeInTheDocument();
  });

  it('render value pass into component', async () => {
    await act(async () => {
      render(<DataInsightProgressBar {...MOCK_DATA} />, {
        wrapper: MemoryRouter,
      });
    });

    const progressBarContainer = screen.getByTestId('progress-bar-container');

    expect(progressBarContainer).toBeInTheDocument();

    const progressBarLabel = screen.getByText('CustomStatistic.component');

    expect(progressBarLabel).toBeInTheDocument();
  });
});
