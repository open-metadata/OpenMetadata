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
import { ObjectFieldTemplateProps } from '@rjsf/core';
import { Button, Col, Row } from 'antd';
import classNames from 'classnames';
import React, { Fragment, FunctionComponent } from 'react';

export const ObjectFieldTemplate: FunctionComponent<ObjectFieldTemplateProps> =
  (props: ObjectFieldTemplateProps) => {
    return (
      <Fragment>
        <Row>
          <Col span={8}>
            <label
              className="control-label"
              id={`${props.idSchema.$id}__title`}>
              {props.title}
            </label>
          </Col>

          {props.schema.additionalProperties && (
            <Col span={16}>
              <Button
                data-testid={`add-item-${props.title}`}
                icon={
                  <PlusOutlined style={{ color: 'white', fontSize: '12px' }} />
                }
                id={`${props.idSchema.$id}__add`}
                size="small"
                type="primary"
                onClick={() => {
                  props.onAddClick(props.schema)();
                }}
              />
            </Col>
          )}
        </Row>
        {props.properties.map((element, index) => (
          <div
            className={classNames('property-wrapper', {
              'additional-fields': props.schema.additionalProperties,
            })}
            key={`${element.content.key}-${index}`}>
            {element.content}
          </div>
        ))}
      </Fragment>
    );
  };
