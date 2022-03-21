import {
  findByTestId,
  findByText,
  queryByText,
  render,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import DataQualityTab from './DataQualityTab';

const mockFunction = jest.fn();

jest.mock('../AddDataQualityTest/AddDataQualityTest', () => {
  return jest.fn().mockReturnValue(<div>AddDataQualityTestForm Component</div>);
});

jest.mock('../DataQualityTest/DataQualityTest', () => {
  return jest.fn().mockReturnValue(<div>DataQualityTest Component</div>);
});

describe('Test DataQualityTab component', () => {
  it('DataQualityTab component should be render properly', async () => {
    const { container } = render(
      <DataQualityTab
        columnOptions={[]}
        handleAddColumnTestCase={mockFunction}
        handleAddTableTestCase={mockFunction}
        handleRemoveColumnTest={mockFunction}
        handleRemoveTableTest={mockFunction}
        handleSelectedColumn={mockFunction}
        handleShowTestForm={mockFunction}
        handleTestModeChange={mockFunction}
        selectedColumn=""
        showTestForm={false}
        tableTestCase={[]}
        testMode="table"
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const dataQualityTab = await findByTestId(container, 'data-quality-tab');

    expect(dataQualityTab).toBeInTheDocument();
  });

  it('DataQualityTest component should be visible', async () => {
    const { container } = render(
      <DataQualityTab
        columnOptions={[]}
        handleAddColumnTestCase={mockFunction}
        handleAddTableTestCase={mockFunction}
        handleRemoveColumnTest={mockFunction}
        handleRemoveTableTest={mockFunction}
        handleSelectedColumn={mockFunction}
        handleShowTestForm={mockFunction}
        handleTestModeChange={mockFunction}
        selectedColumn=""
        showTestForm={false}
        tableTestCase={[]}
        testMode="table"
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const dataQualityTest = await findByText(
      container,
      /DataQualityTest Component/i
    );
    const addDataQualityTest = queryByText(
      container,
      /AddDataQualityTestForm Component /i
    );

    expect(dataQualityTest).toBeInTheDocument();
    expect(addDataQualityTest).not.toBeInTheDocument();
  });

  it('AddDataQualityTest component should be visible', async () => {
    const { container } = render(
      <DataQualityTab
        showTestForm
        columnOptions={[]}
        handleAddColumnTestCase={mockFunction}
        handleAddTableTestCase={mockFunction}
        handleRemoveColumnTest={mockFunction}
        handleRemoveTableTest={mockFunction}
        handleSelectedColumn={mockFunction}
        handleShowTestForm={mockFunction}
        handleTestModeChange={mockFunction}
        selectedColumn=""
        tableTestCase={[]}
        testMode="table"
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const addDataQualityTest = await findByText(
      container,
      /AddDataQualityTestForm Component/i
    );
    const dataQualityTest = queryByText(
      container,
      /DataQualityTest Component/i
    );

    expect(addDataQualityTest).toBeInTheDocument();
    expect(dataQualityTest).not.toBeInTheDocument();
  });
});
