/*
 *  Copyright 2023 Collate.
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
import { FieldProps } from '@rjsf/utils';
import { Form, Switch } from 'antd';
import { startCase } from 'lodash';

const BooleanFieldTemplate = (props: FieldProps) => {
  return (
    <Form.Item
      className="m-t-md"
      colon={false}
      label={startCase(props.name)}
      labelAlign="left"
      labelCol={{ span: 10 }}>
      <Switch
        checked={props.formData}
        id={props.idSchema.$id}
        onChange={(value) => props.onChange(value)}
        onClick={() => props.formContext?.handleFocus?.(props.idSchema.$id)}
      />
    </Form.Item>
  );
};

export default BooleanFieldTemplate;
