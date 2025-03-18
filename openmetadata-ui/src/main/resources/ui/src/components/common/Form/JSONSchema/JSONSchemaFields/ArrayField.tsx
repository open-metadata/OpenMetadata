/*
 *  Copyright 2025 Collate.
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
import { Col, Row, Select, Typography } from 'antd';
import { startCase } from 'lodash';
import React from 'react';

const ArrayField = (props: FieldProps) => {
  const handleFocus = () => {
    let id = props.idSchema.$id;

    if (/FilterPattern/.test(id)) {
      id = id.split('/').slice(0, 2).join('/');
    }
    props.formContext?.handleFocus?.(id);
  };

  const generateOptions = () => {
    if (
      typeof props.schema.items === 'object' &&
      !Array.isArray(props.schema.items) &&
      props.schema.items.type === 'string' &&
      Array.isArray(props.schema.items.enum)
    ) {
      return (props.schema.items.enum as string[]).map((option) => ({
        label: option,
        value: option,
      }));
    }

    return undefined;
  };

  const id = props.idSchema.$id;
  const value = props.formData ?? [];
  const options = generateOptions();

  return (
    <Row>
      <Col span={24}>
        {/* Display field title only if uniqueItems is not true to remove duplicate title set
         automatically due to an unknown behavior */}
        {props.schema.uniqueItems !== true && (
          <Typography>{startCase(props.name)}</Typography>
        )}
      </Col>
      <Col span={24}>
        <Select
          className="m-t-xss w-full"
          data-testid="array-field"
          disabled={props.disabled}
          id={id}
          mode={options ? 'multiple' : 'tags'}
          open={options ? undefined : false}
          options={options}
          value={value}
          onBlur={() => props.onBlur(id, value)}
          onChange={(value) => props.onChange(value)}
          onFocus={handleFocus}
        />
      </Col>
    </Row>
  );
};

export default ArrayField;
