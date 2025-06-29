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
import {
  ObjectFieldTemplatePropertyType,
  ObjectFieldTemplateProps,
} from '@rjsf/utils';
import { Button, Collapse, Space } from 'antd';
import classNames from 'classnames';
import { isEmpty, isUndefined } from 'lodash';
import { createElement, Fragment, FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { ADVANCED_PROPERTIES } from '../../../../../constants/Services.constant';
import serviceUtilClassBase from '../../../../../utils/ServiceUtilClassBase';
import './object-field-template.less';

const { Panel } = Collapse;

interface PropertyMap {
  advancedProperties: ObjectFieldTemplatePropertyType[];
  normalProperties: ObjectFieldTemplatePropertyType[];
}

export const ObjectFieldTemplate: FunctionComponent<ObjectFieldTemplateProps> =
  (props: ObjectFieldTemplateProps) => {
    const { t } = useTranslation();

    const { formContext, idSchema, title, onAddClick, schema, properties } =
      props;

    const { advancedProperties, normalProperties } = properties.reduce(
      (propertyMap, currentProperty) => {
        const isAdvancedProperty = ADVANCED_PROPERTIES.includes(
          currentProperty.name
        );

        let advancedProperties = [...propertyMap.advancedProperties];
        let normalProperties = [...propertyMap.normalProperties];

        if (isAdvancedProperty) {
          advancedProperties = [...advancedProperties, currentProperty];
        } else {
          normalProperties = [...normalProperties, currentProperty];
        }

        return { ...propertyMap, advancedProperties, normalProperties };
      },
      {
        advancedProperties: [],

        normalProperties: [],
      } as PropertyMap
    );

    const {
      properties: updatedNormalProperties,
      additionalField: AdditionalField,
      additionalFieldContent,
    } = serviceUtilClassBase.getProperties(normalProperties);

    const fieldElement = (
      <Fragment>
        <Space className="w-full justify-between header-title-wrapper">
          <label
            className={classNames('control-label', {
              'font-medium text-base-color text-md':
                !schema.additionalProperties,
            })}
            id={`${idSchema.$id}__title`}>
            {title}
          </label>

          {schema.additionalProperties && (
            <Button
              data-testid={`add-item-${title}`}
              icon={
                <PlusOutlined style={{ color: 'white', fontSize: '12px' }} />
              }
              id={`${idSchema.$id}`}
              size="small"
              type="primary"
              onClick={() => {
                onAddClick(schema)();
              }}
              onFocus={() => {
                if (!isUndefined(formContext.handleFocus)) {
                  formContext.handleFocus(idSchema.$id);
                }
              }}
            />
          )}
        </Space>

        {AdditionalField &&
          createElement(AdditionalField, {
            data: additionalFieldContent,
          })}

        {updatedNormalProperties.map((element, index) => (
          <div
            className={classNames('property-wrapper', {
              'additional-fields': schema.additionalProperties,
            })}
            key={`${element.content.key}-${index}`}>
            {element.content}
          </div>
        ))}
        {!isEmpty(advancedProperties) && (
          <Collapse
            className="advanced-properties-collapse"
            expandIconPosition="end">
            <Panel header={`${title} ${t('label.advanced-config')}`} key="1">
              {advancedProperties.map((element, index) => (
                <div
                  className={classNames('property-wrapper', {
                    'additional-fields': schema.additionalProperties,
                  })}
                  key={`${element.content.key}-${index}`}>
                  {element.content}
                </div>
              ))}
            </Panel>
          </Collapse>
        )}
      </Fragment>
    );

    return fieldElement;
  };
