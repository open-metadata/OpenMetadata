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
  TestCaseExecutionFrequency,
} from '../../../generated/api/tests/createTableTest';
import { TableTest } from '../../../generated/tests/tableTest';
import {
  errorMsg,
  getCurrentUserId,
  requiredField,
} from '../../../utils/CommonUtils';
import { Button } from '../../buttons/Button/Button';
import MarkdownWithPreview from '../../common/editor/MarkdownWithPreview';

type Props = {
  data: TableTest;
  tableTestCase: TableTest[];
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
  handleAddTableTestCase,
  onFormCancel,
}: Props) => {
  const markdownRef = useRef<EditorContentRef>();
  const [tableTest, setTableTest] = useState<TableTestType | undefined>(
    data?.testCase?.tableTestType
  );
  const [description] = useState(data?.description || '');
  const [minValue, setMinValue] = useState<number | undefined>(
    data?.testCase?.config?.minValue
  );
  const [maxValue, setMaxValue] = useState<number | undefined>(
    data?.testCase?.config?.maxValue
  );
  const [value, setValue] = useState<number | undefined>(
    data?.testCase.config?.value
  );
  const [frequency, setFrequency] = useState<TestCaseExecutionFrequency>(
    data?.executionFrequency
      ? data.executionFrequency
      : TestCaseExecutionFrequency.Daily
  );
  const [isShowError, setIsShowError] = useState({
    minOrMax: false,
    values: false,
    minMaxValue: false,
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
      setTestTypeOptions(newTest);
      setTableTest(newTest[0]);
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

    if (isTableRowCountToBeBetweenTest) {
      errMsg.minOrMax = isEmpty(minValue) && isEmpty(maxValue);
      if (!isEmpty(minValue) && !isEmpty(maxValue)) {
        errMsg.minMaxValue = (minValue as number) > (maxValue as number);
      }
    } else {
      errMsg.values = isEmpty(value);
    }

    setIsShowError(errMsg);

    return !Object.values(errMsg).includes(true);
  };

  const handleSave = () => {
    const isTableRowCountToBeBetweenTest =
      tableTest === TableTestType.TableRowCountToBeBetween;

    if (validateForm()) {
      const createTest: CreateTableTest = {
        description: markdownRef.current?.getEditorContent() || undefined,
        executionFrequency: frequency,
        testCase: {
          config: {
            maxValue: isTableRowCountToBeBetweenTest ? maxValue : undefined,
            minValue: isTableRowCountToBeBetweenTest ? minValue : undefined,
            value: isTableRowCountToBeBetweenTest ? undefined : value,
          },
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

      case 'frequency':
        setFrequency(value as TestCaseExecutionFrequency);

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
          className="tw-form-inputs tw-px-3 tw-py-1"
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

  const getMinMaxField = () => {
    return (
      <Fragment>
        <div className="tw-flex tw-gap-4 tw-w-full">
          <div className="tw-flex-1">
            <label className="tw-block tw-form-label" htmlFor="min">
              Min:
            </label>
            <input
              className="tw-form-inputs tw-px-3 tw-py-1"
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
              className="tw-form-inputs tw-px-3 tw-py-1"
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

  return (
    <Fragment>
      <p className="tw-font-medium tw-px-4">
        {isUndefined(data) ? 'Add' : 'Edit'} Table Test
      </p>

      <form
        className="tw-w-screen-sm"
        data-testid="form"
        onSubmit={(e) => e.preventDefault()}>
        <div className="tw-px-4 tw-mx-auto">
          <Field>
            <label className="tw-block tw-form-label" htmlFor="tableTestType">
              {requiredField('Test Type:')}
            </label>
            <select
              className={classNames('tw-form-inputs tw-px-3 tw-py-1', {
                'tw-cursor-not-allowed': !isUndefined(data),
              })}
              disabled={!isUndefined(data)}
              id="tableTestType"
              name="tableTestType"
              value={tableTest}
              onChange={handleValidation}>
              {testTypeOptions &&
                testTypeOptions.length > 0 &&
                testTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
            </select>
          </Field>

          <Field>
            <label
              className="tw-block tw-form-label tw-mb-0"
              htmlFor="description">
              Description:
            </label>
            <MarkdownWithPreview
              data-testid="description"
              ref={markdownRef}
              value={description}
            />
          </Field>

          <Field>
            {tableTest === TableTestType.TableRowCountToBeBetween
              ? getMinMaxField()
              : getValueField()}
          </Field>

          <Field>
            <label className="tw-block tw-form-label" htmlFor="frequency">
              Frequency of Test Run:
            </label>
            <select
              className="tw-form-inputs tw-px-3 tw-py-1"
              id="frequency"
              name="frequency"
              value={frequency}
              onChange={handleValidation}>
              {Object.values(TestCaseExecutionFrequency).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field className="tw-flex tw-justify-end">
          <Button
            data-testid="cancel-test"
            size="regular"
            theme="primary"
            variant="text"
            onClick={onFormCancel}>
            Discard
          </Button>
          <Button
            className="tw-w-16 tw-h-10"
            size="regular"
            theme="primary"
            variant="contained"
            onClick={handleSave}>
            Save
          </Button>
        </Field>
      </form>
    </Fragment>
  );
};

export default TableTestForm;
