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

import { Button, Typography } from '@openmetadata/ui-core-components';
import { Input } from 'antd';
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
  types: GlossaryTermRelationType[],
  onSelect: (relationType: string) => void
) =>
  types.length === 0 ? null : (
    <div
      className="tw:flex tw:flex-col tw:gap-1"
      data-testid={`group-${title}`}>
      <Typography
        as="span"
        className="tw:px-2 tw:text-quaternary"
        size="text-xs"
        weight="semibold">
        {title}
      </Typography>
      {types.map((type) => (
        <Button
          className="tw:justify-start"
          color="tertiary"
          data-testid={`relation-type-${type.name}`}
          key={type.name}
          size="sm"
          onClick={() => onSelect(type.name)}>
          <span className="tw:flex tw:items-center tw:gap-2">
            <span
              className="tw:inline-block tw:h-2 tw:w-2 tw:rounded-full"
              style={{
                backgroundColor: type.color ?? 'var(--color-fg-quaternary)',
              }}
            />
            <span>{type.displayName || type.name}</span>
            {type.inverseRelation ? (
              <span className="tw:text-quaternary">
                ↔ {type.inverseRelation}
              </span>
            ) : null}
          </span>
        </Button>
      ))}
    </div>
  );

const RelationshipTypePicker: React.FC<RelationshipTypePickerProps> = ({
  onSelect,
  onCancel,
  className,
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
        'tw:flex tw:w-64 tw:flex-col tw:gap-2 tw:rounded-md tw:border tw:border-utility-gray-200 tw:bg-primary tw:p-2 tw:shadow-lg',
        className
      )}
      data-testid="relationship-type-picker">
      <Input
        allowClear
        autoFocus
        data-testid="relation-type-search"
        placeholder={t('label.search')}
        size="small"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="tw:flex tw:max-h-64 tw:flex-col tw:gap-2 tw:overflow-auto">
        {isLoading ? (
          <Typography as="p" className="tw:p-2 tw:text-tertiary" size="text-xs">
            {t('label.loading')}
          </Typography>
        ) : hasResults ? (
          <>
            {renderGroup(t('label.system-defined'), systemTypes, onSelect)}
            {renderGroup(t('label.custom'), customTypes, onSelect)}
          </>
        ) : (
          <Typography
            as="p"
            className="tw:p-2 tw:text-tertiary"
            data-testid="no-relation-types"
            size="text-xs">
            {t('message.no-data-available')}
          </Typography>
        )}
      </div>

      {onCancel ? (
        <Button
          color="tertiary"
          data-testid="relation-type-cancel"
          size="sm"
          onClick={onCancel}>
          {t('label.cancel')}
        </Button>
      ) : null}
    </div>
  );
};

export default RelationshipTypePicker;
