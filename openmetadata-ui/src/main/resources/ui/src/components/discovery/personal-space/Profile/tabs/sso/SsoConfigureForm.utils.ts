/*
 *  Copyright 2026 Collate.
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

import { orderProperties, RJSFSchema, UiSchema } from '@rjsf/utils';
import { omit } from 'lodash';
import { ADVANCED_PROPERTIES } from '../../../../../../constants/Services.constant';
import {
  SSO_AUTHENTICATION_FIELD_GROUPS,
  SSO_AUTHORIZER_FIELD_GROUPS,
} from '../../../../../../constants/SSO.constant';
import { FIELD_MAPPINGS } from '../../../../../SettingsSso/SSODocPanel/SSODocPanel.constants';

/**
 * The SSO docs are keyed by section id, and a few sections are named
 * differently from the schema field they explain (`secret` → `clientSecret`).
 * FormBuilderV1 looks docs up by field name, so add those aliases.
 */
export const getFieldDocsByName = (
  docsBySection: Record<string, string>
): Record<string, string> => ({
  ...docsBySection,
  ...Object.fromEntries(
    Object.entries(FIELD_MAPPINGS)
      .filter(([, section]) => docsBySection[section])
      .map(([fieldName, section]) => [fieldName, docsBySection[section]])
  ),
});

/**
 * The classic SSO uiSchema names two renderers only that page registers.
 * FormBuilderV1's own cover them: role names as tags (the field's default
 * array renderer) and the LDAP group → roles JSON as a textarea.
 */
const toCoreRenderer = (fieldUiSchema: UiSchema): UiSchema => {
  if (fieldUiSchema['ui:widget'] === 'LdapRoleMappingWidget') {
    return { ...fieldUiSchema, 'ui:widget': 'textarea' };
  }

  return fieldUiSchema['ui:field'] === 'RolesSelectField'
    ? omit(fieldUiSchema, 'ui:field')
    : fieldUiSchema;
};

const CARD_CLASS_NAME =
  'tw:flex tw:flex-col tw:gap-4 tw:rounded-[10px] tw:border tw:border-secondary tw:p-5';

/**
 * The cards each SSO section is split into, from the groups the classic
 * settings page uses. Fields in no group share one last card.
 */
const SECTION_CARDS: Record<string, string[][]> = {
  authenticationConfiguration: [
    SSO_AUTHENTICATION_FIELD_GROUPS.basic,
    SSO_AUTHENTICATION_FIELD_GROUPS.client,
    SSO_AUTHENTICATION_FIELD_GROUPS.authority,
    SSO_AUTHENTICATION_FIELD_GROUPS.security,
    SSO_AUTHENTICATION_FIELD_GROUPS.credentials,
    ...SSO_AUTHENTICATION_FIELD_GROUPS.providerConfigs.map((name) => [name]),
    SSO_AUTHENTICATION_FIELD_GROUPS.identity,
  ],
  authorizerConfiguration: [
    SSO_AUTHORIZER_FIELD_GROUPS.admin,
    SSO_AUTHORIZER_FIELD_GROUPS.domain,
    SSO_AUTHORIZER_FIELD_GROUPS.connection,
    SSO_AUTHORIZER_FIELD_GROUPS.deprecated,
  ],
};

/**
 * Lays a section out with FormBuilderV1's LayoutGridField, one card per
 * group. Fields the schema drops or the uiSchema hides are left out so no
 * card renders empty; hidden fields stay mounted in a hidden row.
 */
const toCardLayout = (
  sectionSchema: RJSFSchema,
  sectionUiSchema: UiSchema,
  groups: string[][]
): UiSchema => {
  // The order RJSF itself would render the section in (schema order, then
  // any `ui:order`); each card keeps it, as the classic page does.
  const names = orderProperties(
    Object.keys(sectionSchema.properties ?? {}),
    sectionUiSchema['ui:order']
  );
  const isHidden = (name: string) =>
    (sectionUiSchema[name] as UiSchema | undefined)?.['ui:widget'] === 'hidden';
  const visibleGroups = groups
    .map((group) =>
      names.filter((name) => group.includes(name) && !isHidden(name))
    )
    .filter((group) => group.length > 0);
  const grouped = new Set(groups.flat());
  const rest = names.filter((name) => !grouped.has(name) && !isHidden(name));
  const toRow = (group: string[], className = CARD_CLASS_NAME) => ({
    className,
    columns: group.map((name) => ({ name })),
  });

  return {
    'ui:field': 'LayoutGridField',
    // LayoutGridField reads `rows` as row definitions; RJSF's own typing
    // reserves the name for a textarea's row count, hence the cast.
    'ui:options': {
      className: 'tw:flex tw:flex-col tw:gap-5',
      rows: [
        ...visibleGroups.map((group) => toRow(group)),
        ...(rest.length ? [toRow(rest)] : []),
        toRow(names.filter(isHidden), 'tw:hidden'),
      ],
    } as unknown as UiSchema['ui:options'],
  };
};

/**
 * Adapts the classic SSO uiSchema to FormBuilderV1: every field full width
 * (one column — the default three-column grid is built for full-page forms
 * and the SSO form is narrower), no description on nested objects (it only
 * restates their name), and core renderers in place of the classic ones.
 */
export const toCoreUiSchema = (
  schema: RJSFSchema,
  uiSchema: UiSchema = {}
): UiSchema =>
  Object.entries(schema.properties ?? {}).reduce<UiSchema>(
    (next, [name, property]) => {
      if (typeof property !== 'object') {
        return next;
      }
      const fieldUiSchema = toCoreRenderer((uiSchema[name] ?? {}) as UiSchema);
      const isObject = property.type === 'object';

      const nextUiSchema: UiSchema = {
        ...(isObject ? toCoreUiSchema(property, fieldUiSchema) : fieldUiSchema),
        ...(isObject && { 'ui:description': '' }),
        'ui:options': {
          ...fieldUiSchema['ui:options'],
          fullWidth: true,
          // Same fields the classic page collapses under "Advanced Config".
          ...(isObject && { advancedProperties: ADVANCED_PROPERTIES }),
        },
      };
      const cards = SECTION_CARDS[name];

      next[name] = cards
        ? {
            ...nextUiSchema,
            ...toCardLayout(property, nextUiSchema, cards),
          }
        : nextUiSchema;

      return next;
    },
    { ...uiSchema }
  );
