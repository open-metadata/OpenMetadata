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
import { ADVANCED_PROPERTIES } from '../../../../../../constants/Services.constant';
import {
  SSO_AUTHENTICATION_FIELD_GROUPS,
  SSO_AUTHORIZER_FIELD_GROUPS,
} from '../../../../../../constants/SSO.constant';
import { t } from '../../../../../../utils/i18next/LocalUtil';
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

const CARD_CLASS_NAME =
  'tw:flex tw:flex-col tw:gap-4 tw:rounded-[10px] tw:border tw:border-secondary tw:bg-primary_alt tw:p-5';

interface SectionCard {
  title?: string;
  fields: string[];
}

const configurationTitle = (entityKey: string) =>
  t('label.entity-configuration', { entity: t(entityKey) });

/**
 * The cards each SSO section is split into, with the titles of the groups the
 * classic settings page uses. Fields in no group share a last card.
 */
const getSectionCards = (): Record<string, SectionCard[]> => ({
  authenticationConfiguration: [
    {
      title: t('label.basic-configuration'),
      fields: SSO_AUTHENTICATION_FIELD_GROUPS.basic,
    },
    {
      title: configurationTitle('label.client'),
      fields: SSO_AUTHENTICATION_FIELD_GROUPS.client,
    },
    {
      title: t('label.authority'),
      fields: SSO_AUTHENTICATION_FIELD_GROUPS.authority,
    },
    {
      title: configurationTitle('label.security'),
      fields: SSO_AUTHENTICATION_FIELD_GROUPS.security,
    },
    {
      title: t('label.credential-plural'),
      fields: SSO_AUTHENTICATION_FIELD_GROUPS.credentials,
    },
    // A provider object titles itself.
    ...SSO_AUTHENTICATION_FIELD_GROUPS.providerConfigs.map((name) => ({
      fields: [name],
    })),
    {
      title: configurationTitle('label.identity'),
      fields: SSO_AUTHENTICATION_FIELD_GROUPS.identity,
    },
  ],
  authorizerConfiguration: [
    {
      title: t('label.admin-plural'),
      fields: SSO_AUTHORIZER_FIELD_GROUPS.admin,
    },
    {
      title: configurationTitle('label.domain'),
      fields: SSO_AUTHORIZER_FIELD_GROUPS.domain,
    },
    {
      title: configurationTitle('label.connection'),
      fields: SSO_AUTHORIZER_FIELD_GROUPS.connection,
    },
    {
      title: t('label.deprecated'),
      fields: SSO_AUTHORIZER_FIELD_GROUPS.deprecated,
    },
  ],
});

/**
 * Lays a section out with FormBuilderV1's LayoutGridField, one card per
 * group in the group's own field order. Fields the schema drops or the
 * uiSchema hides are left out so no card renders empty; hidden fields stay
 * mounted in a hidden row.
 */
const toCardLayout = (
  sectionSchema: RJSFSchema,
  sectionUiSchema: UiSchema,
  cards: SectionCard[]
): UiSchema => {
  const names = orderProperties(
    Object.keys(sectionSchema.properties ?? {}),
    sectionUiSchema['ui:order']
  );
  const isHidden = (name: string) =>
    (sectionUiSchema[name] as UiSchema | undefined)?.['ui:widget'] === 'hidden';
  const isShown = (name: string) => names.includes(name) && !isHidden(name);
  const visibleCards = cards
    .map(({ title, fields }) => ({ title, fields: fields.filter(isShown) }))
    .filter(({ fields }) => fields.length > 0);
  const grouped = new Set(cards.flatMap(({ fields }) => fields));
  const rest = names.filter((name) => !grouped.has(name) && !isHidden(name));
  const toRow = (
    { title, fields }: SectionCard,
    className = CARD_CLASS_NAME
  ) => ({
    className,
    title,
    columns: fields.map((name) => ({ name })),
  });

  return {
    'ui:field': 'LayoutGridField',
    // LayoutGridField reads `rows` as row definitions; RJSF's own typing
    // reserves the name for a textarea's row count, hence the cast.
    'ui:options': {
      className: 'tw:flex tw:flex-col tw:gap-5',
      rows: [
        ...visibleCards.map((card) => toRow(card)),
        ...(rest.length
          ? [toRow({ title: t('label.advanced-configuration'), fields: rest })]
          : []),
        toRow({ fields: names.filter(isHidden) }, 'tw:hidden'),
      ],
    } as unknown as UiSchema['ui:options'],
  };
};

/**
 * Adapts the classic SSO uiSchema to FormBuilderV1: every field full width
 * (one column — the default three-column grid is built for full-page forms
 * and the SSO form is narrower) and no description on nested objects (it only
 * restates their name).
 */
export const toCoreUiSchema = (
  schema: RJSFSchema,
  uiSchema: UiSchema = {}
): UiSchema => {
  const sectionCards = getSectionCards();

  return Object.entries(schema.properties ?? {}).reduce<UiSchema>(
    (next, [name, property]) => {
      if (typeof property !== 'object') {
        return next;
      }
      const fieldUiSchema = (uiSchema[name] ?? {}) as UiSchema;
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
      const cards = sectionCards[name];

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
};
