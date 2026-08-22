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

import { ArrowRight, SearchMd, XClose } from '@untitledui/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Category,
  PaletteKey,
  RelationshipType,
} from '../../generated/entity/data/relationshipType';
import { listRelationshipTypes } from '../../rest/ontologyAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import { RelationshipTypePickerProps } from './RelationshipTypePicker.interface';

const PALETTE_CLASSES: Record<PaletteKey, string> = {
  [PaletteKey.Amber]: 'tw:bg-utility-warning-500',
  [PaletteKey.Blue]: 'tw:bg-utility-blue-500',
  [PaletteKey.Gray]: 'tw:bg-utility-gray-500',
  [PaletteKey.Green]: 'tw:bg-utility-success-500',
  [PaletteKey.Indigo]: 'tw:bg-utility-indigo-500',
  [PaletteKey.Pink]: 'tw:bg-utility-pink-500',
  [PaletteKey.Purple]: 'tw:bg-utility-purple-500',
  [PaletteKey.Rose]: 'tw:bg-error-solid',
  [PaletteKey.Teal]: 'tw:bg-utility-success-500',
  [PaletteKey.Violet]: 'tw:bg-utility-purple-500',
};

const renderGroup = (
  title: string,
  testId: string,
  types: RelationshipType[],
  onSelect: (relationType: string) => void,
  inverseLabel: string
) =>
  types.length === 0 ? null : (
    <div className="tw:flex tw:flex-col" data-testid={`group-${testId}`}>
      <span className="tw:px-2 tw:py-2 tw:font-body tw:text-xs tw:font-semibold tw:tracking-wide tw:text-tertiary tw:uppercase">
        {title}
      </span>
      {types.map((type) => (
        <button
          className="tw:flex tw:w-full tw:items-center tw:gap-2 tw:rounded-lg tw:border-0 tw:bg-primary tw:p-2 tw:text-left hover:tw:bg-primary_hover"
          data-testid={`relation-type-${type.name}`}
          key={type.name}
          type="button"
          onClick={() => onSelect(type.name)}>
          <span
            className={classNames(
              'tw:size-2.5 tw:shrink-0 tw:rounded-sm',
              PALETTE_CLASSES[type.paletteKey]
            )}
          />
          <span className="tw:min-w-0 tw:flex-1 tw:truncate tw:font-body tw:text-xs tw:font-medium tw:text-primary">
            {type.displayName || type.name}
          </span>
          {type.inverse?.name ? (
            <span className="tw:max-w-28 tw:truncate tw:font-body tw:text-xs tw:font-normal tw:text-tertiary">
              {inverseLabel}: {type.inverse.name}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );

const RelationshipTypePicker: React.FC<RelationshipTypePickerProps> = ({
  onSelect,
  onCancel,
  className,
  sourceLabel,
  targetLabel,
}) => {
  const { t } = useTranslation();
  const [relationTypes, setRelationTypes] = useState<RelationshipType[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await listRelationshipTypes({ limit: 1000 });
        if (active) {
          setRelationTypes(response.data);
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    load();

    return () => {
      active = false;
    };
  }, []);

  const { systemTypes, customTypes } = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matches = relationTypes.filter(
      (type) =>
        !term ||
        (type.displayName || type.name).toLowerCase().includes(term) ||
        type.name.toLowerCase().includes(term)
    );

    return {
      systemTypes: matches.filter((type) => type.category !== Category.Custom),
      customTypes: matches.filter((type) => type.category === Category.Custom),
    };
  }, [relationTypes, search]);

  const hasResults = systemTypes.length > 0 || customTypes.length > 0;

  return (
    <div
      className={classNames(
        'tw:flex tw:w-64 tw:flex-col tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary tw:bg-primary',
        'tw:shadow-xl',
        className
      )}
      data-testid="relationship-type-picker">
      <div className="tw:flex tw:items-center tw:gap-1.5 tw:border-b tw:border-secondary tw:bg-secondary tw:px-3 tw:py-2.5">
        <span className="tw:max-w-20 tw:truncate tw:font-body tw:text-xs tw:font-semibold tw:text-primary">
          {sourceLabel}
        </span>
        <ArrowRight
          aria-hidden="true"
          className="tw:size-4 tw:shrink-0 tw:text-fg-brand-primary"
        />
        <span className="tw:max-w-20 tw:truncate tw:font-body tw:text-xs tw:font-semibold tw:text-primary">
          {targetLabel}
        </span>
        <span className="tw:flex-1" />
        {onCancel ? (
          <button
            aria-label={t('label.close')}
            className="tw:grid tw:size-5 tw:shrink-0 tw:place-items-center tw:border-0 tw:bg-transparent tw:text-fg-quaternary hover:tw:text-fg-secondary"
            data-testid="relation-type-cancel"
            type="button"
            onClick={onCancel}>
            <XClose aria-hidden="true" className="tw:size-4" />
          </button>
        ) : null}
      </div>

      <label className="tw:flex tw:items-center tw:gap-2 tw:border-b tw:border-secondary tw:px-3 tw:py-2">
        <SearchMd
          aria-hidden="true"
          className="tw:size-3.5 tw:shrink-0 tw:text-fg-tertiary"
        />
        <input
          autoFocus
          className={classNames(
            'tw:min-w-0 tw:flex-1 tw:border-0 tw:bg-transparent tw:p-0 tw:font-body',
            'tw:text-xs tw:font-normal tw:text-primary tw:outline-none tw:placeholder:text-placeholder'
          )}
          data-testid="relation-type-search"
          placeholder={t('label.filter-relationships')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      <div className="tw:flex tw:max-h-64 tw:flex-col tw:overflow-auto tw:p-1.5">
        {isLoading ? (
          <span className="tw:p-2 tw:font-body tw:text-xs tw:text-tertiary">
            {t('label.loading')}
          </span>
        ) : hasResults ? (
          <>
            {renderGroup(
              t('label.core-owl-skos'),
              'system-defined',
              systemTypes,
              onSelect,
              t('label.inverse')
            )}
            {renderGroup(
              t('label.custom-admin-defined'),
              'custom',
              customTypes,
              onSelect,
              t('label.inverse')
            )}
          </>
        ) : (
          <span
            className="tw:p-2 tw:font-body tw:text-xs tw:text-tertiary"
            data-testid="no-relation-types">
            {t('message.no-data-available')}
          </span>
        )}
      </div>
    </div>
  );
};

export default RelationshipTypePicker;
