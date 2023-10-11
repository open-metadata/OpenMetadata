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

import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { DataInsightTabs } from '../../../interface/data-insight.interface';
import DataInsightLeftPanel from './DataInsightLeftPanel';

const mockPush = jest.fn();

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => ({
    push: mockPush,
  })),
  useParams: jest.fn().mockReturnValue({ tab: 'data-assets' }),
}));

jest.mock('../DataInsightClassBase', () => {
  return jest.fn().mockImplementation(() => ({
    getLeftSideBar: jest.fn().mockReturnValue([
      {
        key: DataInsightTabs.DATA_ASSETS,
        label: 'Data Assets',
        icon: <svg />,
        iconProps: {
          className: 'side-panel-icons',
        },
      },
    ]),
  }));
});

describe('Test Data insight left panel', () => {
  it('Should render the menu items', async () => {
    render(<DataInsightLeftPanel />);

    const menuContainer = await screen.findByTestId('data-insight-left-panel');

    const dataAssets = await screen.findByText('Data Assets');

    expect(menuContainer).toBeInTheDocument();
    expect(dataAssets).toBeInTheDocument();
  });

  it('On clicking the menu item, route should change', async () => {
    render(<DataInsightLeftPanel />);

    const appAnalytics = await screen.findByText('label.app-analytic-plural');
    const kpi = await screen.findByText('label.kpi-uppercases');

    expect(appAnalytics).toBeInTheDocument();
    expect(kpi).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(appAnalytics);
    });

    expect(mockPush).toHaveBeenCalled();
  });
});
