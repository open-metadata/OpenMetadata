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
