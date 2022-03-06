import React, { useState } from 'react';
import { ColumnTestType } from '../../enums/columnTest.enum';
import { CreateTableTest } from '../../generated/api/tests/createTableTest';
import { Table } from '../../generated/entity/data/table';
import { TableTest, TableTestType } from '../../generated/tests/tableTest';
import {
  CreateColumnTest,
  DatabaseTestModeType,
  ModifiedTableColumn,
  TestTableDataType,
} from '../../interface/dataQuality.interface';
import AddDataQualityTest from '../AddDataQualityTest/AddDataQualityTest';
import DataQualityTest from '../DataQualityTest/DataQualityTest';

type Props = {
  handleAddTableTestCase: (data: CreateTableTest) => void;
  handleAddColumnTestCase: (data: CreateColumnTest) => void;
  columnOptions: Table['columns'];
  testMode: DatabaseTestModeType;
  handleTestModeChange: (mode: DatabaseTestModeType) => void;
  showTestForm: boolean;
  handleShowTestForm: (value: boolean) => void;
  tableTestCase: TableTest[];
  handleRemoveTableTest: (testType: TableTestType) => void;
  handleRemoveColumnTest: (
    columnName: string,
    testType: ColumnTestType
  ) => void;
};

const DataQualityTab = ({
  columnOptions,
  showTestForm,
  handleTestModeChange,
  handleShowTestForm,
  handleAddTableTestCase,
  handleAddColumnTestCase,
  handleRemoveTableTest,
  handleRemoveColumnTest,
  testMode,
  tableTestCase,
}: Props) => {
  const [showDropDown, setShowDropDown] = useState(false);
  const [activeData, setActiveData] = useState<TestTableDataType>();

  const onFormCancel = () => {
    handleShowTestForm(false);
    setActiveData(undefined);
  };

  const handleShowDropDown = (value: boolean) => {
    setShowDropDown(value);
  };

  const handleTestSelection = (mode: DatabaseTestModeType) => {
    handleTestModeChange(mode);
    handleShowTestForm(true);
  };

  const haandleDropDownClick = (
    _e: React.MouseEvent<HTMLElement, MouseEvent>,
    value?: string
  ) => {
    if (value) {
      handleTestSelection(value as DatabaseTestModeType);
    }
    setShowDropDown(false);
  };

  const handleEditTest = (
    mode: DatabaseTestModeType,
    obj: TestTableDataType
  ) => {
    setActiveData(obj);
    handleTestSelection(mode);
  };

  const onTableTestSave = (data: CreateTableTest) => {
    handleAddTableTestCase(data);
    setActiveData(undefined);
  };

  const onColumnTestSave = (data: CreateColumnTest) => {
    handleAddColumnTestCase(data);
    setActiveData(undefined);
  };

  return (
    <div>
      {showTestForm ? (
        <AddDataQualityTest
          columnOptions={columnOptions}
          data={activeData}
          handleAddColumnTestCase={onColumnTestSave}
          handleAddTableTestCase={onTableTestSave}
          tableTestCase={tableTestCase}
          testMode={testMode}
          onFormCancel={onFormCancel}
        />
      ) : (
        <DataQualityTest
          columns={columnOptions as ModifiedTableColumn[]}
          haandleDropDownClick={haandleDropDownClick}
          handleEditTest={handleEditTest}
          handleRemoveColumnTest={handleRemoveColumnTest}
          handleRemoveTableTest={handleRemoveTableTest}
          handleShowDropDown={handleShowDropDown}
          showDropDown={showDropDown}
          tableTestCase={tableTestCase}
        />
      )}
    </div>
  );
};

export default DataQualityTab;
