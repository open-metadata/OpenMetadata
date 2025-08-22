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

import { PlusOutlined } from '@ant-design/icons';
import {
  ObjectFieldTemplatePropertyType,
  ObjectFieldTemplateProps,
} from '@rjsf/utils';
import { Button, Space } from 'antd';
import classNames from 'classnames';
import { isEmpty, isUndefined } from 'lodash';
import { createElement, Fragment, FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { ADVANCED_PROPERTIES } from '../../constants/Services.constant';
import serviceUtilClassBase from '../../utils/ServiceUtilClassBase';
import './SSOObjectFieldTemplate.less';

interface PropertyMap {
  advancedProperties: ObjectFieldTemplatePropertyType[];
  normalProperties: ObjectFieldTemplatePropertyType[];
}

interface FieldGroup {
  title: string;
  properties: ObjectFieldTemplatePropertyType[];
  className?: string;
}

export const SSOObjectFieldTemplate: FunctionComponent<ObjectFieldTemplateProps> =
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

    // Define field groups for SSO forms
    const getFieldGroups = (
      properties: ObjectFieldTemplatePropertyType[]
    ): FieldGroup[] => {
      const groups: FieldGroup[] = [];

      // Basic Configuration Group
      const basicFields = properties.filter((prop) =>
        ['clientType', 'clientId', 'callbackUrl'].includes(prop.name)
      );
      if (basicFields.length > 0) {
        groups.push({
          title: 'Basic Configuration',
          properties: basicFields,
          className: 'sso-field-group',
        });
      }

      // Token & Security Group
      const securityFields = properties.filter((prop) =>
        [
          'publicKeyUrls',
          'tokenValidationAlgorithm',
          'authority',
          'secret',
          'clientSecret',
          'secretKey',
        ].includes(prop.name)
      );
      if (securityFields.length > 0) {
        groups.push({
          title: 'Token & Security',
          properties: securityFields,
          className: 'sso-field-group',
        });
      }

      // User Management Group
      const userFields = properties.filter((prop) =>
        [
          'jwtPrincipalClaims',
          'principalDomain',
          'adminPrincipals',
          'enableSelfSignup',
        ].includes(prop.name)
      );
      if (userFields.length > 0) {
        groups.push({
          title: 'User Management',
          properties: userFields,
          className: 'sso-field-group',
        });
      }

      // Any remaining fields go into "Other Configuration"
      const groupedFieldNames = [
        ...basicFields,
        ...securityFields,
        ...userFields,
      ].map((p) => p.name);
      const otherFields = properties.filter(
        (prop) => !groupedFieldNames.includes(prop.name)
      );
      if (otherFields.length > 0) {
        groups.push({
          title: 'Other Configuration',
          properties: otherFields,
          className: 'sso-field-group',
        });
      }

      return groups;
    };

    const fieldGroups = getFieldGroups(updatedNormalProperties);

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

        {/* Render field groups */}
        {fieldGroups.map((group, groupIndex) => (
          <div className={group.className} key={`group-${groupIndex}`}>
            <div className="sso-field-group-title">{group.title}</div>
            <div className="sso-field-group-content">
              {group.properties.map((element, index) => (
                <div
                  className={classNames('property-wrapper', {
                    'additional-fields': schema.additionalProperties,
                  })}
                  key={`${element.content.key}-${index}`}>
                  {element.content}
                </div>
              ))}
            </div>
          </div>
        ))}

        {!isEmpty(advancedProperties) && (
          <div className="sso-field-group">
            <div className="sso-field-group-content">
              {advancedProperties.map((element, index) => (
                <div
                  className={classNames('property-wrapper', {
                    'additional-fields': schema.additionalProperties,
                  })}
                  key={`${element.content.key}-${index}`}>
                  {element.content}
                </div>
              ))}
            </div>
          </div>
        )}
      </Fragment>
    );

    return fieldElement;
  };
