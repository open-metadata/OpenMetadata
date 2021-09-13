import { render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import TableDataCard from './TableDataCard';

jest.mock('../../../utils/TableUtils', () => ({
  getBadgeName: jest.fn().mockImplementation(() => 'table'),
  getUsagePercentile: jest
    .fn()
    .mockImplementation((value = 0) => `${value} value`),
}));

jest.mock('../../../constants/constants', () => ({
  getDatasetDetailsPath: jest
    .fn()
    .mockImplementation((path) => `/dataset/${path}`),
}));

// const getDatasetDetailsPath = jest.fn();

describe('Test TableDataCard Component', () => {
  it('Component should render', () => {
    const { getByTestId } = render(
      <TableDataCard fullyQualifiedName="testFQN" name="test card" />,
      { wrapper: MemoryRouter }
    );
    const tableDataCard = getByTestId('table-data-card');

    expect(tableDataCard).toBeInTheDocument();
  });

  it('if description is empty, should show No Description', () => {
    const { queryByText } = render(
      <TableDataCard fullyQualifiedName="testFQN" name="test card" />,
      { wrapper: MemoryRouter }
    );
    const noDescription = queryByText(/No description/i);

    expect(noDescription).toBeInTheDocument();
  });

  it('Badge icon should render', () => {
    const { getByTestId } = render(
      <TableDataCard fullyQualifiedName="testFQN" name="test card" />,
      { wrapper: MemoryRouter }
    );
    const badge = getByTestId('badge');

    expect(badge).toBeInTheDocument();
  });

  it('Link should have proper path', () => {
    const FQN = 'testFQN';
    const { getByTestId } = render(
      <TableDataCard fullyQualifiedName={FQN} name="test card" />,
      { wrapper: MemoryRouter }
    );
    const link = getByTestId('table-link');

    expect(link).toHaveAttribute('href', `/dataset/${FQN}`);
  });
});
