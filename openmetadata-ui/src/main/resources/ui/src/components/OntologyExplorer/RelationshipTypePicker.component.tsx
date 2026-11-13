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

import {
  Button,
  ButtonUtility,
  Input,
  Tooltip,
} from '@openmetadata/ui-core-components';
import {
  AlertCircle,
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
import { useIsAiMode } from '../../hooks/useAppMode';
import { listRelationshipTypes } from '../../rest/ontologyAPI';
import { splitUnfitRelationOptions } from '../../utils/governance/ontology/OntologyNativeRelation.utils';
import { showErrorToast } from '../../utils/ToastUtils';
import Loader from '../common/Loader/Loader';
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

/** The registry stores an inverse as `{ id, fullyQualifiedName }` with no `name` or `displayName`. */
const inverseLabelOf = (
  type: RelationshipType,
  byId: ReadonlyMap<string, RelationshipType>
): string | undefined => {
  if (!type.inverse) {
    return undefined;
  }
  const inverse = byId.get(type.inverse.id);

  return inverse
    ? inverse.displayName || inverse.name
    : type.inverse.fullyQualifiedName ?? type.inverse.name;
};

const toOption = (
  type: RelationshipType,
  byId: ReadonlyMap<string, RelationshipType>
): RelationTypeOption => ({
  id: type.name,
  inverseLabel: inverseLabelOf(type, byId),
  label: type.displayName || type.name,
  paletteKey: type.paletteKey,
});

/** The type's own gloss, unless it only repeats the label. */
const glossOf = (option: RelationTypeOption) =>
  option.description &&
  option.description.toLowerCase() !== option.label.toLowerCase()
    ? option.description
    : undefined;

const renderOption = (
  option: RelationTypeOption,
  onSelect: (relationType: string) => void,
  inverseLabel: string,
  isAiMode: boolean
) => {
  const gloss = glossOf(option);
  const scopeWarning = option.isUnfit ? option.scopeLabel : undefined;
  // The gloss and the scope warning truncate in the row; the tooltip carries their full text.
  const fullText = [gloss, scopeWarning].filter(Boolean).join(' · ');

  return (
    <Tooltip
      isDisabled={!fullText}
      key={option.id}
      placement="right"
      title={fullText}>
      <Button
        noTextPadding
        className={classNames(
          'tw:flex tw:w-full tw:items-center tw:gap-2 tw:rounded-lg tw:border-0 tw:bg-primary tw:p-2 tw:text-left hover:tw:bg-primary_hover',
          'tw:*:data-text:flex tw:*:data-text:w-full tw:*:data-text:items-center tw:*:data-text:gap-2'
        )}
        color="tertiary"
        data-testid={`relation-type-${option.id}`}
        onClick={() => onSelect(option.id)}>
        <span
          className={classNames(
            'tw:size-2.5 tw:shrink-0 tw:rounded-sm',
            RELATION_PALETTE_SWATCH_CLASSES[option.paletteKey]
          )}
        />
        <span className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:font-body">
          <span
            className={classNames(
              'tw:truncate tw:text-primary',
              isAiMode ? 'tw:text-sm' : 'tw:text-xs tw:font-medium'
            )}>
            {option.label}
          </span>
          {option.inverseLabel ? (
            <span className="tw:truncate tw:text-xs tw:font-normal tw:text-tertiary">
              {inverseLabel}: {option.inverseLabel}
            </span>
          ) : null}
          {scopeWarning ? (
            <span
              className="tw:flex tw:min-w-0 tw:items-center tw:gap-1 tw:text-xs tw:font-normal tw:text-warning-primary"
              data-testid={`relation-type-unfit-${option.id}`}>
              <AlertCircle
                aria-hidden="true"
                className="tw:size-3 tw:shrink-0"
              />
              <span className="tw:truncate">{scopeWarning}</span>
            </span>
          ) : null}
        </span>
        {gloss ? (
          <span
            className="tw:max-w-[45%] tw:min-w-0 tw:truncate tw:font-body tw:text-xs tw:font-normal tw:text-tertiary"
            data-testid={`relation-type-gloss-${option.id}`}>
            {gloss}
          </span>
        ) : null}
      </Button>
    </Tooltip>
  );
};

const renderGroup = (
  group: RelationTypeOptionGroup,
  onSelect: (relationType: string) => void,
  inverseLabel: string,
  isAiMode: boolean
) =>
  group.options.length === 0 ? null : (
    <div
      className="tw:flex tw:flex-col"
      data-testid={`group-${group.id}`}
      key={group.id}>
      <span className="tw:px-2 tw:pt-2 tw:pb-1 tw:font-body tw:text-xs tw:font-semibold tw:text-secondary">
        {group.title}
      </span>
      {group.options.map((option) =>
        renderOption(option, onSelect, inverseLabel, isAiMode)
      )}
    </div>
  );

interface RelationMessagesProps {
  issue?: string;
  warning?: { message: string };
  onContinue: () => void;
}

const RelationMessages = ({
  issue,
  warning,
  onContinue,
}: RelationMessagesProps) => {
  const { t } = useTranslation();

  return (
    <>
      {warning ? (
        <div
          className="tw:flex tw:flex-col tw:gap-2 tw:border-b tw:border-warning_subtle tw:bg-warning-primary tw:px-3 tw:py-2 tw:font-body tw:text-xs tw:text-warning-primary"
          data-testid="relation-clash-warning"
          role="alert">
          {warning.message}
          <Button
            color="secondary"
            data-testid="relation-clash-continue"
            size="xs"
            onPress={onContinue}>
            {t('label.add-anyway')}
          </Button>
        </div>
      ) : null}
      {issue ? (
        <div
          className="tw:border-b tw:border-error_subtle tw:bg-error-primary tw:px-3 tw:py-2 tw:font-body tw:text-xs tw:text-error-primary"
          data-testid="relation-check-message"
          role="alert">
          {issue}
        </div>
      ) : null}
    </>
  );
};

const RelationshipTypePicker: React.FC<RelationshipTypePickerProps> = ({
  onSelect,
  onCancel,
  className,
  sourceLabel,
  targetLabel,
  sourceId,
  targetId,
  groups,
  canCreateType = false,
  checkRelation,
  warnRelation,
}) => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  const [relationTypes, setRelationTypes] = useState<RelationshipType[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(!groups);
  const [issue, setIssue] = useState<string>();
  const [warning, setWarning] = useState<{ type: string; message: string }>();
  const select = (relationType: string) => {
    const found = checkRelation?.(relationType);
    setIssue(found);
    setWarning(undefined);
    if (found) {
      return;
    }
    if (!warnRelation) {
      onSelect(relationType);

      return;
    }
    void warnRelation(relationType).then((message) =>
      message
        ? setWarning({ message, type: relationType })
        : onSelect(relationType)
    );
  };

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
    const byId = new Map(relationTypes.map((type) => [type.id, type]));

    return [
      {
        id: 'system-defined',
        options: relationTypes
          .filter((type) => type.category !== Category.Custom)
          .map((type) => toOption(type, byId)),
        title: t('label.core-owl-skos'),
      },
      {
        id: 'custom',
        options: relationTypes
          .filter((type) => type.category === Category.Custom)
          .map((type) => toOption(type, byId)),
        title: t('label.custom-admin-defined'),
      },
    ];
  }, [groups, relationTypes, t]);

  const term = search.trim();
  const visibleGroups = useMemo(() => {
    const needle = term.toLowerCase();

    return splitUnfitRelationOptions(
      availableGroups,
      { sourceId, targetId },
      t('label.other-links-doesnt-fit')
    ).map((group) => ({
      ...group,
      options: group.options.filter(
        (option) =>
          !needle ||
          option.label.toLowerCase().includes(needle) ||
          option.id.toLowerCase().includes(needle)
      ),
    }));
  }, [availableGroups, sourceId, t, targetId, term]);

  const hasResults = visibleGroups.some((group) => group.options.length > 0);
  const renderRelationTypeList = () => {
    if (isLoading) {
      return (
        <span className="tw:p-2">
          <Loader size="x-small" />
        </span>
      );
    }

    return (
      <>
        {hasResults ? (
          visibleGroups.map((group) =>
            renderGroup(group, select, t('label.inverse'), isAiMode)
          )
        ) : (
          <span
            className="tw:p-2 tw:font-body tw:text-xs tw:text-tertiary"
            data-testid="no-relation-types">
            {t('message.no-data-available')}
          </span>
        )}
        {canCreateType ? (
          <Button
            className="tw:mt-1 tw:justify-start"
            color="link-color"
            data-testid="relation-type-create"
            iconLeading={Plus}
            size="sm"
            onClick={() => select(`${NEW_RELATION_TYPE_PREFIX}${term}`)}>
            {term
              ? t('label.new-relationship-type-name', { name: term })
              : t('label.new-link')}
            <span className="tw:ml-1 tw:font-normal tw:text-tertiary">
              {t('message.creates-a-property')}
            </span>
          </Button>
        ) : null}
      </>
    );
  };

  const labelClass = isAiMode
    ? 'tw:max-w-28 tw:truncate tw:font-body tw:text-sm tw:font-semibold tw:text-primary'
    : 'tw:max-w-20 tw:truncate tw:font-body tw:text-xs tw:font-semibold tw:text-primary';

  return (
    <div
      className={classNames(
        isAiMode
          ? 'tw:flex tw:w-75 tw:flex-col tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary tw:bg-primary'
          : 'tw:flex tw:w-64 tw:flex-col tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary tw:bg-primary',
        'tw:shadow-xl',
        className
      )}
      data-testid="relationship-type-picker">
      <div
        className={
          isAiMode
            ? 'tw:flex tw:items-center tw:gap-2 tw:border-b tw:border-secondary tw:bg-secondary_alt tw:py-3 tw:pr-2.5 tw:pl-4'
            : 'tw:flex tw:items-center tw:gap-1.5 tw:border-b tw:border-secondary tw:bg-secondary tw:px-3 tw:py-2.5'
        }>
        <span className={labelClass}>{sourceLabel}</span>
        <ArrowRight
          aria-hidden="true"
          className="tw:size-4 tw:shrink-0 tw:text-fg-brand-primary"
        />
        <span className={labelClass}>{targetLabel}</span>
        <span className="tw:flex-1" />
        {onCancel ? (
          <ButtonUtility
            className="tw:shrink-0"
            data-testid="relation-type-cancel"
            icon={XClose}
            size="lg"
            tooltip={t('label.close')}
            onClick={onCancel}
          />
        ) : null}
      </div>

      <div className="tw:border-b tw:border-secondary tw:px-3 tw:py-2">
        <Input
          aria-label={t('label.filter-relationships')}
          autoComplete="off"
          icon={SearchInputIcon}
          inputClassName={isAiMode ? undefined : 'tw:text-xs'}
          inputDataTestId="relation-type-search"
          placeholder={t('label.filter-relationships')}
          size="sm"
          value={search}
          onChange={setSearch}
        />
      </div>

      <RelationMessages
        issue={issue}
        warning={warning}
        onContinue={() => warning && onSelect(warning.type)}
      />

      <div
        className={
          isAiMode
            ? 'tw:flex tw:max-h-75 tw:flex-col tw:overflow-auto tw:px-1.5 tw:pt-1 tw:pb-2'
            : 'tw:flex tw:max-h-64 tw:flex-col tw:overflow-auto tw:p-1.5'
        }>
        {renderRelationTypeList()}
      </div>
    </div>
  );
};

export default RelationshipTypePicker;
