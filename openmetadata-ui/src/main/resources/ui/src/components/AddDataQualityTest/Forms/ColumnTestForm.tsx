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
import { ColumnTestType } from '../../../enums/columnTest.enum';
import { TestCaseExecutionFrequency } from '../../../generated/api/tests/createTableTest';
import { Table } from '../../../generated/entity/data/table';
import {
  ColumnTest,
  ModifiedTableColumn,
} from '../../../interface/dataQuality.interface';
import {
  errorMsg,
  getCurrentUserId,
  requiredField,
} from '../../../utils/CommonUtils';
import SVGIcons from '../../../utils/SvgUtils';
import { getDataTypeString } from '../../../utils/TableUtils';
import { Button } from '../../buttons/Button/Button';
import MarkdownWithPreview from '../../common/editor/MarkdownWithPreview';

type Props = {
  data: ColumnTest;
  column: ModifiedTableColumn[];
  handleAddColumnTestCase: (data: ColumnTest) => void;
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

const ColumnTestForm = ({
  data,
  column,
  handleAddColumnTestCase,
  onFormCancel,
}: Props) => {
  const markdownRef = useRef<EditorContentRef>();
  const [description] = useState(data?.description || '');
  const isAcceptedTypeIsString = useRef<boolean>(true);
  const [columnTest, setColumnTest] = useState<ColumnTestType>(
    data?.testCase?.columnTestType
  );
  const [columnOptions, setColumnOptions] = useState<Table['columns']>([]);
  const [testTypeOptions, setTestTypeOptions] = useState<string[]>([]);
  const [minValue, setMinValue] = useState<number | undefined>(
    data?.testCase?.config?.minValue
  );
  const [maxValue, setMaxValue] = useState<number | undefined>(
    data?.testCase?.config?.maxValue
  );

  const [frequency, setFrequency] = useState<TestCaseExecutionFrequency>(
    data?.executionFrequency || TestCaseExecutionFrequency.Daily
  );
  const [forbiddenValues, setForbiddenValues] = useState<(string | number)[]>(
    data?.testCase?.config?.forbiddenValues || ['']
  );
  const [isShowError, setIsShowError] = useState({
    columnName: false,
    regex: false,
    minOrMax: false,
    missingCountValue: false,
    values: false,
    minMaxValue: false,
  });

  const [columnName, setColumnName] = useState(data?.columnName);
  const [missingValueMatch, setMissingValueMatch] = useState<string>(
    data?.testCase?.config?.missingValueMatch || ''
  );
  const [missingCountValue, setMissingCountValue] = useState<
    number | undefined
  >(data?.testCase?.config?.missingCountValue);

  const [regex, setRegex] = useState<string>(
    data?.testCase?.config?.regex || ''
  );

  const addValueFields = () => {
    setForbiddenValues([...forbiddenValues, '']);
  };

  const removeValueFields = (i: number) => {
    const newFormValues = [...forbiddenValues];
    newFormValues.splice(i, 1);
    setForbiddenValues(newFormValues);
  };

  const handleValueFieldsChange = (i: number, value: string) => {
    const newFormValues = [...forbiddenValues];
    newFormValues[i] = value;
    setForbiddenValues(newFormValues);
    setIsShowError({ ...isShowError, values: false });
  };

  const handleTestTypeOptionChange = (name: string) => {
    const selectedColumn = column.find((d) => d.name === name);
    const existingTests =
      selectedColumn?.columnTests?.map(
        (d: ColumnTest) => d.testCase.columnTestType
      ) || [];
    if (existingTests.length) {
      const newTest = Object.values(ColumnTestType).filter(
        (d) => !existingTests.includes(d)
      );
      setTestTypeOptions(newTest);
      setColumnTest(newTest[0]);
    } else {
      const newTest = Object.values(ColumnTestType);
      setTestTypeOptions(newTest);
      setColumnTest(newTest[0]);
    }
  };

  useEffect(() => {
    if (isUndefined(data)) {
      const allOption = column.filter((value) => {
        return (
          value?.dataType !== 'STRUCT' &&
          value.columnTests?.length !== Object.values(ColumnTestType).length
        );
      });
      setColumnOptions(allOption);
      setColumnName(allOption[0]?.name || '');
      handleTestTypeOptionChange(allOption[0]?.name || '');
    } else {
      setColumnOptions(column);
      setTestTypeOptions(Object.values(ColumnTestType));
      setColumnName(data.columnName || '');
    }
  }, [column]);

  const validateForm = () => {
    const errMsg = cloneDeep(isShowError);
    errMsg.columnName = isEmpty(columnName);

    switch (columnTest) {
      case ColumnTestType.columnValueLengthsToBeBetween:
      case ColumnTestType.columnValuesToBeBetween:
        errMsg.minOrMax = isEmpty(minValue) && isEmpty(maxValue);
        if (!isUndefined(minValue) && !isUndefined(maxValue)) {
          errMsg.minMaxValue = (+minValue as number) > (+maxValue as number);
        }

        break;

      case ColumnTestType.columnValuesMissingCountToBeEqual:
        errMsg.missingCountValue = isEmpty(missingCountValue);

        break;

      case ColumnTestType.columnValuesToBeNotInSet: {
        const actualValues = forbiddenValues.filter((v) => !isEmpty(v));
        errMsg.values = actualValues.length < 1;

        break;
      }

      case ColumnTestType.columnValuesToMatchRegex:
        errMsg.regex = isEmpty(regex);

        break;
    }

    setIsShowError(errMsg);

    return !Object.values(errMsg).includes(true);
  };

  const getTestConfi = () => {
    switch (columnTest) {
      case ColumnTestType.columnValueLengthsToBeBetween:
      case ColumnTestType.columnValuesToBeBetween:
        return {
          minValue: minValue,
          maxValue: maxValue,
        };

      case ColumnTestType.columnValuesMissingCountToBeEqual:
        return {
          missingCountValue: missingCountValue,
          missingValueMatch: missingValueMatch,
        };

      case ColumnTestType.columnValuesToBeNotInSet:
        return {
          forbiddenValues: forbiddenValues.filter((v) => !isEmpty(v)),
        };

      case ColumnTestType.columnValuesToMatchRegex:
        return {
          regex: regex,
        };

      case ColumnTestType.columnValuesToBeNotNull:
      case ColumnTestType.columnValuesToBeUnique:
      default:
        return {};
    }
  };

  const handleSave = () => {
    if (validateForm()) {
      const columnTestObj: ColumnTest = {
        columnName: columnName,
        description: markdownRef.current?.getEditorContent() || undefined,
        executionFrequency: frequency,
        testCase: {
          config: getTestConfi(),
          columnTestType: columnTest,
        },
        owner: {
          type: 'user',
          id: getCurrentUserId(),
        },
      };
      handleAddColumnTestCase(columnTestObj);
    }
  };

  const handleValidation = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = event.target.value;
    const eleName = event.target.name;

    const errorMsg = cloneDeep(isShowError);

    switch (eleName) {
      case 'columTestType': {
        const selectedColumn = column.find((d) => d.name === columnName);
        const columnDataType = getDataTypeString(
          selectedColumn?.dataType as string
        );
        isAcceptedTypeIsString.current =
          columnDataType === 'varchar' || columnDataType === 'boolean';
        setForbiddenValues(['']);
        setColumnTest(value as ColumnTestType);
        errorMsg.columnName = false;
        errorMsg.regex = false;
        errorMsg.minOrMax = false;
        errorMsg.missingCountValue = false;
        errorMsg.values = false;
        errorMsg.minMaxValue = false;

        break;
      }
      case 'min': {
        setMinValue(value as unknown as number);
        errorMsg.minOrMax = false;
        errorMsg.minMaxValue = false;

        break;
      }

      case 'max': {
        setMaxValue(value as unknown as number);
        errorMsg.minOrMax = false;
        errorMsg.minMaxValue = false;

        break;
      }

      case 'frequency':
        setFrequency(value as TestCaseExecutionFrequency);

        break;

      case 'columnName': {
        const selectedColumn = column.find((d) => d.name === value);
        const columnDataType = getDataTypeString(
          selectedColumn?.dataType as string
        );
        isAcceptedTypeIsString.current =
          columnDataType === 'varchar' || columnDataType === 'boolean';
        setForbiddenValues(['']);
        setColumnName(value);
        handleTestTypeOptionChange(value);
        errorMsg.columnName = false;

        break;
      }

      case 'missingValueMatch':
        setMissingValueMatch(value);

        break;

      case 'missingCountValue':
        setMissingCountValue(value as unknown as number);
        errorMsg.missingCountValue = false;

        break;

      case 'regex':
        setRegex(value);
        errorMsg.regex = false;

        break;

      default:
        break;
    }

    setIsShowError(errorMsg);
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
        {isShowError.minOrMax && errorMsg('Please enter atleast one value.')}
        {isShowError.minMaxValue &&
          errorMsg('Min value should be lower than Max value.')}
      </Fragment>
    );
  };

  const getMissingCountToBeEqualFields = () => {
    return (
      <Fragment>
        <div className="tw-flex tw-gap-4 tw-w-full">
          <div className="tw-flex-1">
            <label
              className="tw-block tw-form-label"
              htmlFor="missingCountValue">
              {requiredField('Count:')}
            </label>
            <input
              className="tw-form-inputs tw-px-3 tw-py-1"
              data-testid="missingCountValue"
              id="missingCountValue"
              name="missingCountValue"
              placeholder="Missing count value"
              type="number"
              value={missingCountValue}
              onChange={handleValidation}
            />
            {isShowError.missingCountValue &&
              errorMsg('Count value is required.')}
          </div>
          <div className="tw-flex-1">
            <label
              className="tw-block tw-form-label"
              htmlFor="missingValueMatch">
              Match:
            </label>
            <input
              className="tw-form-inputs tw-px-3 tw-py-1"
              data-testid="missingValueMatch"
              id="missingValueMatch"
              name="missingValueMatch"
              placeholder="Missing value match"
              value={missingValueMatch}
              onChange={handleValidation}
            />
          </div>
        </div>
      </Fragment>
    );
  };

  const getColumnValuesToMatchRegexFields = () => {
    return (
      <Field>
        <label className="tw-block tw-form-label" htmlFor="regex">
          {requiredField('Regex:')}
        </label>
        <input
          className="tw-form-inputs tw-px-3 tw-py-1"
          data-testid="regex"
          id="regex"
          name="regex"
          placeholder="Regex column entries should match"
          value={regex}
          onChange={handleValidation}
        />
        {isShowError.regex && errorMsg('Regex is required.')}
      </Field>
    );
  };

  const getColumnValuesToBeNotInSetField = () => {
    return (
      <div data-testid="not-in-set-fiel">
        <div className="tw-flex tw-items-center tw-mt-6">
          <p className="w-form-label tw-mr-3">{requiredField('Values')}</p>
          <Button
            className="tw-h-5 tw-px-2"
            size="x-small"
            theme="primary"
            variant="contained"
            onClick={addValueFields}>
            <i aria-hidden="true" className="fa fa-plus" />
          </Button>
        </div>

        {forbiddenValues.map((value, i) => (
          <div className="tw-flex tw-items-center" key={i}>
            <div className="tw-w-11/12">
              <Field>
                <input
                  className="tw-form-inputs tw-px-3 tw-py-1"
                  id={`option-key-${i}`}
                  name="key"
                  placeholder="Values not to be in the set"
                  type={isAcceptedTypeIsString.current ? 'text' : 'number'}
                  value={value}
                  onChange={(e) => handleValueFieldsChange(i, e.target.value)}
                />
              </Field>
            </div>
            <button
              className="focus:tw-outline-none tw-mt-3 tw-w-1/12"
              onClick={(e) => {
                removeValueFields(i);
                e.preventDefault();
              }}>
              <SVGIcons
                alt="delete"
                icon="icon-delete"
                title="Delete"
                width="12px"
              />
            </button>
          </div>
        ))}

        {isShowError.values && errorMsg('Value is required.')}
      </div>
    );
  };

  const getColumnTestConfig = () => {
    switch (columnTest) {
      case ColumnTestType.columnValueLengthsToBeBetween:
      case ColumnTestType.columnValuesToBeBetween:
        return getMinMaxField();

      case ColumnTestType.columnValuesMissingCountToBeEqual:
        return getMissingCountToBeEqualFields();

      case ColumnTestType.columnValuesToBeNotInSet:
        return getColumnValuesToBeNotInSetField();

      case ColumnTestType.columnValuesToMatchRegex:
        return getColumnValuesToMatchRegexFields();

      case ColumnTestType.columnValuesToBeNotNull:
      case ColumnTestType.columnValuesToBeUnique:
      default:
        return <></>;
    }
  };

  return (
    <div>
      <p className="tw-font-medium tw-px-4">
        {isUndefined(data) ? 'Add' : 'Edit'} Column Test
      </p>
      <form
        className="tw-w-screen-sm"
        data-testid="form"
        onSubmit={(e) => e.preventDefault()}>
        <div className="tw-px-4 tw-mx-auto">
          <Field>
            <label className="tw-block tw-form-label" htmlFor="columnName">
              {requiredField('Column Name:')}
            </label>
            <select
              className={classNames('tw-form-inputs tw-px-3 tw-py-1', {
                'tw-cursor-not-allowed': !isUndefined(data),
              })}
              disabled={!isUndefined(data)}
              id="columnName"
              name="columnName"
              value={columnName}
              onChange={handleValidation}>
              {columnOptions.map((option) => (
                <option key={option.name} value={option.name}>
                  {option.name}
                </option>
              ))}
            </select>
            {isShowError.columnName && errorMsg('Column name is required.')}
          </Field>

          <Field>
            <label className="tw-block tw-form-label" htmlFor="columTestType">
              {requiredField('Test Type:')}
            </label>
            <select
              className={classNames('tw-form-inputs tw-px-3 tw-py-1', {
                'tw-cursor-not-allowed': !isUndefined(data),
              })}
              disabled={!isUndefined(data)}
              id="columTestType"
              name="columTestType"
              value={columnTest}
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

          {getColumnTestConfig()}

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
        <Field>
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
        </Field>
      </form>
    </div>
  );
};

export default ColumnTestForm;
