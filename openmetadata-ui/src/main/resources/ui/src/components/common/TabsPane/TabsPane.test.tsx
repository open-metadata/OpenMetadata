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

import { getByTestId, render, screen } from '@testing-library/react';
import React from 'react';
import TabsPane from './TabsPane';

const MOCK_TAB = [
  {
    name: 'Database',
    isProtected: false,
    position: 2,
    count: 5,
  },
  {
    name: 'Ingestion',
    isProtected: false,
    position: 2,
    count: 10,
  },
  {
    name: 'Connection',
    isHidden: true,
    position: 3,
    isProtected: true,
  },
];

const MOCK_PROPS = {
  activeTab: 1,
  setActiveTab: jest.fn(),
  tabs: MOCK_TAB,
  className: '',
};

describe('Test TabsPane Component', () => {
  it('Component should render', () => {
    render(<TabsPane {...MOCK_PROPS} />);

    const component = screen.getByTestId('tabs');

    expect(component).toBeInTheDocument();
  });

  it('Should render tabs in Component', () => {
    render(<TabsPane {...MOCK_PROPS} />);

    const databaseTab = screen.getByTestId('Database');
    const ingestionTab = screen.getByTestId('Ingestion');

    expect(databaseTab).toBeInTheDocument();
    expect(ingestionTab).toBeInTheDocument();

    const databaseTabCount = getByTestId(databaseTab, 'filter-count');
    const ingestionTabCount = getByTestId(ingestionTab, 'filter-count');

    expect(databaseTabCount).toContainHTML('5');
    expect(ingestionTabCount).toContainHTML('10');
  });

  it('Should not render protected tab', () => {
    render(<TabsPane {...MOCK_PROPS} />);

    const connectionTab = screen.queryByTestId('Connection');

    expect(connectionTab).not.toBeInTheDocument();
  });
});
