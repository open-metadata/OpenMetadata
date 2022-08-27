/*
 *  Copyright 2022 Collate
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

import { Form, Input, InputNumber, Switch } from 'antd';
import 'codemirror/addon/fold/foldgutter.css';
import React from 'react';
import {
  TestCaseParameterDefinition,
  TestDataType,
} from '../../../generated/tests/testDefinition';
import '../../TableProfiler/tableProfiler.less';
import { ParameterFormProps } from '../AddDataQualityTest.interface';

type ModifiedTestCaseParameterDefinition = TestCaseParameterDefinition & {
  type?: string;
};

const ParameterForm: React.FC<ParameterFormProps> = ({ definition }) => {
  const prepareForm = (data: ModifiedTestCaseParameterDefinition) => {
    let Field = <Input placeholder={`Enter ${data.displayName}`} />;
    switch ((data.dataType as string) || data.type) {
      case TestDataType.String:
        Field = <Input placeholder={`Enter ${data.displayName}`} />;

        break;
      case TestDataType.Number:
      case TestDataType.Int:
        Field = (
          <InputNumber
            className="tw-w-full"
            placeholder={`Enter ${data.displayName}`}
          />
        );

        break;
      case 'BOOLEAN':
        Field = <Switch />;

        break;
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
