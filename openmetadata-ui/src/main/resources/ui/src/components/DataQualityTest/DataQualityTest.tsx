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

import classNames from 'classnames';
import React, { useEffect, useState } from 'react';
import { TITLE_FOR_NON_ADMIN_ACTION } from '../../constants/constants';
import { ColumnTestType } from '../../enums/columnTest.enum';
import { TableTest, TableTestType } from '../../generated/tests/tableTest';
import { useAuth } from '../../hooks/authHooks';
import {
  DatasetTestModeType,
  ModifiedTableColumn,
  TableTestDataType,
} from '../../interface/dataQuality.interface';
import { dropdownIcon as DropdownIcon } from '../../utils/svgconstant';
import { Button } from '../buttons/Button/Button';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import DropDownList from '../dropdown/DropDownList';
import { DropDownListItem } from '../dropdown/types';
import DataQualityTable from './Table/DataQualityTable';

type Props = {
  tableTestCase: TableTest[];
  columns: ModifiedTableColumn[];
  showDropDown: boolean;
  isTableDeleted?: boolean;
  handleEditTest: (mode: DatasetTestModeType, obj: TableTestDataType) => void;
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
  isTableDeleted,
  handleEditTest,
  handleShowDropDown,
  handleRemoveTableTest,
  handleRemoveColumnTest,
  haandleDropDownClick,
}: Props) => {
  const { isAuthDisabled, isAdminUser } = useAuth();
  const [columnsData, setColumnsData] = useState<ModifiedTableColumn[]>([]);

  const dropdownList: DropDownListItem[] = [
    {
      name: 'Table Test',
      value: 'table',
      disabled: isTableDeleted,
    },
    {
      name: 'Column Test',
      value: 'column',
      disabled: isTableDeleted,
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
            <NonAdminAction
              position="bottom"
              title={TITLE_FOR_NON_ADMIN_ACTION}>
              <Button
                className={classNames('tw-h-8 tw-rounded tw-mb-1 tw--mt-2', {
                  'tw-opacity-40': !isAuthDisabled && !isAdminUser,
                })}
                data-testid="add-new-tag-button"
                size="small"
                theme="primary"
                variant="contained"
                onClick={() => {
                  handleShowDropDown(true);
                }}>
                Add Test{' '}
                {showDropDown ? (
                  <DropdownIcon
                    style={{
                      transform: 'rotate(180deg)',
                      marginTop: '1px',
                      color: '#fff',
                    }}
                  />
                ) : (
                  <DropdownIcon
                    style={{
                      marginTop: '1px',
                      color: '#fff',
                    }}
                  />
                )}
              </Button>
            </NonAdminAction>
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
                isTableDeleted={isTableDeleted}
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
                    isTableDeleted={isTableDeleted}
                    isTableTest={false}
                    testCase={
                      data.columnTests && data.columnTests?.length > 0
                        ? (data.columnTests as TableTestDataType[])
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
          <p className="tw-mb-5">No test available.</p>
          {addTestButton(false)}
        </ErrorPlaceHolder>
      )}
    </>
  );
};

export default DataQualityTest;
