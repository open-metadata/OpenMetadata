import React, { useEffect, useState } from 'react';
import { TITLE_FOR_NON_ADMIN_ACTION } from '../../constants/constants';
import { ColumnTestType } from '../../enums/columnTest.enum';
import { TableTest, TableTestType } from '../../generated/tests/tableTest';
import {
  DatabaseTestModeType,
  ModifiedTableColumn,
  TestTableDataType,
} from '../../interface/dataQuality.interface';
import { normalLink } from '../../utils/styleconstant';
import { dropdownIcon as DropdownIcon } from '../../utils/svgconstant';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import DropDownList from '../dropdown/DropDownList';
import { DropDownListItem } from '../dropdown/types';
import DataQualityTable from './Table/DataQualityTable';

type Props = {
  tableTestCase: TableTest[];
  columns: ModifiedTableColumn[];
  showDropDown: boolean;
  handleEditTest: (mode: DatabaseTestModeType, obj: TestTableDataType) => void;
  handleRemoveTableTest: (testType: TableTestType) => void;
  haandleDropDownClick: (
    _e: React.MouseEvent<HTMLElement, MouseEvent>,
    value?: string | undefined
  ) => void;
  handleShowDropDown: (value: boolean) => void;
  handleRemoveColumnTest: (
    columnName: string,
    testType: ColumnTestType
  ) => void;
};

const DataQualityTest = ({
  showDropDown,
  tableTestCase,
  columns,
  handleEditTest,
  handleShowDropDown,
  handleRemoveTableTest,
  handleRemoveColumnTest,
  haandleDropDownClick,
}: Props) => {
  const [columnsData, setColumnsData] = useState<ModifiedTableColumn[]>([]);

  const isColumnTestDisable = () => {
    const remainingTest = columns?.filter((d) => {
      return d?.columnTests?.length !== Object.values(ColumnTestType).length;
    });

    return !(remainingTest.length > 0);
  };

  const dropdownList: DropDownListItem[] = [
    {
      name: 'Table Test',
      value: 'table',
      disabled: tableTestCase.length >= Object.values(TableTestType).length,
    },
    {
      name: 'Column Test',
      value: 'column',
      disabled: isColumnTestDisable(),
    },
  ];

  useEffect(() => {
    if (columns.length) {
      setColumnsData(
        columns.filter((d) => d?.columnTests && d?.columnTests.length > 0)
      );
    }
  }, [columns]);

  const addTestButton = (horzPosRight: boolean) => {
    return (
      <div className="tw-flex tw-justify-end">
        <NonAdminAction position="bottom" title={TITLE_FOR_NON_ADMIN_ACTION}>
          <span className="tw-relative">
            <button onClick={() => handleShowDropDown(true)}>
              Add Test{' '}
              <DropdownIcon style={{ marginTop: '1px', color: normalLink }} />
            </button>
            {showDropDown && (
              <DropDownList
                dropDownList={dropdownList}
                horzPosRight={horzPosRight}
                onSelect={haandleDropDownClick}
              />
            )}
          </span>
        </NonAdminAction>
      </div>
    );
  };

  return (
    <>
      {tableTestCase.length > 0 || columnsData.length > 0 ? (
        <div>
          {addTestButton(true)}
          {tableTestCase.length > 0 && (
            <div className="tw-mb-5">
              <p className="tw-form-label">Table Tests</p>
              <DataQualityTable
                isTableTest
                handleEditTest={handleEditTest}
                handleRemoveTableTest={handleRemoveTableTest}
                testCase={tableTestCase}
              />
            </div>
          )}

          <div>
            {columnsData.map((data, index) => {
              return (
                <div className="tw-mb-5" key={index}>
                  <p className="tw-form-label">{`Column Tests - ${data?.name}`}</p>
                  <DataQualityTable
                    handleEditTest={handleEditTest}
                    handleRemoveColumnTest={handleRemoveColumnTest}
                    isTableTest={false}
                    testCase={
                      data.columnTests && data.columnTests?.length > 0
                        ? (data.columnTests as TestTableDataType[])
                        : []
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <ErrorPlaceHolder>
          <p>No test available.</p>
          {addTestButton(false)}
        </ErrorPlaceHolder>
      )}
    </>
  );
};

export default DataQualityTest;
