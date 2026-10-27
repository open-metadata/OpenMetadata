/*
 *  Copyright 2023 Collate.
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

import type { FieldProp } from '@openmetadata/ui-core-components';
import { FieldTypes } from '@openmetadata/ui-core-components';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResourceType,
  RESOURCE_TYPE_LABEL_KEYS,
  RESOURCE_TYPE_VALUES,
  SOURCE_URL_PLACEHOLDERS,
} from '../../../../../../constants/Learning.constants';
import { getSafeHttpUrl } from '../../../../../../utils/StringUtils';
import { ResourceTypeIcon } from '../../../../../Learning/ResourceTypeIcon/ResourceTypeIcon';
import {
  CATEGORY_ITEMS,
  CONTEXT_ITEMS,
  DURATION_ITEMS,
  LearningResourceFormValues,
  STATUS_ITEMS,
} from './LearningResourceSettings.utils';

/** The learning-resource form fields, shared by the AI settings panel and the classic drawer. */
export const useLearningResourceFields = (
  isEditing: boolean,
  resourceType: LearningResourceFormValues['resourceType']
): FieldProp[] => {
  const { t } = useTranslation();

  const required = useCallback(
    (labelKey: string) => ({
      required: t('label.field-required', { field: t(labelKey) }),
    }),
    [t]
  );

  return useMemo(
    () => [
      {
        name: 'name',
        label: t('label.name'),
        type: FieldTypes.TEXT,
        required: true,
        placeholder: t('label.enter-entity', { entity: t('label.name') }),
        // The name identifies the resource and cannot change once created.
        props: { 'data-testid': 'name-input', isDisabled: isEditing },
        rules: required('label.name'),
      },
      {
        name: 'description',
        label: t('label.description'),
        type: FieldTypes.TEXTAREA,
        required: true,
        props: { 'data-testid': 'description-input' },
        rules: required('label.description'),
      },
      {
        name: 'resourceType',
        label: t('label.type'),
        type: FieldTypes.SELECT,
        required: true,
        placeholder: t('label.select-field', { field: t('label.type') }),
        props: {
          'data-testid': 'resource-type-select',
          items: RESOURCE_TYPE_VALUES.map((type) => ({
            id: type,
            label: t(RESOURCE_TYPE_LABEL_KEYS[type]),
            icon: <ResourceTypeIcon aria-hidden resourceType={type} />,
          })),
        },
        rules: required('label.type'),
      },
      {
        name: 'categories',
        label: t('label.category-plural'),
        type: FieldTypes.MULTI_SELECT,
        required: true,
        placeholder: t('label.select-type'),
        props: { 'data-testid': 'categories-select', items: CATEGORY_ITEMS },
        // RHF treats an empty array as missing, so `required` covers multi-selects.
        rules: required('label.category-plural'),
      },
      {
        name: 'contexts',
        label: t('label.context'),
        type: FieldTypes.MULTI_SELECT,
        required: true,
        placeholder: t('label.select-field', { field: t('label.context') }),
        props: { 'data-testid': 'contexts-select', items: CONTEXT_ITEMS },
        rules: required('label.context'),
      },
      {
        name: 'sourceUrl',
        label: t('label.source-url'),
        type: FieldTypes.TEXT,
        required: true,
        placeholder:
          SOURCE_URL_PLACEHOLDERS[
            (resourceType?.id as ResourceType) ?? ResourceType.Video
          ],
        props: { 'data-testid': 'source-url-input' },
        rules: {
          ...required('label.source-url'),
          // http(s) only: the player renders this URL in a frame or as a link,
          // where a javascript: or data: URL would run script.
          validate: (value: string) =>
            Boolean(getSafeHttpUrl(value)) || t('label.invalid-url'),
        },
      },
      {
        name: 'sourceProvider',
        label: t('label.source-provider'),
        type: FieldTypes.TEXT,
        placeholder: 'YouTube, Storylane, etc.',
        props: { 'data-testid': 'source-provider-input' },
      },
      {
        name: 'estimatedDuration',
        label: t('label.duration'),
        type: FieldTypes.SELECT,
        placeholder: t('label.select-duration'),
        props: { 'data-testid': 'duration-select', items: DURATION_ITEMS },
      },
      {
        name: 'status',
        label: t('label.status'),
        type: FieldTypes.SELECT,
        placeholder: t('label.select-status'),
        props: { 'data-testid': 'status-select', items: STATUS_ITEMS },
      },
    ],
    [isEditing, required, resourceType, t]
  );
};
