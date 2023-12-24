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

import { PlusOutlined } from '@ant-design/icons';
import { Button, Form, Input, InputNumber, Select, Switch } from 'antd';
import 'codemirror/addon/fold/foldgutter.css';
import { isUndefined } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_PARTITION_TYPE_FOR_DATE_TIME } from '../../../constants/profiler.constant';
import { CSMode } from '../../../enums/codemirror.enum';
import {
  TestCaseParameterDefinition,
  TestDataType,
} from '../../../generated/tests/testDefinition';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import SchemaEditor from '../../SchemaEditor/SchemaEditor';
import '../../TableProfiler/table-profiler.less';
import { ParameterFormProps } from '../AddDataQualityTest.interface';

const ParameterForm: React.FC<ParameterFormProps> = ({ definition, table }) => {
  const { t } = useTranslation();

  const prepareForm = (data: TestCaseParameterDefinition) => {
    let Field = (
      <Input
        placeholder={`${t('message.enter-a-field', {
          field: data.displayName,
        })}`}
      />
    );
    if (data.optionValues?.length) {
      Field = (
        <Select
          placeholder={`${t('label.please-select-entity', {
            entity: data.displayName,
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
                options={partitionColumnOptions}
                placeholder={t('message.select-column-name')}
              />
            );
          } else if (data.name === 'sqlExpression') {
            Field = (
              <SchemaEditor
                className="custom-query-editor query-editor-h-200"
                mode={{ name: CSMode.SQL }}
                options={{
                  readOnly: false,
                }}
              />
            );
          } else {
            Field = (
              <Input
                placeholder={`${t('message.enter-a-field', {
                  field: data.displayName,
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
                field: data.displayName,
              })}`}
            />
          );

          break;
        case TestDataType.Boolean:
          Field = <Switch />;

          break;
        case TestDataType.Array:
        case TestDataType.Set:
          Field = (
            <Input
              placeholder={`${t('message.enter-comma-separated-field', {
                field: data.displayName,
              })}`}
            />
          );

          return (
            <Form.List
              initialValue={[{ value: '' }]}
              key={data.name}
              name={data.name || ''}>
              {(fields, { add, remove }) => (
                <Form.Item
                  key={data.name}
                  label={
                    <>
                      <span>{data.displayName}</span>
                      <Button
                        className="m-x-sm"
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
                        className="w-full"
                        {...restField}
                        name={[name, 'value']}
                        rules={[
                          {
                            required: data.required,
                            message: `${t('message.field-text-is-required', {
                              fieldText: data.displayName,
                            })}`,
                          },
                        ]}>
                        <Input
                          placeholder={`${t('message.enter-a-field', {
                            field: data.displayName,
                          })}`}
                        />
                      </Form.Item>
                      <Button
                        icon={<SVGIcons alt="delete" icon={Icons.DELETE} />}
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

    return (
      <Form.Item
        data-testid="parameter"
        key={data.name}
        label={`${data.displayName}:`}
        name={data.name}
        rules={[
          {
            required: data.required,
            message: `${t('message.field-text-is-required', {
              fieldText: data.displayName,
            })}`,
          },
        ]}
        tooltip={data.description}>
        {Field}
      </Form.Item>
    );
  };

  return (
    <Form.List name="params">
      {() => definition.parameterDefinition?.map(prepareForm)}
    </Form.List>
  );
};

export default ParameterForm;
