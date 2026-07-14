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
import classNames from 'classnames';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getGlossaryTermRelationSettings } from '../../rest/glossaryAPI';
import {
  GlossaryTermRelationSettings,
  GlossaryTermRelationType,
} from '../../rest/settingConfigAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import { RelationshipTypePickerProps } from './RelationshipTypePicker.interface';

const renderGroup = (
  title: string,
  testId: string,
  types: GlossaryTermRelationType[],
  onSelect: (relationType: string) => void,
  inverseLabel: string
) =>
  types.length === 0 ? null : (
    <div className="tw:flex tw:flex-col" data-testid={`group-${testId}`}>
      <span className="tw:px-2 tw:pb-[5px] tw:pt-[9px] tw:font-body tw:text-[9px] tw:leading-[normal] tw:font-semibold tw:tracking-[0.05em] tw:text-gray-400 tw:uppercase">
        {title}
      </span>
      {types.map((type) => (
        <button
          className="tw:flex tw:w-full tw:items-center tw:gap-[9px] tw:rounded-[7px] tw:border-0 tw:bg-white tw:p-2 tw:text-left hover:tw:bg-gray-50"
          data-testid={`relation-type-${type.name}`}
          key={type.name}
          type="button"
          onClick={() => onSelect(type.name)}>
          <span
            className="tw:size-[9px] tw:shrink-0 tw:rounded-[3px]"
            style={{
              backgroundColor: type.color ?? '#717680',
            }}
          />
          <span className="tw:min-w-0 tw:flex-1 tw:truncate tw:font-body tw:text-xs tw:leading-[normal] tw:font-medium tw:text-gray-900">
            {type.displayName || type.name}
          </span>
          {type.inverseRelation ? (
            <span className="tw:max-w-[112px] tw:truncate tw:font-body tw:text-[10px] tw:leading-[normal] tw:font-normal tw:text-gray-400">
              {inverseLabel}: {type.inverseRelation}
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
  const [relationTypes, setRelationTypes] = useState<
    GlossaryTermRelationType[]
  >([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const settings =
          (await getGlossaryTermRelationSettings()) as GlossaryTermRelationSettings;
        if (active) {
          setRelationTypes(settings?.relationTypes ?? []);
        }
      } catch (error) {
        showErrorToast(error as Error);
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
      systemTypes: matches.filter((type) => type.isSystemDefined),
      customTypes: matches.filter((type) => !type.isSystemDefined),
    };
  }, [relationTypes, search]);

  const hasResults = systemTypes.length > 0 || customTypes.length > 0;

  return (
    <div
      className={classNames(
        'tw:flex tw:w-[268px] tw:flex-col tw:overflow-hidden tw:rounded-[12px] tw:border tw:border-gray-200 tw:bg-white',
        'tw:shadow-[0_16px_32px_-8px_rgba(10,13,18,0.26)]',
        className
      )}
      data-testid="relationship-type-picker">
      <div className="tw:flex tw:items-center tw:gap-1.5 tw:border-b tw:border-gray-blue-100 tw:bg-gray-50 tw:px-3 tw:py-[11px]">
        <span className="tw:max-w-[84px] tw:truncate tw:font-body tw:text-[11px] tw:leading-[normal] tw:font-semibold tw:text-gray-900">
          {sourceLabel}
        </span>
        <ArrowRight
          aria-hidden="true"
          className="tw:size-[15px] tw:shrink-0 tw:text-brand-600"
        />
        <span className="tw:max-w-[84px] tw:truncate tw:font-body tw:text-[11px] tw:leading-[normal] tw:font-semibold tw:text-gray-900">
          {targetLabel}
        </span>
        <span className="tw:flex-1" />
        {onCancel ? (
          <button
            aria-label={t('label.close')}
            className="tw:grid tw:size-5 tw:shrink-0 tw:place-items-center tw:border-0 tw:bg-transparent tw:text-gray-400 hover:tw:text-gray-600"
            data-testid="relation-type-cancel"
            type="button"
            onClick={onCancel}>
            <XClose aria-hidden="true" className="tw:size-[15px]" />
          </button>
        ) : null}
      </div>

      <label className="tw:flex tw:items-center tw:gap-[7px] tw:border-b tw:border-gray-blue-100 tw:px-3 tw:py-2">
        <SearchMd
          aria-hidden="true"
          className="tw:size-[13px] tw:shrink-0 tw:text-gray-500"
        />
        <input
          autoFocus
          className={classNames(
            'tw:min-w-0 tw:flex-1 tw:border-0 tw:bg-transparent tw:p-0 tw:font-body',
            'tw:text-[11px] tw:leading-[normal] tw:font-normal tw:text-gray-900 tw:outline-none tw:placeholder:text-gray-400'
          )}
          data-testid="relation-type-search"
          placeholder={t('label.filter-relationships')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      <div className="tw:flex tw:max-h-[258px] tw:flex-col tw:overflow-auto tw:p-1.5">
        {isLoading ? (
          <span className="tw:p-2 tw:font-body tw:text-[11px] tw:leading-[normal] tw:text-gray-500">
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
            className="tw:p-2 tw:font-body tw:text-[11px] tw:leading-[normal] tw:text-gray-500"
            data-testid="no-relation-types">
            {t('message.no-data-available')}
          </span>
        )}
      </div>
    </div>
  );
};

export default RelationshipTypePicker;
