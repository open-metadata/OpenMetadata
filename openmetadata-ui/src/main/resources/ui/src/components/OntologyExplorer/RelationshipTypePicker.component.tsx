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

import { Button, ButtonUtility, Input } from '@openmetadata/ui-core-components';
import {
  ArrowRight,
  Plus,
  Search,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Category,
  RelationshipType,
} from '../../generated/entity/data/relationshipType';
import { listRelationshipTypes } from '../../rest/ontologyAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import {
  NEW_RELATION_TYPE_PREFIX,
  RELATION_PALETTE_SWATCH_CLASSES,
} from './RelationshipTypePicker.constants';
import {
  RelationshipTypePickerProps,
  RelationTypeOption,
  RelationTypeOptionGroup,
} from './RelationshipTypePicker.interface';

const SearchInputIcon = ({ className }: { className?: string }) => (
  <Search aria-hidden="true" className={className} />
);

const toOption = (
  type: RelationshipType,
  byName: ReadonlyMap<string, RelationshipType>
): RelationTypeOption => ({
  id: type.name,
  inverseLabel: type.inverse
    ? byName.get(type.inverse.name ?? '')?.displayName || type.inverse.name
    : undefined,
  label: type.displayName || type.name,
  paletteKey: type.paletteKey,
});

const renderGroup = (
  group: RelationTypeOptionGroup,
  onSelect: (relationType: string) => void,
  inverseLabel: string
) =>
  group.options.length === 0 ? null : (
    <div
      className="tw:flex tw:flex-col"
      data-testid={`group-${group.id}`}
      key={group.id}>
      <span className="tw:px-2 tw:py-2 tw:font-body tw:text-xs tw:font-semibold tw:tracking-wide tw:text-tertiary tw:uppercase">
        {group.title}
      </span>
      {group.options.map((option) => (
        <Button
          noTextPadding
          className={classNames(
            'tw:flex tw:w-full tw:items-center tw:gap-2 tw:rounded-lg tw:border-0 tw:bg-primary tw:p-2 tw:text-left hover:tw:bg-primary_hover',
            'tw:*:data-text:flex tw:*:data-text:w-full tw:*:data-text:items-center tw:*:data-text:gap-2'
          )}
          color="tertiary"
          data-testid={`relation-type-${option.id}`}
          key={option.id}
          onClick={() => onSelect(option.id)}>
          <span
            className={classNames(
              'tw:size-2.5 tw:shrink-0 tw:rounded-sm',
              RELATION_PALETTE_SWATCH_CLASSES[option.paletteKey]
            )}
          />
          <span className="tw:min-w-0 tw:flex-1 tw:truncate tw:font-body tw:text-xs tw:font-medium tw:text-primary">
            {option.label}
          </span>
          {option.inverseLabel ? (
            <span className="tw:max-w-28 tw:truncate tw:font-body tw:text-xs tw:font-normal tw:text-tertiary">
              {inverseLabel}: {option.inverseLabel}
            </span>
          ) : null}
        </Button>
      ))}
    </div>
  );

const RelationshipTypePicker: React.FC<RelationshipTypePickerProps> = ({
  onSelect,
  onCancel,
  className,
  sourceLabel,
  targetLabel,
  groups,
  canCreateType = false,
}) => {
  const { t } = useTranslation();
  const [relationTypes, setRelationTypes] = useState<RelationshipType[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(!groups);

  useEffect(() => {
    if (groups) {
      return undefined;
    }
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
  }, [groups]);

  const availableGroups = useMemo<RelationTypeOptionGroup[]>(() => {
    if (groups) {
      return groups;
    }
    const byName = new Map(relationTypes.map((type) => [type.name, type]));

    return [
      {
        id: 'system-defined',
        options: relationTypes
          .filter((type) => type.category !== Category.Custom)
          .map((type) => toOption(type, byName)),
        title: t('label.core-owl-skos'),
      },
      {
        id: 'custom',
        options: relationTypes
          .filter((type) => type.category === Category.Custom)
          .map((type) => toOption(type, byName)),
        title: t('label.custom-admin-defined'),
      },
    ];
  }, [groups, relationTypes, t]);

  const term = search.trim();
  const visibleGroups = useMemo(() => {
    const needle = term.toLowerCase();

    return availableGroups.map((group) => ({
      ...group,
      options: group.options.filter(
        (option) =>
          !needle ||
          option.label.toLowerCase().includes(needle) ||
          option.id.toLowerCase().includes(needle)
      ),
    }));
  }, [availableGroups, term]);

  const hasResults = visibleGroups.some((group) => group.options.length > 0);
  const canCreateFromSearch =
    canCreateType &&
    term.length > 0 &&
    !availableGroups.some((group) =>
      group.options.some(
        (option) => option.label.toLowerCase() === term.toLowerCase()
      )
    );

  const renderRelationTypeList = () => {
    if (isLoading) {
      return (
        <span className="tw:p-2 tw:font-body tw:text-xs tw:text-tertiary">
          {t('label.loading')}
        </span>
      );
    }

    return (
      <>
        {hasResults ? (
          visibleGroups.map((group) =>
            renderGroup(group, onSelect, t('label.inverse'))
          )
        ) : (
          <span
            className="tw:p-2 tw:font-body tw:text-xs tw:text-tertiary"
            data-testid="no-relation-types">
            {t('message.no-data-available')}
          </span>
        )}
        {canCreateFromSearch ? (
          <Button
            className="tw:mt-1 tw:justify-start"
            color="link-color"
            data-testid="relation-type-create"
            iconLeading={Plus}
            size="sm"
            onClick={() => onSelect(`${NEW_RELATION_TYPE_PREFIX}${term}`)}>
            {t('label.new-relationship-type-name', { name: term })}
          </Button>
        ) : null}
      </>
    );
  };

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
          <ButtonUtility
            className="tw:size-5 tw:shrink-0 tw:border-0 tw:bg-transparent tw:p-0 tw:text-fg-quaternary hover:tw:text-fg-secondary"
            data-testid="relation-type-cancel"
            icon={XClose}
            size="xs"
            tooltip={t('label.close')}
            onClick={onCancel}
          />
        ) : null}
      </div>

      <div className="tw:border-b tw:border-secondary tw:px-3 tw:py-2">
        <Input
          aria-label={t('label.filter-relationships')}
          icon={SearchInputIcon}
          inputClassName="tw:text-xs"
          inputDataTestId="relation-type-search"
          placeholder={t('label.filter-relationships')}
          size="sm"
          value={search}
          onChange={setSearch}
        />
      </div>

      <div className="tw:flex tw:max-h-64 tw:flex-col tw:overflow-auto tw:p-1.5">
        {renderRelationTypeList()}
      </div>
    </div>
  );
};

export default RelationshipTypePicker;
