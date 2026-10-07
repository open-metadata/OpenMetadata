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

import {
  Badge,
  BadgeWithButton,
  Box,
  Button,
  Typography,
} from '@openmetadata/ui-core-components';
import { FilterFunnel01 } from '@openmetadata/ui-core-components/icons';
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityFields } from '../../../enums/AdvancedSearch.enum';
import { getEntityNameLabel } from '../../../utils/EntityNameUtils';
import { getCanonicalEntityType } from '../../../utils/ExploreUtils';
import { translateWithNestedKeys } from '../../../utils/i18next/LocalUtil';
import {
  ExploreQueryFilterChipsProps,
  QueryFilterChip,
} from './ExploreQueryFilterChips.interface';

const ENTITY_TYPE_KEYS: ReadonlySet<string> = new Set([
  EntityFields.ENTITY_TYPE,
  EntityFields.ENTITY_TYPE_KEYWORD,
]);

const BADGE_CLASS = 'tw:gap-1.5';

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

  const hasFilterChips = !isEmpty(chips) || !isEmpty(browseFields);

  if (!hasFilterChips && !emptyText) {
    return null;
  }

  return (
    <Box
      align="center"
      className="explore-query-filter-chips tw:py-1.5 tw:pl-2"
      data-testid="explore-query-filter-chips"
      gap={2}
      wrap="wrap">
      <span className="text-grey-muted tw:inline-flex tw:items-center tw:gap-1.5 tw:text-xs tw:font-semibold tw:uppercase tw:tracking-[0.04em]">
        <FilterFunnel01 height={14} width={14} />
        {t('label.query')}
      </span>

      {!hasFilterChips && (
        <Typography
          className="tw:text-quaternary"
          data-testid="query-bar-empty-text"
          size="text-xs"
          weight="medium">
          {emptyText}
        </Typography>
      )}

      {browseFields.map((field) => {
        // A category root keeps its human title in `label`; deeper levels are
        // single-value picks whose value label is the location name.
        const isCategoryLevel = field.key === EntityFields.ENTITY_TYPE;
        const chipValue = isCategoryLevel
          ? field.label
          : (field.value ?? []).map((option) => option.label).join(', ');

        const content = (
          <>
            <span className="tw:font-normal">
              {browseLevelLabels[field.key] ?? field.key}
            </span>
            <span>{chipValue}</span>
          </>
        );
        const badgeProps = {
          className: BADGE_CLASS,
          color: 'brand',
          'data-testid': `browse-chip-${field.key}`,
          size: 'sm',
          type: 'color',
        } as const;

        return onRemoveBrowseLevel ? (
          <BadgeWithButton
            {...badgeProps}
            buttonLabel={t('label.remove')}
            buttonTestId={`remove-browse-chip-${field.key}`}
            key={field.key}
            onButtonClick={() => onRemoveBrowseLevel(field.key)}>
            {content}
          </BadgeWithButton>
        ) : (
          <Badge {...badgeProps} key={field.key}>
            {content}
          </Badge>
        );
      })}

      {chips.map(({ field, label, option }) => (
        <BadgeWithButton
          buttonLabel={t('label.remove')}
          buttonTestId={`remove-chip-${field.key}-${option.key}`}
          className={BADGE_CLASS}
          color="gray"
          data-testid={`query-chip-${field.key}-${option.key}`}
          key={`${field.key}-${option.key}`}
          size="sm"
          type="color"
          onButtonClick={() => onRemoveValue(field, option.key)}>
          <span className="tw:font-normal tw:text-tertiary">{label}</span>
          <span>{option.label}</span>
        </BadgeWithButton>
      ))}

      {hasFilterChips && onClearAll && (
        <Button
          className="text-primary tw:ml-auto tw:self-center tw:cursor-pointer tw:bg-transparent tw:p-0! tw:font-medium tw:shadow-none tw:after:outline-0 tw:hover:bg-transparent"
          color="tertiary"
          data-testid="clear-all-chips"
          size="sm"
          type="button"
          onClick={onClearAll}>
          {t('label.clear-entity', { entity: t('label.all') })}
        </Button>
      )}
    </Box>
  );
};

export default ExploreQueryFilterChips;
