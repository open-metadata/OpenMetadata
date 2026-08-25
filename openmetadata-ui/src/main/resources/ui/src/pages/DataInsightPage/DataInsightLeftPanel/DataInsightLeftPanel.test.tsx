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
import DataInsightLeftPanel from './DataInsightLeftPanel';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
  useParams: jest.fn().mockReturnValue({ tab: 'data-assets' }),
}));

describe('Test Data insight left panel', () => {
  it('Should render the menu items', async () => {
    render(<DataInsightLeftPanel />);

    const menuContainer = await screen.findByTestId('data-insight-left-panel');

    const dataAssets = await screen.findByText('label.data-asset-plural');
    const appAnalytics = await screen.findByText('label.app-analytic-plural');
    const kpi = await screen.findByText('label.kpi-uppercase-plural');

    expect(menuContainer).toBeInTheDocument();
    expect(dataAssets).toBeInTheDocument();
    expect(appAnalytics).toBeInTheDocument();
    expect(kpi).toBeInTheDocument();
  });

  it('On clicking the menu item, route should change', async () => {
    render(<DataInsightLeftPanel />);

    const appAnalytics = await screen.findByText('label.app-analytic-plural');
    const kpi = await screen.findByText('label.kpi-uppercase-plural');

    expect(appAnalytics).toBeInTheDocument();
    expect(kpi).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(appAnalytics);
    });

    expect(mockNavigate).toHaveBeenCalled();
  });
});
