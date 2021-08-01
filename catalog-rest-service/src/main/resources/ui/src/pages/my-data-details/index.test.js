import { getAllByTestId, getByTestId, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import MyDataDetailsPage from './index';

describe('Test MyDataDetailsPage page', () => {
  // Rewrite this test as component has actual data from api and api is not mocked here
  it('Checks if the page has all the proper components rendered', () => {
    const { container } = render(<MyDataDetailsPage />, {
      wrapper: MemoryRouter,
    });
    const followButton = getByTestId(container, 'follow-button');
    const relatedTables = getByTestId(container, 'related-tables-container');
    const tabs = getAllByTestId(container, 'tab');

    expect(followButton).toBeInTheDocument();
    expect(relatedTables).toBeInTheDocument();
    expect(tabs.length).toBe(5);
  });
});
