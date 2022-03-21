import {
  findAllByTestId,
  findAllByText,
  findByTestId,
  findByText,
  queryByText,
  render,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { TableTest } from '../../generated/tests/tableTest';
import { ModifiedTableColumn } from '../../interface/dataQuality.interface';
import DataQualityTest from './DataQualityTest';
import { columns, tableTests } from './dataQualityTest.mock';

const mockFunction = jest.fn();

jest.mock('../common/non-admin-action/NonAdminAction', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ));
});

jest.mock('../common/error-with-placeholder/ErrorPlaceHolder', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <div>
        <p>ErrorPlaceHolder component</p>
        {children}
      </div>
    ));
});

jest.mock('./Table/DataQualityTable', () => {
  return jest.fn().mockReturnValue(<div>DataQualityTable</div>);
});

describe('Test DataQualityTest component', () => {
  it('DataQualityTest component should be render properly', async () => {
    const { container } = render(
      <DataQualityTest
        columns={[]}
        haandleDropDownClick={mockFunction}
        handleEditTest={mockFunction}
        handleRemoveColumnTest={mockFunction}
        handleRemoveTableTest={mockFunction}
        handleShowDropDown={mockFunction}
        showDropDown={false}
        tableTestCase={[]}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const dataQualityTestContainer = await findByTestId(
      container,
      'data-quality-test-container'
    );
    const addNewTest = await findByTestId(container, 'add-new-test-button');
    const errorPlaceHolder = await findByText(
      container,
      /ErrorPlaceHolder component/i
    );

    expect(dataQualityTestContainer).toBeInTheDocument();
    expect(addNewTest).toBeInTheDocument();
    expect(errorPlaceHolder).toBeInTheDocument();
  });

  it('If data provided respective component should be visible', async () => {
    const { container } = render(
      <DataQualityTest
        columns={columns as ModifiedTableColumn[]}
        haandleDropDownClick={mockFunction}
        handleEditTest={mockFunction}
        handleRemoveColumnTest={mockFunction}
        handleRemoveTableTest={mockFunction}
        handleShowDropDown={mockFunction}
        showDropDown={false}
        tableTestCase={tableTests as TableTest[]}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const testContainer = await findByTestId(container, 'test-container');
    const tableLevelTestContainer = await findByTestId(
      container,
      'table-level-test-container'
    );
    const columnLevelTestContainer = await findByTestId(
      container,
      'column-level-test-container'
    );
    const tableTestLabel = await findByTestId(container, 'table-test-label');
    const addNewTest = await findByTestId(container, 'add-new-test-button');
    const errorPlaceHolder = queryByText(
      container,
      /ErrorPlaceHolder component/i
    );
    const allColumnLabel = await findAllByTestId(
      container,
      'column-test-label'
    );
    const dataQualityTables = await findAllByText(
      container,
      /DataQualityTable/i
    );

    const columnWithTests = columns.filter(
      (d) => d.columnTests?.length > 0
    ).length;

    expect(testContainer).toBeInTheDocument();
    expect(tableLevelTestContainer).toBeInTheDocument();
    expect(columnLevelTestContainer).toBeInTheDocument();
    expect(tableTestLabel).toBeInTheDocument();
    expect(tableTestLabel.textContent).toEqual('Table Tests');
    expect(addNewTest).toBeInTheDocument();
    // in below line 1 is for table test as, if table test is available
    // all the test will render in one component
    expect(dataQualityTables.length).toBe(1 + columnWithTests);
    expect(allColumnLabel.length).toBe(columnWithTests);
    expect(errorPlaceHolder).not.toBeInTheDocument();
  });
});
