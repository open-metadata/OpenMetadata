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
import { cloneDeep, isEmpty, isUndefined } from 'lodash';
import { EditorContentRef } from 'Models';
import React, { Fragment, useEffect, useRef, useState } from 'react';
import {
  CreateTableTest,
  TableTestType,
} from '../../../generated/api/tests/createTableTest';
import { TableTest } from '../../../generated/tests/tableTest';
import {
  errorMsg,
  getCurrentUserId,
  requiredField,
} from '../../../utils/CommonUtils';
import { Button } from '../../buttons/Button/Button';
import RichTextEditor from '../../common/rich-text-editor/RichTextEditor';

type Props = {
  data?: TableTest;
  tableTestCase: TableTest[];
  isTableDeleted?: boolean;
  handleAddTableTestCase: (data: CreateTableTest) => void;
  onFormCancel: () => void;
};

export const Field = ({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return <div className={classNames('tw-mt-4', className)}>{children}</div>;
};

const TableTestForm = ({
  data,
  tableTestCase,
  isTableDeleted,
  handleAddTableTestCase,
  onFormCancel,
}: Props) => {
  const markdownRef = useRef<EditorContentRef>();
  const [tableTest, setTableTest] = useState<TableTestType | undefined>(
    data?.testCase?.tableTestType || ('' as TableTestType)
  );
  const [description] = useState(data?.description || '');
  const [minValue, setMinValue] = useState<number | undefined>(
    data?.testCase?.config?.minValue
  );
  const [maxValue, setMaxValue] = useState<number | undefined>(
    data?.testCase?.config?.maxValue
  );
  const [value, setValue] = useState<number | undefined>(
    data?.testCase.config?.value || data?.testCase.config?.columnCount
  );
  const [columnName, setcolumnName] = useState<string | undefined>(
    data?.testCase?.config?.columnName
  );
  const [columnNameSet, setcolumnNameSet] = useState<string | undefined>(
    data?.testCase?.config?.columnNames
  );
  const [isShowError, setIsShowError] = useState({
    minOrMax: false,
    values: false,
    minMaxValue: false,
    allTestAdded: false,
    tableTest: false,
    columnName: false,
    columnNameSet: false,
  });
  const [testTypeOptions, setTestTypeOptions] = useState<string[]>();

  useEffect(() => {
    if (tableTestCase.length && isUndefined(data)) {
      const existingTest = tableTestCase?.map(
        (d) => d.testCase.tableTestType as string
      );
      const newTest = Object.values(TableTestType).filter(
        (d) => !existingTest.includes(d)
      );
      const allTestAdded =
        tableTestCase.length === Object.values(TableTestType).length;
      setIsShowError({
        ...isShowError,
        allTestAdded,
      });
      setTestTypeOptions(newTest);
    } else {
      const testValue = Object.values(TableTestType);
      setTestTypeOptions(testValue);
      setTableTest(data?.testCase?.tableTestType || testValue[0]);
    }
  }, [tableTestCase]);

  const validateForm = () => {
    const errMsg = cloneDeep(isShowError);

    const isTableRowCountToBeBetweenTest =
      tableTest === TableTestType.TableRowCountToBeBetween;

    errMsg.tableTest = isEmpty(tableTest);

    if (isTableRowCountToBeBetweenTest) {
      errMsg.minOrMax = isEmpty(minValue) && isEmpty(maxValue);
      if (!isUndefined(minValue) && !isUndefined(maxValue)) {
        errMsg.minMaxValue = (+minValue as number) > (+maxValue as number);
      }
    } else {
      errMsg.values = isEmpty(value);
    }

    setIsShowError(errMsg);

    return !Object.values(errMsg).includes(true);
  };

  const getConfigValue = () => {
    switch (tableTest) {
      case TableTestType.TableRowCountToBeBetween:
        return {
          maxValue: isEmpty(maxValue) ? undefined : maxValue,
          minValue: isEmpty(minValue) ? undefined : minValue,
        };

      case TableTestType.TableColumnCountToBeBetween:
        return {
          minColValue: isEmpty(minValue) ? undefined : minValue,
          maxColValue: isEmpty(maxValue) ? undefined : maxValue,
        };

      case TableTestType.TableColumnNameToExist:
        return {
          columnName: isEmpty(columnName) ? undefined : columnName,
        };

      case TableTestType.TableColumnToMatchSet:
        return {
          columnNames: isEmpty(columnNameSet) ? undefined : columnNameSet,
        };

      case TableTestType.TableColumnCountToEqual:
        return {
          columnCount: isEmpty(value) ? undefined : value,
        };

      case TableTestType.TableRowCountToEqual:
        return {
          value: isEmpty(value) ? undefined : value,
        };

      default:
        return {};
    }
  };

  const handleSave = () => {
    if (validateForm()) {
      const createTest: CreateTableTest = {
        description: markdownRef.current?.getEditorContent() || undefined,
        testCase: {
          config: getConfigValue(),
          tableTestType: tableTest,
        },
        owner: {
          type: 'user',
          id: getCurrentUserId(),
        },
      };
      handleAddTableTestCase(createTest);
    }
  };

  const handleValidation = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = event.target.value;
    const eleName = event.target.name;

    const errorMsg = cloneDeep(isShowError);

    switch (eleName) {
      case 'tableTestType':
        setTableTest(value as TableTestType);
        errorMsg.minMaxValue = false;
        errorMsg.minOrMax = false;
        errorMsg.values = false;

        break;
      case 'min':
        setMinValue(value as unknown as number);
        errorMsg.minMaxValue = false;
        errorMsg.minOrMax = false;

        break;

      case 'max':
        setMaxValue(value as unknown as number);
        errorMsg.minMaxValue = false;
        errorMsg.minOrMax = false;

        break;

      case 'value':
        setValue(value as unknown as number);
        errorMsg.values = false;

        break;

      case 'column-name':
        setcolumnName(value as unknown as string);
        errorMsg.columnName = false;

        break;

      case 'column-name-set':
        setcolumnNameSet(value as unknown as string);
        errorMsg.columnNameSet = false;

        break;

      default:
        break;
    }

    setIsShowError(errorMsg);
  };

  const getValueField = () => {
    return (
      <Field>
        <label className="tw-block tw-form-label" htmlFor="value">
          {requiredField('Value:')}
        </label>
        <input
          className="tw-form-inputs tw-form-inputs-padding"
          data-testid="value"
          id="value"
          name="value"
          placeholder="100"
          type="number"
          value={value}
          onChange={handleValidation}
        />
        {isShowError.values && errorMsg('Value is required.')}
      </Field>
    );
  };

  const getValueColTextField = () => {
    return (
      <Field>
        <label className="tw-block tw-form-label" htmlFor="column-name">
          Column Name
        </label>
        <input
          className="tw-form-inputs tw-form-inputs-padding"
          data-testid="column-name"
          id="columnn-ame"
          name="column-name"
          placeholder="col1"
          type="text"
          value={columnName}
          onChange={handleValidation}
        />
        {isShowError.columnName && errorMsg('Value is required.')}
      </Field>
    );
  };

  const getValueColSetTextField = () => {
    return (
      <Field>
        <label className="tw-block tw-form-label" htmlFor="column-name-set">
          Column Names
        </label>
        <input
          className="tw-form-inputs tw-form-inputs-padding"
          data-testid="column-name-set"
          id="column-name-set"
          name="column-name-set"
          placeholder="col1, col2, col3"
          type="text"
          value={columnNameSet}
          onChange={handleValidation}
        />
        {isShowError.columnNameSet && errorMsg('Value is required.')}
      </Field>
    );
  };

  const getMinMaxField = () => {
    return (
      <Fragment>
        <div className="tw-flex tw-gap-4 tw-w-full">
          <div className="tw-flex-1">
            <label className="tw-block tw-form-label" htmlFor="min">
              Min:
            </label>
            <input
              className="tw-form-inputs tw-form-inputs-padding"
              data-testid="min"
              id="min"
              name="min"
              placeholder="10"
              type="number"
              value={minValue}
              onChange={handleValidation}
            />
          </div>
          <div className="tw-flex-1">
            <label className="tw-block tw-form-label" htmlFor="max">
              Max:
            </label>
            <input
              className="tw-form-inputs tw-form-inputs-padding"
              data-testid="max"
              id="max"
              name="max"
              placeholder="100"
              type="number"
              value={maxValue}
              onChange={handleValidation}
            />
          </div>
        </div>
        {isShowError.minOrMax && errorMsg('Please enter atleast one value')}
        {isShowError.minMaxValue &&
          errorMsg('Min value should be lower than Max value.')}
      </Fragment>
    );
  };

  const getTableTestConfig = () => {
    switch (tableTest) {
      case TableTestType.TableRowCountToBeBetween:
      case TableTestType.TableColumnCountToBeBetween:
        return getMinMaxField();
      case TableTestType.TableColumnNameToExist:
        return getValueColTextField();
      case TableTestType.TableColumnToMatchSet:
        return getValueColSetTextField();
      default:
        return getValueField();
    }
  };

  return (
    <Fragment>
      <p className="tw-font-medium tw-px-4">
        {isUndefined(data) ? 'Add' : 'Edit'} Table Test
      </p>

      <div className="tw-w-screen-sm">
        <div className="tw-px-4 tw-mx-auto">
          <Field>
            <label className="tw-block tw-form-label" htmlFor="tableTestType">
              {requiredField('Test Type:')}
            </label>
            <select
              className={classNames('tw-form-inputs tw-form-inputs-padding', {
                'tw-cursor-not-allowed': !isUndefined(data),
              })}
              data-testid="tableTestType"
              disabled={!isUndefined(data)}
              id="tableTestType"
              name="tableTestType"
              value={tableTest}
              onChange={handleValidation}>
              <option value="">Select table test</option>
              {testTypeOptions &&
                testTypeOptions.length > 0 &&
                testTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
            </select>
            {isShowError.allTestAdded &&
              errorMsg('All the tests have been added to the table.')}
          </Field>

          <Field>
            <label
              className="tw-block tw-form-label tw-mb-0"
              htmlFor="description">
              Description:
            </label>
            <RichTextEditor
              data-testid="description"
              initialValue={description}
              ref={markdownRef}
            />
          </Field>

          <Field>{getTableTestConfig()}</Field>
        </div>
        <Field className="tw-flex tw-justify-end">
          <Button
            data-testid="cancel-test"
            size="regular"
            theme="primary"
            variant="text"
            onClick={onFormCancel}>
            Cancel
          </Button>
          <Button
            className="tw-w-16 tw-h-10"
            data-testid="save-test"
            disabled={isShowError.allTestAdded || isTableDeleted}
            size="regular"
            theme="primary"
            variant="contained"
            onClick={handleSave}>
            Save
          </Button>
        </Field>
      </div>
    </Fragment>
  );
};

export default TableTestForm;
