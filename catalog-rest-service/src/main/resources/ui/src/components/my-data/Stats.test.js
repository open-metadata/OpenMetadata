import { findByTestId, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { statData } from '../../pages/my-data/index.mock';
import Stats from './Stats';

describe('Test Stats Component', () => {
  const { testdata1, testdata2 } = statData;

  it('Renders the proper HTML when badge is TABLE', async () => {
    const { badgeName, generalStats, tableStats } = testdata1;
    const { container } = render(
      <Stats
        badgeName={badgeName}
        generalStats={generalStats}
        tableStats={tableStats}
      />,
      { wrapper: MemoryRouter }
    );
    const linkElement = await findByTestId(container, 'stats-link');

    expect(linkElement.textContent).toBe('View all 18 instances');
  });

  it('Renders the proper HTML when badge is not TABLE', async () => {
    const { badgeName, generalStats, tableStats } = testdata2;
    const { container } = render(
      <Stats
        badgeName={badgeName}
        generalStats={generalStats}
        tableStats={tableStats}
      />,
      { wrapper: MemoryRouter }
    );
    const linkElement = await findByTestId(container, 'stats-link');

    expect(linkElement.textContent).toBe('View recent runs');

    const runsCount = await findByTestId(container, 'runs-count');

    expect(runsCount.textContent).toBe('5432');

    const usersCount = await findByTestId(container, 'users-count');

    expect(usersCount.textContent).toBe('24 users');
  });
});
