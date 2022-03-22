import {
  findByTestId,
  findByText,
  queryByText,
  render,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import AddDataQualityTest from './AddDataQualityTest';

const mockFunction = jest.fn();

jest.mock('./Forms/ColumnTestForm', () => {
  return jest.fn().mockReturnValue(<div>ColumnTestForm component</div>);
});

jest.mock('./Forms/TableTestForm', () => {
  return jest.fn().mockReturnValue(<div>TableTestForm component</div>);
});

describe('Test AddDataQualityTest component', () => {
  it('AddDataQualityTest component should be render properly', async () => {
    const { container } = render(
      <AddDataQualityTest
        columnOptions={[]}
        handleAddColumnTestCase={mockFunction}
        handleAddTableTestCase={mockFunction}
        selectedColumn=""
        tableTestCase={[]}
        testMode="table"
        onFormCancel={mockFunction}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const addDataQualityTest = await findByTestId(
      container,
      'add-data-quality-test'
    );

    expect(addDataQualityTest).toBeInTheDocument();
  });

  it('TableTestForm component should be visible', async () => {
    const { container } = render(
      <AddDataQualityTest
        columnOptions={[]}
        handleAddColumnTestCase={mockFunction}
        handleAddTableTestCase={mockFunction}
        selectedColumn=""
        tableTestCase={[]}
        testMode="table"
        onFormCancel={mockFunction}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const tableForm = await findByText(container, /TableTestForm component/i);
    const columnForm = queryByText(container, /ColumnTestForm component/i);

    expect(tableForm).toBeInTheDocument();
    expect(columnForm).not.toBeInTheDocument();
  });

  it('ColumnTestForm component should be visible', async () => {
    const { container } = render(
      <AddDataQualityTest
        columnOptions={[]}
        handleAddColumnTestCase={mockFunction}
        handleAddTableTestCase={mockFunction}
        selectedColumn=""
        tableTestCase={[]}
        testMode="column"
        onFormCancel={mockFunction}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const tableForm = queryByText(container, /TableTestForm component/i);
    const columnForm = await findByText(container, /ColumnTestForm component/i);

    expect(tableForm).not.toBeInTheDocument();
    expect(columnForm).toBeInTheDocument();
  });
});
