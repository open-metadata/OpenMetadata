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

import { Button } from '@openmetadata/ui-core-components';
import { FilterFunnel01, XCircle, XClose } from '@untitledui/icons';
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityFields } from '../../../enums/AdvancedSearch.enum';
import { getEntityNameLabel } from '../../../utils/EntityNameUtils';
import { getCanonicalEntityType } from '../../../utils/ExploreUtils';
import { translateWithNestedKeys } from '../../../utils/i18next/LocalUtil';
import './explore-query-filter-chips.less';
import {
  ExploreQueryFilterChipsProps,
  QueryFilterChip,
} from './ExploreQueryFilterChips.interface';

const ENTITY_TYPE_KEYS: ReadonlySet<string> = new Set([
  EntityFields.ENTITY_TYPE,
  EntityFields.ENTITY_TYPE_KEYWORD,
]);

const ExploreQueryFilterChips = ({
  fields,
  browseFields = [],
  onRemoveValue,
  onRemoveBrowseLevel,
  onClearAll,
  emptyText,
}: ExploreQueryFilterChipsProps) => {
  const { t } = useTranslation();

  // The browse path is one chip per level — "In Databases / Service redshift
  // prod / Database dev / Schema dbt_jaffle".
  const browseLevelLabels: Record<string, string> = useMemo(
    () => ({
      [EntityFields.ENTITY_TYPE]: t('label.in'),
      [EntityFields.SERVICE_TYPE]: t('label.service-type'),
      [EntityFields.SERVICE]: t('label.service'),
      [EntityFields.DATABASE_DISPLAY_NAME]: t('label.database'),
      [EntityFields.DATABASE_SCHEMA_DISPLAY_NAME]: t('label.schema'),
    }),
    [t]
  );

  // The Type chip reads "Type Table" — the dropdown's own label and raw
  // bucket keys ("table", "tableColumn") are too technical for the query bar.
  const chips: QueryFilterChip[] = useMemo(
    () =>
      fields.flatMap((field) => {
        const isEntityTypeField = ENTITY_TYPE_KEYS.has(field.key);

        return (field.value ?? []).map((option) => ({
          field,
          label: isEntityTypeField
            ? t('label.type')
            : translateWithNestedKeys(field.label, field.labelKeyOptions),
          option: isEntityTypeField
            ? {
                ...option,
                label: getEntityNameLabel(getCanonicalEntityType(option.key)),
              }
            : option,
        }));
      }),
    [fields, t]
  );

  const hasActiveQuery = !isEmpty(chips) || !isEmpty(browseFields);

  if (!hasActiveQuery && !emptyText) {
    return null;
  }

  return (
    <div
      className="explore-query-filter-chips"
      data-testid="explore-query-filter-chips">
      <span className="explore-query-filter-chips__query-label">
        <FilterFunnel01 height={14} width={14} />
        {t('label.query')}
      </span>

      {!hasActiveQuery && (
        <span
          className="explore-query-filter-chips__empty"
          data-testid="query-bar-empty-text">
          {emptyText}
        </span>
      )}

      {browseFields.map((field) => {
        // A category root keeps its human title in `label`; deeper levels are
        // single-value picks whose value label is the location name.
        const isCategoryLevel = field.key === EntityFields.ENTITY_TYPE;
        const chipValue = isCategoryLevel
          ? field.label
          : (field.value ?? []).map((option) => option.label).join(', ');

        return (
          <span
            className="explore-query-filter-chips__chip explore-query-filter-chips__chip--browse"
            data-testid={`browse-chip-${field.key}`}
            key={`browse-${field.key}`}>
            <span className="explore-query-filter-chips__chip-label">
              {browseLevelLabels[field.key] ?? field.key}
            </span>
            <span className="explore-query-filter-chips__chip-value">
              {chipValue}
            </span>
            {onRemoveBrowseLevel && (
              <button
                aria-label={t('label.remove')}
                className="explore-query-filter-chips__remove"
                data-testid={`remove-browse-chip-${field.key}`}
                type="button"
                onClick={() => onRemoveBrowseLevel(field.key)}>
                <XClose height={12} width={12} />
              </button>
            )}
          </span>
        );
      })}

      {chips.map(({ field, label, option }) => (
        <span
          className="explore-query-filter-chips__chip"
          data-testid={`query-chip-${field.key}-${option.key}`}
          key={`${field.key}-${option.key}`}>
          <span className="explore-query-filter-chips__chip-label">
            {label}
          </span>
          <span className="explore-query-filter-chips__chip-value">
            {option.label}
          </span>
          <button
            aria-label={t('label.remove')}
            className="explore-query-filter-chips__remove"
            data-testid={`remove-chip-${field.key}-${option.key}`}
            type="button"
            onClick={() => onRemoveValue(field, option.key)}>
            <XClose height={12} width={12} />
          </button>
        </span>
      ))}

      {hasActiveQuery && onClearAll && (
        <Button
          className="tw:ml-auto"
          color="secondary"
          data-testid="clear-all-chips"
          iconLeading={XCircle}
          size="xs"
          type="button"
          onClick={onClearAll}>
          {t('label.clear')}
        </Button>
      )}
    </div>
  );
};

export default ExploreQueryFilterChips;
