import React from 'react';
import { CreateTableTest } from '../../generated/api/tests/createTableTest';
import { Table } from '../../generated/entity/data/table';
import { TableTest } from '../../generated/tests/tableTest';
import {
  CreateColumnTest,
  TestTableDataType,
} from '../../interface/dataQuality.interface';
import ColumnTestForm from './Forms/ColumnTestForm';
import TableTestForm from './Forms/TableTestForm';

type Props = {
  data?: TestTableDataType;
  testMode: 'table' | 'column';
  columnOptions: Table['columns'];
  tableTestCase: TableTest[];
  handleAddTableTestCase: (data: CreateTableTest) => void;
  handleAddColumnTestCase: (data: CreateColumnTest) => void;
  onFormCancel: () => void;
};

const AddDataQualityTest = ({
  tableTestCase,
  data,
  testMode,
  columnOptions = [],
  handleAddTableTestCase,
  handleAddColumnTestCase,
  onFormCancel,
}: Props) => {
  return (
    <div className="tw-max-w-xl tw-mx-auto tw-pb-6">
      {testMode === 'table' ? (
        <TableTestForm
          data={data as TableTest}
          handleAddTableTestCase={handleAddTableTestCase}
          tableTestCase={tableTestCase}
          onFormCancel={onFormCancel}
        />
      ) : (
        <ColumnTestForm
          column={columnOptions}
          data={data as CreateColumnTest}
          handleAddColumnTestCase={handleAddColumnTestCase}
          onFormCancel={onFormCancel}
        />
      )}
    </div>
  );
};

export default AddDataQualityTest;
