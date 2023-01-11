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
import { Button, Form, Input, InputNumber, Switch } from 'antd';
import 'codemirror/addon/fold/foldgutter.css';
import React from 'react';
import {
  TestCaseParameterDefinition,
  TestDataType,
} from '../../../generated/tests/testDefinition';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import '../../TableProfiler/tableProfiler.less';
import { ParameterFormProps } from '../AddDataQualityTest.interface';

const ParameterForm: React.FC<ParameterFormProps> = ({ definition }) => {
  const prepareForm = (data: TestCaseParameterDefinition) => {
    let Field = <Input placeholder={`Enter ${data.displayName}`} />;
    switch (data.dataType) {
      case TestDataType.String:
        Field = <Input placeholder={`Enter ${data.displayName}`} />;

        break;
      case TestDataType.Number:
      case TestDataType.Int:
      case TestDataType.Decimal:
      case TestDataType.Double:
      case TestDataType.Float:
        Field = (
          <InputNumber
            className="tw-w-full"
            placeholder={`Enter ${data.displayName}`}
          />
        );

        break;
      case TestDataType.Boolean:
        Field = <Switch />;

        break;
      case TestDataType.Array:
      case TestDataType.Set:
        Field = (
          <Input placeholder={`Enter comma(,) separated ${data.displayName}`} />
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
                  <span>
                    <span className="tw-mr-3">{data.displayName}:</span>
                    <Button
                      icon={<PlusOutlined />}
                      size="small"
                      type="primary"
                      onClick={() => add()}
                    />
                  </span>
                }
                name={data.name}
                tooltip={data.description}>
                {fields.map(({ key, name, ...restField }) => (
                  <div className="tw-flex tw-gap-2 tw-w-full" key={key}>
                    <Form.Item
                      className="tw-w-11/12 tw-mb-4"
                      {...restField}
                      name={[name, 'value']}
                      rules={[
                        {
                          required: data.required,
                          message: `${data.displayName} is required!`,
                        },
                      ]}>
                      <Input placeholder={`Enter ${data.displayName}`} />
                    </Form.Item>
                    <Button
                      icon={
                        <SVGIcons
                          alt="delete"
                          className="tw-w-4"
                          icon={Icons.DELETE}
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

    return (
      <Form.Item
        key={data.name}
        label={`${data.displayName}:`}
        name={data.name}
        rules={[
          {
            required: data.required,
            message: `${data.displayName} is required!`,
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
