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

import { ObjectFieldTemplatePropertyType } from '@rjsf/utils';
import { ADVANCED_PROPERTIES } from '../../../constants/Services.constant';
import { FieldGroup, PropertyMap } from './SSOGroupedFieldTemplate.interface';

export interface SSOFieldGroupingFlags {
  isAuthConfigRoot: boolean;
  isAuthorizerConfig: boolean;
  isOIDCConfig: boolean;
  isLDAPConfig: boolean;
  isSAMLConfig: boolean;
  shouldApplyGrouping: boolean;
}

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

const buildAuthConfigRootGroups = (
  visibleProperties: ObjectFieldTemplatePropertyType[]
): FieldGroup[] => {
  const groups: FieldGroup[] = [];

  // Root authentication configuration grouping
  const basicConfigFields = visibleProperties.filter((prop) =>
    ['provider', 'providerName'].includes(prop.name)
  );
  if (basicConfigFields.length > 0) {
    groups.push({
      title: 'Basic Configuration',
      properties: basicConfigFields,
      showDivider: false,
    });
  }

  const clientFields = visibleProperties.filter((prop) =>
    ['clientType', 'enableSelfSignup', 'clientId', 'callbackUrl'].includes(
      prop.name
    )
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
    ['oidcConfiguration', 'ldapConfiguration', 'samlConfiguration'].includes(
      prop.name
    )
  );
  configObjectFields.forEach((field) => {
    groups.push({
      properties: [field],
      showDivider: false,
    });
  });

  const identityFieldNames = [
    // Every provider honours these: LDAP maps them onto directory attributes (falling back to
    // mailAttributeName/displayName) and SAML reads them as assertion attribute names, so the
    // fields stay configurable for all of them.
    'emailClaim',
    'displayNameClaim',
    'jwtPrincipalClaims',
    'jwtPrincipalClaimsMapping',
    'jwtTeamClaimMapping',
  ];

  const identityFields = visibleProperties.filter((prop) =>
    identityFieldNames.includes(prop.name)
  );
  if (identityFields.length > 0) {
    groups.push({
      title: 'Identity Configuration',
      properties: identityFields,
      showDivider: false,
    });
  }

  // Remaining fields
  const groupedFieldNames = [
    ...basicConfigFields,
    ...clientFields,
    ...authorityFields,
    ...securityFields,
    ...credentialsFields,
    ...configObjectFields,
    ...identityFields,
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

  return groups;
};

const buildAuthorizerConfigGroups = (
  visibleProperties: ObjectFieldTemplatePropertyType[]
): FieldGroup[] => {
  const groups: FieldGroup[] = [];

  // Authorizer configuration grouping — new fields first, deprecated in separate group
  const adminFields = visibleProperties.filter((prop) =>
    ['adminEmails'].includes(prop.name)
  );
  if (adminFields.length > 0) {
    groups.push({
      title: 'Admin Management',
      properties: adminFields,
      showDivider: false,
    });
  }

  const domainFields = visibleProperties.filter((prop) =>
    ['allowedEmailDomains', 'botDomain'].includes(prop.name)
  );
  if (domainFields.length > 0) {
    groups.push({
      title: 'Domain Configuration',
      properties: domainFields,
      showDivider: false,
    });
  }

  const connectionFields = visibleProperties.filter((prop) =>
    [
      'enableSecureSocketConnection',
      'className',
      'containerRequestFilter',
      'useRolesFromProvider',
    ].includes(prop.name)
  );
  if (connectionFields.length > 0) {
    groups.push({
      title: 'Connection Settings',
      properties: connectionFields,
      showDivider: false,
    });
  }

  const deprecatedFields = visibleProperties.filter((prop) =>
    [
      'adminPrincipals',
      'principalDomain',
      'enforcePrincipalDomain',
      'allowedDomains',
      'botPrincipals',
    ].includes(prop.name)
  );
  if (deprecatedFields.length > 0) {
    groups.push({
      title: 'Legacy Configuration (Deprecated)',
      properties: deprecatedFields,
      showDivider: false,
    });
  }

  // Remaining authorizer fields
  const groupedFieldNames = [
    ...adminFields,
    ...domainFields,
    ...connectionFields,
    ...deprecatedFields,
  ].map((p) => p.name);
  const remainingFields = visibleProperties.filter(
    (prop) => !groupedFieldNames.includes(prop.name)
  );
  if (remainingFields.length > 0) {
    groups.push({
      properties: remainingFields,
      showDivider: false,
    });
  }

  return groups;
};

const buildOIDCConfigGroups = (
  visibleProperties: ObjectFieldTemplatePropertyType[]
): FieldGroup[] => [
  {
    title: 'OIDC Configuration',
    properties: visibleProperties,
    showDivider: false,
  },
];

const buildLdapSamlConfigGroups = (
  visibleProperties: ObjectFieldTemplatePropertyType[]
): FieldGroup[] => [
  {
    properties: visibleProperties,
    showDivider: false,
  },
];

// Define field groups for SSO forms with logical grouping
export const getFieldGroups = (
  properties: ObjectFieldTemplatePropertyType[],
  flags: SSOFieldGroupingFlags
): FieldGroup[] => {
  // For non-main configuration objects, use default rendering without extra background
  if (!flags.shouldApplyGrouping) {
    return [
      {
        properties: filterVisibleProperties(properties),
        showDivider: false,
      },
    ];
  }

  const visibleProperties = filterVisibleProperties(properties);
  let groups: FieldGroup[] = [];

  if (flags.isAuthConfigRoot) {
    groups = buildAuthConfigRootGroups(visibleProperties);
  } else if (flags.isAuthorizerConfig) {
    groups = buildAuthorizerConfigGroups(visibleProperties);
  } else if (flags.isOIDCConfig) {
    groups = buildOIDCConfigGroups(visibleProperties);
  } else if (flags.isLDAPConfig || flags.isSAMLConfig) {
    groups = buildLdapSamlConfigGroups(visibleProperties);
  }

  // Filter out only completely empty groups
  return groups.filter(
    (group) => group.properties && group.properties.length > 0
  );
};

/** Which of the SSO configuration objects an RJSF object id points at. */
export const getSsoGroupingFlags = (id: string): SSOFieldGroupingFlags => {
  const isAuthConfigRoot = id === 'root/authenticationConfiguration';
  const isAuthorizerConfig = id === 'root/authorizerConfiguration';
  const isOIDCConfig =
    id === 'root/authenticationConfiguration/oidcConfiguration';
  const isLDAPConfig =
    id === 'root/authenticationConfiguration/ldapConfiguration';
  const isSAMLConfig =
    id === 'root/authenticationConfiguration/samlConfiguration';

  return {
    isAuthConfigRoot,
    isAuthorizerConfig,
    isOIDCConfig,
    isLDAPConfig,
    isSAMLConfig,
    shouldApplyGrouping: [
      isAuthConfigRoot,
      isAuthorizerConfig,
      isOIDCConfig,
      isLDAPConfig,
      isSAMLConfig,
    ].some(Boolean),
  };
};

export const partitionAdvancedProperties = (
  properties: ObjectFieldTemplatePropertyType[]
): PropertyMap =>
  properties.reduce<PropertyMap>(
    (propertyMap, property) => {
      if (ADVANCED_PROPERTIES.includes(property.name)) {
        propertyMap.advancedProperties.push(property);
      } else {
        propertyMap.normalProperties.push(property);
      }

      return propertyMap;
    },
    { advancedProperties: [], normalProperties: [] }
  );
