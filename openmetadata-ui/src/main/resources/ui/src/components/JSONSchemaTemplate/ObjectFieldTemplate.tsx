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
import { Button, Space } from 'antd';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import React, { Fragment, FunctionComponent } from 'react';

export const ObjectFieldTemplate: FunctionComponent<ObjectFieldTemplateProps> =
  (props: ObjectFieldTemplateProps) => {
    return (
      <Fragment>
        <Space className="w-full justify-between">
          <label
            className={classNames('control-label', {
              'font-medium text-base-color text-md':
                !props.schema.additionalProperties,
            })}
            id={`${props.idSchema.$id}__title`}>
            {props.title}
          </label>

          {props.schema.additionalProperties && (
            <Button
              data-testid={`add-item-${props.title}`}
              icon={
                <PlusOutlined style={{ color: 'white', fontSize: '12px' }} />
              }
              id={`${props.idSchema.$id}`}
              size="small"
              type="primary"
              onClick={() => {
                props.onAddClick(props.schema)();
              }}
              onFocus={() => {
                const { formContext } = props;
                if (!isUndefined(formContext.handleFocus)) {
                  formContext.handleFocus(props.idSchema.$id);
                }
              }}
            />
          )}
        </Space>
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
