/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import React, { useState } from 'react';
import { ColumnTestType } from '../../enums/columnTest.enum';
import { CreateTableTest } from '../../generated/api/tests/createTableTest';
import { Table } from '../../generated/entity/data/table';
import { TableTest, TableTestType } from '../../generated/tests/tableTest';
import {
  CreateColumnTest,
  DatasetTestModeType,
  ModifiedTableColumn,
  TableTestDataType,
} from '../../interface/dataQuality.interface';
import AddDataQualityTest from '../AddDataQualityTest/AddDataQualityTest';
import DataQualityTest from '../DataQualityTest/DataQualityTest';

type Props = {
  handleAddTableTestCase: (data: CreateTableTest) => void;
  handleAddColumnTestCase: (data: CreateColumnTest) => void;
  columnOptions: Table['columns'];
  testMode: DatasetTestModeType;
  handleTestModeChange: (mode: DatasetTestModeType) => void;
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
  const [activeData, setActiveData] = useState<TableTestDataType>();

  const onFormCancel = () => {
    handleShowTestForm(false);
    setActiveData(undefined);
  };

  const handleShowDropDown = (value: boolean) => {
    setShowDropDown(value);
  };

  const handleTestSelection = (mode: DatasetTestModeType) => {
    handleTestModeChange(mode);
    handleShowTestForm(true);
  };

  const haandleDropDownClick = (
    _e: React.MouseEvent<HTMLElement, MouseEvent>,
    value?: string
  ) => {
    if (value) {
      handleTestSelection(value as DatasetTestModeType);
    }
    setShowDropDown(false);
  };

  const handleEditTest = (
    mode: DatasetTestModeType,
    obj: TableTestDataType
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
