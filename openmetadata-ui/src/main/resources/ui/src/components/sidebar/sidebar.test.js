/*
 *  Copyright 2021 Collate
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

import { render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Icons } from '../../utils/SvgUtils';
import Sidebar from './Sidebar';

describe('Test Sidebar component', () => {
  it('Check for expanded state default', () => {
    const { getByTestId } = render(<Sidebar />, {
      wrapper: MemoryRouter,
    });
    const logo = getByTestId('sidebar');

    expect(logo).toHaveClass('expanded-sidebar');
  });

  it('Check for collapsed state when passed through props', () => {
    const { getByTestId } = render(<Sidebar isCollapsed />, {
      wrapper: MemoryRouter,
    });
    const logo = getByTestId('sidebar');

    expect(logo).toHaveClass('collapsed-sidebar');
  });

  it('Check for render Items by default', () => {
    const { getAllByTestId } = render(<Sidebar />, {
      wrapper: MemoryRouter,
    });
    const items = getAllByTestId('sidebar-item');

    expect(items).toHaveLength(7);
    expect(items.map((i) => i.textContent)).toEqual([
      'My Data',
      'Reports',
      'Explore',
      'Workflows',
      'SQL Builder',
      'Teams',
      'Settings',
    ]);
  });

  it('Check for render Items that we passed', () => {
    const { getAllByTestId } = render(
      <Sidebar
        navItems={[
          { name: 'My Data', to: '/my-data', icon: Icons.MY_DATA },
          { name: 'Reports', to: '/reports', icon: Icons.REPORTS },
          { name: 'Explore', to: '/explore', icon: Icons.EXPLORE },
        ]}
      />,
      {
        wrapper: MemoryRouter,
      }
    );
    const items = getAllByTestId('sidebar-item');

    expect(items).toHaveLength(3);
    expect(items.map((i) => i.textContent)).toEqual([
      'My Data',
      'Reports',
      'Explore',
    ]);
  });
});
