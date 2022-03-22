import { findAllByTestId, findByTestId, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { TableTestDataType } from '../../../interface/dataQuality.interface';
import { tableTests } from '../dataQualityTest.mock';
import DataQualityTable from './DataQualityTable';

const mockFunction = jest.fn();

jest.mock('../../common/non-admin-action/NonAdminAction', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ));
});

describe('Test DataQualityTable component', () => {
  it('DataQualityTable component should be render properly', async () => {
    const { container } = render(
      <DataQualityTable
        isTableTest
        handleEditTest={mockFunction}
        testCase={tableTests as TableTestDataType[]}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const tableContainer = await findByTestId(container, 'table-container');
    const tableHeader = await findByTestId(container, 'table-header');
    const columns = await findAllByTestId(container, 'column');
    const header: string[] = [];
    tableHeader.childNodes.forEach((node) => {
      if (node.textContent) {
        header.push(node.textContent);
      }
    });

    expect(tableContainer).toBeInTheDocument();
    expect(columns.length).toBe(tableTests.length);
    expect(header).toEqual([
      'Test Case',
      'Description',
      'Config',
      'Last Run',
      'Value',
      'Action',
    ]);
  });
});
