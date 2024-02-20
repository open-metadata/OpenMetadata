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
import { Col, Row, Select, Typography } from 'antd';
import { t } from 'i18next';
import { startCase } from 'lodash';
import React from 'react';

const WorkflowArrayFieldTemplate = (props: FieldProps) => {
  const handleFocus = () => {
    let id = props.idSchema.$id;

    if (/FilterPattern/.test(id)) {
      id = id.split('/').slice(0, 2).join('/');
    }
    props.formContext?.handleFocus?.(id);
  };

  return (
    <Row>
      <Col span={24}>
        <Typography>{startCase(props.name)}</Typography>
      </Col>
      <Col span={24}>
        <Select
          className="m-t-xss w-full"
          disabled={props.disabled}
          id={props.idSchema.$id}
          mode="tags"
          open={false}
          placeholder={t('message.filter-pattern-placeholder')}
          value={props.formData ?? []}
          onChange={(value) => props.onChange(value)}
          onFocus={handleFocus}
        />
      </Col>
    </Row>
  );
};

export default WorkflowArrayFieldTemplate;
