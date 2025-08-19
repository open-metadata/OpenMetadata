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
import './SSOGroupedFieldTemplate.less';

interface PropertyMap {
  advancedProperties: ObjectFieldTemplatePropertyType[];
  normalProperties: ObjectFieldTemplatePropertyType[];
}

interface FieldGroup {
  title?: string;
  properties: ObjectFieldTemplatePropertyType[];
  showDivider?: boolean;
}

export const SSOGroupedFieldTemplate: FunctionComponent<ObjectFieldTemplateProps> =
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

    // Apply grouping only to the main SSO configuration objects
    const isAuthConfigRoot =
      idSchema.$id === 'root/authenticationConfiguration';
    const isAuthorizerConfig = idSchema.$id === 'root/authorizerConfiguration';
    const isOIDCConfig =
      idSchema.$id === 'root/authenticationConfiguration/oidcConfiguration';
    const isLDAPConfig =
      idSchema.$id === 'root/authenticationConfiguration/ldapConfiguration';
    const isSAMLConfig =
      idSchema.$id === 'root/authenticationConfiguration/samlConfiguration';

    // Only apply special grouping to these specific main configuration objects
    const shouldApplyGrouping =
      isAuthConfigRoot ||
      isAuthorizerConfig ||
      isOIDCConfig ||
      isLDAPConfig ||
      isSAMLConfig;

    const filterVisibleProperties = (
      properties: ObjectFieldTemplatePropertyType[]
    ): ObjectFieldTemplatePropertyType[] => {
      return properties.filter((prop) => {
        const element = prop.content;

        // No element, nothing to render
        if (!element) {
          return false;
        }

        // If schema or UI schema marked this as hidden
        if (prop.hidden) {
          return false;
        }

        // If it's an <input type="hidden">
        if (
          element.type === 'input' &&
          element.props &&
          element.props.type === 'hidden'
        ) {
          return false;
        }

        // Explicit style-based hiding
        if (element.props?.style?.display === 'none' || element.props?.hidden) {
          return false;
        }

        return true;
      });
    };

    // Define field groups for SSO forms with logical grouping
    const getFieldGroups = (
      properties: ObjectFieldTemplatePropertyType[]
    ): FieldGroup[] => {
      // For non-main configuration objects, use default rendering without extra background
      if (!shouldApplyGrouping) {
        return [
          {
            properties: filterVisibleProperties(properties),
            showDivider: false,
          },
        ];
      }

      const groups: FieldGroup[] = [];
      const visibleProperties = filterVisibleProperties(properties);

      if (isAuthConfigRoot) {
        // Root authentication configuration grouping
        const basicConfigFields = visibleProperties.filter((prop) =>
          [
            'provider',
            'providerName',
            'clientType',
            'enableSelfSignup',
          ].includes(prop.name)
        );
        if (basicConfigFields.length > 0) {
          groups.push({
            title: 'Basic Configuration',
            properties: basicConfigFields,
            showDivider: false,
          });
        }

        const clientFields = visibleProperties.filter((prop) =>
          ['clientId', 'callbackUrl'].includes(prop.name)
        );
        if (clientFields.length > 0) {
          groups.push({
            title: 'Client Configuration',
            properties: clientFields,
            showDivider: false,
          });
        }

        const authorityFields = visibleProperties.filter((prop) =>
          ['authority', 'domain'].includes(prop.name)
        );
        if (authorityFields.length > 0) {
          groups.push({
            title: 'Authority Settings',
            properties: authorityFields,
            showDivider: false,
          });
        }

        const securityFields = visibleProperties.filter((prop) =>
          ['publicKeyUrls', 'tokenValidationAlgorithm'].includes(prop.name)
        );
        if (securityFields.length > 0) {
          groups.push({
            title: 'Security Configuration',
            properties: securityFields,
            showDivider: false,
          });
        }

        const credentialsFields = visibleProperties.filter((prop) =>
          ['secret', 'clientSecret'].includes(prop.name)
        );
        if (credentialsFields.length > 0) {
          groups.push({
            title: 'Credentials',
            properties: credentialsFields,
            showDivider: false,
          });
        }

        const configObjectFields = visibleProperties.filter((prop) =>
          [
            'oidcConfiguration',
            'ldapConfiguration',
            'samlConfiguration',
          ].includes(prop.name)
        );
        configObjectFields.forEach((field) => {
          groups.push({
            properties: [field],
            showDivider: false,
          });
        });

        // Remaining fields
        const groupedFieldNames = [
          ...basicConfigFields,
          ...clientFields,
          ...authorityFields,
          ...securityFields,
          ...credentialsFields,
          ...configObjectFields,
        ].map((p) => p.name);
        const remainingFields = visibleProperties.filter(
          (prop) => !groupedFieldNames.includes(prop.name)
        );
        if (remainingFields.length > 0) {
          groups.push({
            title: 'Advanced Configuration',
            properties: remainingFields,
            showDivider: false,
          });
        }
      } else if (isAuthorizerConfig) {
        // Authorizer configuration grouping
        const principalFields = visibleProperties.filter((prop) =>
          [
            'adminPrincipals',
            'botPrincipals',
            'principalDomain',
            'enforcePrincipalDomain',
          ].includes(prop.name)
        );
        if (principalFields.length > 0) {
          groups.push({
            title: 'Principal Management',
            properties: principalFields,
            showDivider: false,
          });
        }

        const connectionFields = visibleProperties.filter((prop) =>
          [
            'enableSecureSocketConnection',
            'className',
            'containerRequestFilter',
          ].includes(prop.name)
        );
        if (connectionFields.length > 0) {
          groups.push({
            title: 'Connection Settings',
            properties: connectionFields,
            showDivider: false,
          });
        }

        // Remaining authorizer fields
        const groupedFieldNames = [...principalFields, ...connectionFields].map(
          (p) => p.name
        );
        const remainingFields = visibleProperties.filter(
          (prop) => !groupedFieldNames.includes(prop.name)
        );
        if (remainingFields.length > 0) {
          groups.push({
            properties: remainingFields,
            showDivider: false,
          });
        }
      } else if (isOIDCConfig) {
        // OIDC configuration - all fields in a single group with title
        groups.push({
          title: 'OIDC Configuration',
          properties: visibleProperties,
          showDivider: false,
        });
      } else if (isLDAPConfig) {
        // LDAP configuration - all fields in a single group without extra grouping
        groups.push({
          properties: visibleProperties,
          showDivider: false,
        });
      } else if (isSAMLConfig) {
        // SAML configuration - all fields in a single group without extra grouping
        groups.push({
          properties: visibleProperties,
          showDivider: false,
        });
      }

      // Filter out only completely empty groups
      return groups.filter(
        (group) => group.properties && group.properties.length > 0
      );
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
              key={`group-${groupIndex}`}>
              {/* Render properties */}
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
          );
        })}

        {!isEmpty(advancedProperties) && (
          <div
            className={classNames({
              'sso-field-group-box sso-field-group-spaced': shouldApplyGrouping,
              'default-object-field': !shouldApplyGrouping,
            })}>
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
        )}
      </Fragment>
    );

    return fieldElement;
  };
