import { render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import TableDataCard from './TableDataCard';

jest.mock('../../../utils/TableUtils', () => ({
  getEntityLink: jest.fn().mockReturnValue('EntityLink'),
  getEntityIcon: jest.fn().mockReturnValue(<p>icon</p>),
  getUsagePercentile: jest
    .fn()
    .mockImplementation((value = 0) => `${value} value`),
}));

jest.mock('../../../constants/constants', () => ({
  getDatasetDetailsPath: jest
    .fn()
    .mockImplementation((path) => `/dataset/${path}`),
}));

jest.mock('./TableDataCardBody', () => {
  return jest.fn().mockReturnValue(<p>TableDataCardBody</p>);
});

// const getDatasetDetailsPath = jest.fn();

describe('Test TableDataCard Component', () => {
  it('Component should render', () => {
    const { getByTestId } = render(
      <TableDataCard
        fullyQualifiedName="testFQN"
        indexType="testIndex"
        name="test card"
      />,
      { wrapper: MemoryRouter }
    );
    const tableDataCard = getByTestId('table-data-card');

    expect(tableDataCard).toBeInTheDocument();
  });

  it('Link should have proper path', () => {
    const { getByTestId } = render(
      <TableDataCard
        fullyQualifiedName="testFQN"
        indexType="testIndex"
        name="test card"
      />,
      { wrapper: MemoryRouter }
    );
    const link = getByTestId('table-link');

    expect(link).toHaveAttribute('href', `/EntityLink`);
  });
});
