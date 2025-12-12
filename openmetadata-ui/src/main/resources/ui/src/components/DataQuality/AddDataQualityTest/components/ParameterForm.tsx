/*
 *  Copyright 2022 Collate.
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

import { PlusOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import Icon from '@ant-design/icons/lib/components/Icon';
import {
  Button,
  Form,
  FormItemProps,
  Input,
  InputNumber,
  Select,
  Switch,
  Tooltip,
  Typography,
} from 'antd';
import { FormListProps, RuleRender } from 'antd/lib/form';
import 'codemirror/addon/fold/foldgutter.css';
import { debounce, isUndefined } from 'lodash';
import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconDelete } from '../../../../assets/svg/ic-delete.svg';
import { WILD_CARD_CHAR } from '../../../../constants/char.constants';
import { PAGE_SIZE_LARGE } from '../../../../constants/constants';
import { SUPPORTED_PARTITION_TYPE_FOR_DATE_TIME } from '../../../../constants/profiler.constant';
import { TABLE_DIFF } from '../../../../constants/TestSuite.constant';
import { CSMode } from '../../../../enums/codemirror.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { Column } from '../../../../generated/entity/data/table';
import {
  Rule,
  TestCaseParameterDefinition,
  TestDataType,
} from '../../../../generated/tests/testDefinition';
import {
  SearchHitBody,
  TableSearchSource,
} from '../../../../interface/search.interface';
import { searchQuery } from '../../../../rest/searchAPI';
import { getEntityName } from '../../../../utils/EntityUtils';
import { getPopupContainer } from '../../../../utils/formUtils';
import {
  getSelectedColumnsSet,
  validateEquals,
  validateGreaterThanOrEquals,
  validateLessThanOrEquals,
  validateNotEquals,
} from '../../../../utils/ParameterForm/ParameterFormUtils';
import '../../../Database/Profiler/TableProfiler/table-profiler.less';
import CodeEditor from '../../../Database/SchemaEditor/CodeEditor';
import { ParameterFormProps } from '../AddDataQualityTest.interface';

const ParameterForm: React.FC<ParameterFormProps> = ({ definition, table }) => {
  const { t } = useTranslation();

  const prepareForm = (
    data: TestCaseParameterDefinition,
    DynamicField?: ReactElement
  ) => {
    const label = getEntityName(data);
    const ruleValidation: RuleRender = ({ getFieldValue }) => ({
      validator(_, formValue) {
        if (data?.validationRule) {
          const fieldValue = data.validationRule.parameterField
            ? +getFieldValue(['params', data.validationRule.parameterField])
            : undefined;
          const value = +formValue;
          if (fieldValue && value) {
            switch (data.validationRule.rule) {
              case Rule.GreaterThanOrEquals:
                return validateGreaterThanOrEquals(fieldValue, value);
              case Rule.LessThanOrEquals:
                return validateLessThanOrEquals(fieldValue, value);
              case Rule.Equals:
                return validateEquals(fieldValue, value);
              case Rule.NotEquals:
                return validateNotEquals(fieldValue, value);
            }
          }
        }

        return Promise.resolve();
      },
    });

    let internalFormItemProps: FormItemProps = {};
    let Field = (
      <Input
        placeholder={`${t('message.enter-a-field', {
          field: label,
        })}`}
      />
    );
    if (data.optionValues?.length) {
      Field = (
        <Select
          getPopupContainer={getPopupContainer}
          placeholder={`${t('label.please-select-entity', {
            entity: label,
          })}`}>
          {data.optionValues.map((value) => (
            <Select.Option key={value}>{value}</Select.Option>
          ))}
        </Select>
      );
    } else {
      switch (data.dataType) {
        case TestDataType.String:
          if (
            !isUndefined(table) &&
            definition.name === 'tableRowInsertedCountToBeBetween' &&
            data.name === 'columnName'
          ) {
            const partitionColumnOptions = table.columns.reduce(
              (result, column) => {
                if (
                  SUPPORTED_PARTITION_TYPE_FOR_DATE_TIME.includes(
                    column.dataType
                  )
                ) {
                  return [
                    ...result,
                    {
                      value: column.name,
                      label: column.name,
                    },
                  ];
                }

                return result;
              },
              [] as { value: string; label: string }[]
            );
            Field = (
              <Select
                getPopupContainer={getPopupContainer}
                options={partitionColumnOptions}
                placeholder={t('message.select-column-name')}
              />
            );
          } else if (data.name === 'sqlExpression') {
            Field = (
              <CodeEditor
                showCopyButton
                className="custom-query-editor query-editor-h-200"
                mode={{ name: CSMode.SQL }}
                title={
                  <div className="ant-form-item-label">
                    <label className="d-flex align-items-center">
                      <Typography.Text className="form-label-title">
                        {label}
                      </Typography.Text>
                      <Tooltip title={data.description}>
                        <QuestionCircleOutlined className="ant-form-item-tooltip" />
                      </Tooltip>
                    </label>
                  </div>
                }
              />
            );
          } else if (data.name === 'column') {
            Field = (
              <Select
                getPopupContainer={getPopupContainer}
                options={table?.columns.map((column) => ({
                  label: getEntityName(column),
                  value: column.name,
                }))}
                placeholder={t('message.select-column-name')}
              />
            );
          } else {
            Field = (
              <Input
                placeholder={`${t('message.enter-a-field', {
                  field: label,
                })}`}
              />
            );
          }

          break;
        case TestDataType.Number:
        case TestDataType.Int:
        case TestDataType.Decimal:
        case TestDataType.Double:
        case TestDataType.Float:
          Field = (
            <InputNumber
              className="w-full"
              placeholder={`${t('message.enter-a-field', {
                field: label,
              })}`}
            />
          );

          break;
        case TestDataType.Boolean:
          Field = <Switch />;
          internalFormItemProps = {
            ...internalFormItemProps,
            valuePropName: 'checked',
          };

          break;
        case TestDataType.Array:
        case TestDataType.Set:
          Field = (
            <Input
              placeholder={`${t('message.enter-comma-separated-field', {
                field: label,
              })}`}
            />
          );

          return (
            <Form.List
              initialValue={[{ value: undefined }]}
              key={data.name}
              name={data.name || ''}>
              {(fields, { add, remove }) => (
                <Form.Item
                  key={data.name}
                  label={
                    <>
                      <span>{data.displayName}</span>
                      <Button
                        className="m-x-sm list-add-btn"
                        icon={<PlusOutlined />}
                        size="small"
                        type="primary"
                        onClick={() => add()}
                      />
                    </>
                  }
                  name={data.name}
                  tooltip={data.description}>
                  {fields.map(({ key, name, ...restField }) => (
                    <div className="d-flex w-full" key={key}>
                      <Form.Item
                        className="w-full m-b-0"
                        {...restField}
                        name={[name, 'value']}
                        rules={[
                          {
                            required: data.required,
                            message: `${t('message.field-text-is-required', {
                              fieldText: label,
                            })}`,
                          },
                        ]}>
                        {DynamicField ?? (
                          <Input
                            placeholder={`${t('message.enter-a-field', {
                              field: label,
                            })}`}
                          />
                        )}
                      </Form.Item>
                      <Button
                        icon={
                          <Icon
                            className="align-middle"
                            component={IconDelete}
                            style={{ fontSize: '16px' }}
                          />
                        }
                        type="text"
                        onClick={() => remove(name)}
                      />
                    </div>
                  ))}
                </Form.Item>
              )}
            </Form.List>
          );
      }
    }

    const commonFormItemProps = {
      'data-testid': 'parameter',
      key: data.name,

      name: data.name,
      rules: [
        {
          required: data.required,
          message: `${t('message.field-text-is-required', {
            fieldText: label,
          })}`,
        },
        ruleValidation,
      ],
      tooltip: data.description,
      ...internalFormItemProps,
    };

    return data.dataType === TestDataType.Boolean ? (
      <div className="d-flex gap-2 form-switch-container">
        <Form.Item {...commonFormItemProps} className="m-b-0">
          {Field}
        </Form.Item>
        <Typography.Text className="font-medium">{label}</Typography.Text>
      </div>
    ) : (
      <Form.Item
        {...commonFormItemProps}
        label={data.name === 'sqlExpression' ? undefined : label}>
        {DynamicField ?? Field}
      </Form.Item>
    );
  };

  const TableDiffForm = () => {
    const form = Form.useFormInstance();
    const [isOptionsLoading, setIsOptionsLoading] = useState(false);
    const [tableList, setTableList] = useState<
      SearchHitBody<
        SearchIndex.TABLE,
        Pick<
          TableSearchSource,
          'name' | 'displayName' | 'fullyQualifiedName' | 'columns'
        >
      >[]
    >([]);
    const [table2Columns, setTable2Columns] = useState<Column[] | undefined>();

    const tableOptions = useMemo(
      () =>
        tableList.map((hit) => ({
          label: hit._source.fullyQualifiedName,
          value: hit._source.fullyQualifiedName,
        })),
      [tableList]
    );

    const fetchTableData = useCallback(async (search = WILD_CARD_CHAR) => {
      setIsOptionsLoading(true);
      try {
        const response = await searchQuery({
          query: `*${search}*`,
          pageNumber: 1,
          pageSize: PAGE_SIZE_LARGE,
          searchIndex: SearchIndex.TABLE,
          fetchSource: true,
          includeFields: [
            'name',
            'fullyQualifiedName',
            'displayName',
            'columns',
          ],
        });
        setTableList(response.hits.hits);
      } catch {
        setTableList([]);
      } finally {
        setIsOptionsLoading(false);
      }
    }, []);

    const debounceFetchTableData = useMemo(
      () => debounce(fetchTableData, 1000),
      [fetchTableData]
    );

    useEffect(() => {
      fetchTableData();
    }, [fetchTableData]);

    useEffect(() => {
      const table2Value = form.getFieldValue(['params', 'table2']);
      if (table2Value && !table2Columns && tableList.length > 0) {
        const selectedTable = tableList.find(
          (hit) => hit._source.fullyQualifiedName === table2Value
        );
        if (selectedTable) {
          setTable2Columns(selectedTable._source.columns);
        }
      }
    }, [tableList, table2Columns, form]);

    const getFormData = (data: TestCaseParameterDefinition) => {
      switch (data.name) {
        case 'table2':
          return (
            <Form.Item noStyle shouldUpdate key={data.name}>
              {({ setFieldsValue }) =>
                prepareForm(
                  data,
                  <Select
                    allowClear
                    showSearch
                    data-testid="table2"
                    getPopupContainer={getPopupContainer}
                    loading={isOptionsLoading}
                    options={tableOptions}
                    placeholder={t('label.table')}
                    popupClassName="no-wrap-option"
                    onChange={(value) => {
                      // Clear key columns when table2 changes
                      setFieldsValue({
                        params: { 'table2.keyColumns': [{ value: undefined }] },
                      });

                      // Update columns or clear them
                      if (value) {
                        const selectedTable = tableList.find(
                          (hit) => hit._source.fullyQualifiedName === value
                        );
                        setTable2Columns(selectedTable?._source.columns);
                      } else {
                        setTable2Columns(undefined);
                      }
                    }}
                    onSearch={debounceFetchTableData}
                  />
                )
              }
            </Form.Item>
          );

        case 'keyColumns':
        case 'table2.keyColumns':
        case 'useColumns':
          return (
            <Form.Item noStyle shouldUpdate key={data.name}>
              {({ getFieldValue }) => {
                const isTable2KeyColumns = data.name === 'table2.keyColumns';
                const table2Value = getFieldValue(['params', 'table2']);

                let sourceColumns = table?.columns;
                if (isTable2KeyColumns) {
                  if (table2Value) {
                    const selectedTable =
                      tableList.find(
                        (hit) => hit._source.fullyQualifiedName === table2Value
                      ) ?? undefined;
                    sourceColumns =
                      selectedTable?._source.columns ?? table2Columns;
                  } else {
                    sourceColumns = undefined;
                  }
                }

                // Disable when no table2 selected
                const isDisabled = isTable2KeyColumns && !table2Value;

                const selectedColumnsSet = getSelectedColumnsSet(
                  data,
                  getFieldValue
                );

                const columnOptions =
                  sourceColumns?.map((column) => ({
                    label: getEntityName(column),
                    value: column.name,
                    disabled: selectedColumnsSet.has(column.name),
                  })) ?? [];

                return prepareForm(
                  data,
                  <Select
                    allowClear
                    showSearch
                    data-testid={`${data.name}-select`}
                    disabled={isDisabled}
                    getPopupContainer={getPopupContainer}
                    options={columnOptions}
                    placeholder={t('label.column')}
                  />
                );
              }}
            </Form.Item>
          );

        default:
          return prepareForm(data);
      }
    };

    return <>{definition.parameterDefinition?.map(getFormData)}</>;
  };

  const paramsForm: FormListProps['children'] = () => {
    switch (definition.fullyQualifiedName) {
      case TABLE_DIFF:
        return <TableDiffForm />;

      default:
        return definition.parameterDefinition?.map((data) => prepareForm(data));
    }
  };

  return <Form.List name="params">{paramsForm}</Form.List>;
};

export default ParameterForm;
