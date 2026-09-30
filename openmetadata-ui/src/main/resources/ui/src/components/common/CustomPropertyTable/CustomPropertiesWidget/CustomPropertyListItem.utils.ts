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
import { TFunction } from 'i18next';
import { isArray, isPlainObject, toNumber } from 'lodash';
import {
  HYPERLINK_TYPE_CUSTOM_PROPERTY,
  TABLE_TYPE_CUSTOM_PROPERTY,
} from '../../../../constants/CustomProperty.constants';
import { EntityReference } from '../../../../generated/entity/type';
import { getTextFromHtmlString } from '../../../../utils/BlockEditorPureUtils';
import { formatDateTime } from '../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getPropertyItemCount } from '../CustomPropertyCard/CustomPropertyCard.utils';
import { formatDurationText } from '../CustomPropertyCard/renderers/TimeIntervalPropertyValue.utils';

const getReferenceNames = (value: unknown): string =>
  (isArray(value) ? value : [value])
    .filter(isPlainObject)
    .map((reference) => getEntityName(reference as EntityReference))
    .join(', ');

type SummaryFormatter = (
  value: unknown,
  t: TFunction,
  locale: string
) => string;

const SUMMARY_FORMATTERS: Record<string, SummaryFormatter> = {
  [TABLE_TYPE_CUSTOM_PROPERTY]: (value, t) =>
    t('label.count-row-plural', {
      count: getPropertyItemCount(TABLE_TYPE_CUSTOM_PROPERTY, value) ?? 0,
    }),
  sqlQuery: (value, t) =>
    t('label.count-line-plural', { count: String(value).split('\n').length }),
  markdown: (value) => getTextFromHtmlString(String(value)),
  timeInterval: (value, _t, locale) => {
    const { start, end } = value as { start?: number; end?: number };

    return formatDurationText(toNumber(end) - toNumber(start), locale);
  },
  [HYPERLINK_TYPE_CUSTOM_PROPERTY]: (value) => {
    const { url, displayText } = value as {
      url?: string;
      displayText?: string;
    };

    return displayText || url || '';
  },
  entityReference: getReferenceNames,
  entityReferenceList: getReferenceNames,
  enum: (value) => (isArray(value) ? value.join(', ') : String(value)),
  timestamp: (value) => formatDateTime(toNumber(value)),
};

/**
 * One-line text for a property value, used where a full renderer does not
 * fit (the side-panel widget). Structured values collapse to a count or a
 * duration; the edit dialog shows them in full.
 */
export const getPropertyValueSummary = (
  typeName: string | undefined,
  value: unknown,
  t: TFunction,
  locale: string
): string => {
  const format = SUMMARY_FORMATTERS[typeName ?? ''];

  return format ? format(value, t, locale) : String(value);
};
