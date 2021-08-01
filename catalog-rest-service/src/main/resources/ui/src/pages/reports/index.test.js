import { render } from '@testing-library/react';
import React from 'react';
import ReportsPage from './index';

describe('Test Reports page', () => {
  it('Check for no. of data items to be rendered', () => {
    const { getAllByTestId } = render(<ReportsPage />);
    const dataItems = getAllByTestId('report-card-container');

    expect(dataItems).toHaveLength(3);
  });
});
