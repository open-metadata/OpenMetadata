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

import { RJSFSchema, UiSchema } from '@rjsf/utils';
import { omit } from 'lodash';
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

      next[name] = {
        ...(isObject ? toCoreUiSchema(property, fieldUiSchema) : fieldUiSchema),
        ...(isObject && { 'ui:description': '' }),
        'ui:options': { ...fieldUiSchema['ui:options'], fullWidth: true },
      };

      return next;
    },
    { ...uiSchema }
  );
