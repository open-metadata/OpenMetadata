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
import { ObjectFieldTemplateProps } from '@rjsf/utils';
import { Button, Collapse, Space } from 'antd';
import classNames from 'classnames';
import { isEmpty, isUndefined } from 'lodash';
import { createElement, Fragment, FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { ADVANCED_PROPERTIES } from '../../../constants/Services.constant';
import serviceUtilClassBase from '../../../utils/ServiceUtilClassBase';
import './sso-grouped-field-template.less';
import { PropertyMap } from './SSOGroupedFieldTemplate.interface';
import { getFieldGroups } from './SSOGroupedFieldTemplate.utils';

export const SSOGroupedFieldTemplate: FunctionComponent<
  ObjectFieldTemplateProps
> = (props: ObjectFieldTemplateProps) => {
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

  // Apply grouping only to the main SSO configuration objects
  const isAuthConfigRoot = idSchema.$id === 'root/authenticationConfiguration';
  const isAuthorizerConfig = idSchema.$id === 'root/authorizerConfiguration';
  const isOIDCConfig =
    idSchema.$id === 'root/authenticationConfiguration/oidcConfiguration';
  const isLDAPConfig =
    idSchema.$id === 'root/authenticationConfiguration/ldapConfiguration';
  const isSAMLConfig =
    idSchema.$id === 'root/authenticationConfiguration/samlConfiguration';

  // Only apply special grouping to these specific main configuration objects
  const isAuthProviderConfig = isOIDCConfig || isLDAPConfig || isSAMLConfig;
  const shouldApplyGrouping =
    isAuthConfigRoot || isAuthorizerConfig || isAuthProviderConfig;

  const fieldGroups = getFieldGroups(updatedNormalProperties, {
    isAuthConfigRoot,
    isAuthorizerConfig,
    isOIDCConfig,
    isLDAPConfig,
    isSAMLConfig,
    shouldApplyGrouping,
  });

  const fieldElement = (
    <Fragment>
      {title && title.trim() !== '' && (
        <Space className="w-full justify-between header-title-wrapper">
          {/* eslint-disable-next-line jsx-a11y/label-has-for -- field-group title caption, not a form control */}
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
      )}

      {AdditionalField &&
        createElement(AdditionalField, {
          data: additionalFieldContent,
        })}

      {/* Render field groups */}
      {fieldGroups.map((group, groupIndex) => {
        // For LDAP and SAML, use special styling to keep background but avoid nesting
        const isLDAPOrSAMLGroup = isLDAPConfig || isSAMLConfig;
        const isOIDCSingleGroup = isOIDCConfig && fieldGroups.length === 1;

        return (
          <div
            className={classNames({
              // Use sso-field-group-box for main auth config groups with titles AND OIDC groups
              'sso-field-group-box':
                shouldApplyGrouping &&
                !isLDAPOrSAMLGroup &&
                (group.title || isOIDCConfig),
              'sso-field-group-spaced':
                shouldApplyGrouping &&
                groupIndex > 0 &&
                !isLDAPOrSAMLGroup &&
                !isOIDCSingleGroup,
              // Use special nested styling for LDAP/SAML (keeps background, removes border)
              'sso-field-group-box ldap-saml-group':
                shouldApplyGrouping && isLDAPOrSAMLGroup,
              // Default for non-grouped only
              'default-object-field': !shouldApplyGrouping,
            })}
            key={`group-${group.title}`}>
            {/* Render properties */}
            {group.properties.map((element) => (
              <div
                className={classNames('property-wrapper', {
                  'additional-fields': schema.additionalProperties,
                })}
                key={element.content.key}>
                {element.content}
              </div>
            ))}
          </div>
        );
      })}

      {!isEmpty(advancedProperties) && (
        <Collapse
          className={classNames('sso-advanced-properties-collapse', {
            'm-t-sm': shouldApplyGrouping,
          })}
          expandIconPosition="end">
          {/* Advanced fields must stay mounted: transformErrors discards any error whose
              field is absent from the DOM, so destroying the collapsed panel silently
              swallowed both client and server validation errors for fields like
              tokenValidity instead of surfacing them. */}
          <Collapse.Panel
            forceRender
            header={t('label.advanced-config')}
            key="1">
            <div
              className={classNames({
                'sso-field-group-box': shouldApplyGrouping,
                'default-object-field': !shouldApplyGrouping,
              })}>
              {advancedProperties.map((element) => (
                <div
                  className={classNames('property-wrapper', {
                    'additional-fields': schema.additionalProperties,
                  })}
                  key={element.content.key}>
                  {element.content}
                </div>
              ))}
            </div>
          </Collapse.Panel>
        </Collapse>
      )}
    </Fragment>
  );

  return fieldElement;
};
