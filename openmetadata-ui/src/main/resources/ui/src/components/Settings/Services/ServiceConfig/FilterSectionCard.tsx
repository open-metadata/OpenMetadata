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
import { FieldProps } from '@rjsf/utils';
import { ChevronDown, ChevronRight, Eye } from '@untitledui/icons';
import classNames from 'classnames';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import BooleanFieldTemplate from '../../../common/Form/JSONSchema/JSONSchemaTemplate/BooleanFieldTemplate';
import { ConditionChip, PreviewRuleChip } from './FilterConditionChip';
import { ConditionComposer } from './FilterConditionComposer';
import { OPERATOR_LABEL_KEYS } from './FiltersConfigForm.constants';
import {
  FilterCondition,
  FilterSection,
  FilterSectionState,
} from './FiltersConfigForm.types';
import {
  conditionKey,
  conditionToRegex,
  getRuleLabelKey,
  getScopeSummaryKey,
  getSummaryPill,
  removeConditionAtIndex,
} from './FiltersConfigForm.utils';

function RulePreview({
  filter,
  section,
}: Readonly<{
  filter: FilterSectionState;
  section: FilterSection;
}>) {
  const { t } = useTranslation();
  const includeCount = filter.restrict ? filter.includes.length : 0;
  const excludeCount = filter.excludes.length;

  return (
    <div className="tw:rounded-xl tw:border tw:border-secondary tw:bg-secondary tw:p-3.5">
      <div className="tw:mb-2.5 tw:flex tw:items-center tw:gap-2">
        <Eye className="tw:text-utility-brand-600" size={15} />
        <span className="tw:text-xs] tw:font-medium tw:text-primary">
          {t('label.preview')}
        </span>
      </div>
      <p className="tw:m-0 tw:font-normal tw:leading-5 tw:text-tertiary">
        {t(getScopeSummaryKey(filter), {
          entity: section.label.toLowerCase(),
          excludeCount,
          excludeRule: t(getRuleLabelKey(excludeCount)),
          includeCount,
          includeRule: t(getRuleLabelKey(includeCount)),
        })}
      </p>
      {includeCount > 0 && (
        <div className="tw:mt-3 tw:grid tw:gap-1.5">
          <span className="tw:text-xs tw:font-medium tw:text-secondary">
            {t('label.include-entity', {
              entity: t(getRuleLabelKey(includeCount)),
            })}
          </span>
          <div className="tw:flex tw:flex-wrap tw:gap-1.5">
            {filter.includes.map((condition, index) => (
              <PreviewRuleChip
                condition={condition}
                key={`${conditionKey(condition)}-${index}`}
                operatorLabel={t(OPERATOR_LABEL_KEYS[condition.op])}
                tone="include"
              />
            ))}
          </div>
        </div>
      )}
      {excludeCount > 0 && (
        <div className="tw:mt-3 tw:grid tw:gap-1.5">
          <span className="tw:text-xs tw:font-medium tw:text-secondary">
            {t('label.exclude-entity', {
              entity: t(getRuleLabelKey(excludeCount)),
            })}
          </span>
          <div className="tw:flex tw:flex-wrap tw:gap-1.5">
            {filter.excludes.map((condition, index) => (
              <PreviewRuleChip
                condition={condition}
                key={`${conditionKey(condition)}-${index}`}
                operatorLabel={t(OPERATOR_LABEL_KEYS[condition.op])}
                tone="exclude"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RegexDisclosure({
  filter,
}: Readonly<{
  filter: FilterSectionState;
}>) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const includes = filter.restrict ? filter.includes.map(conditionToRegex) : [];
  const excludes = filter.excludes.map(conditionToRegex);

  if (includes.length === 0 && excludes.length === 0) {
    return null;
  }

  return (
    <div className="tw:-mt-1.5">
      <Button
        className="tw:text-utility-brand-700"
        color="link-color"
        iconLeading={
          <ChevronRight
            className={classNames(
              'tw:transition-transform tw:duration-150',
              isOpen && 'tw:rotate-90'
            )}
            size={13}
          />
        }
        size="sm"
        type="button"
        onPress={() => setIsOpen((v) => !v)}>
        {isOpen
          ? t('label.hide-equivalent-regex')
          : t('label.show-equivalent-regex')}
      </Button>
      {isOpen && (
        <div className="tw:mt-2 tw:grid tw:gap-1.5 tw:rounded-[10px] tw:bg-gray-900 tw:p-3">
          {includes.map((regex) => (
            <code
              className="tw:font-mono tw:text-xs tw:font-medium tw:text-blue-300"
              key={`include-${regex}`}>
              {t('message.includes-regex-line', { regex })}
            </code>
          ))}
          {excludes.map((regex) => (
            <code
              className="tw:font-mono tw:text-xs tw:font-medium tw:text-red-300"
              key={`exclude-${regex}`}>
              {t('message.excludes-regex-line', { regex })}
            </code>
          ))}
        </div>
      )}
    </div>
  );
}

export function FilterSectionCard({
  filter,
  isOpen,
  onChange,
  onFocus,
  onToggle,
  section,
}: Readonly<{
  filter: FilterSectionState;
  isOpen: boolean;
  onChange: (filter: FilterSectionState) => void;
  onFocus: (fieldName: string) => void;
  onToggle: () => void;
  section: FilterSection;
}>) {
  const { t } = useTranslation();
  const Icon = section.icon;
  const summary = getSummaryPill(filter);
  const systemExcludeKeys = new Set(section.systemExcludes.map(conditionKey));
  const hasSystemExcludes = section.systemExcludes.length > 0;
  const hasSystemExcludesEnabled =
    hasSystemExcludes &&
    section.systemExcludes.every((systemExclude) =>
      filter.excludes.some(
        (condition) => conditionKey(condition) === conditionKey(systemExclude)
      )
    );

  const addCondition = (
    bucketName: 'excludes' | 'includes',
    condition: FilterCondition
  ) => {
    onChange({
      ...filter,
      [bucketName]: [...filter[bucketName], condition],
      restrict: bucketName === 'includes' ? true : filter.restrict,
    });
  };

  const toggleSystemExcludes = () => {
    if (!hasSystemExcludes) {
      return;
    }

    if (hasSystemExcludesEnabled) {
      onChange({
        ...filter,
        excludes: filter.excludes.filter(
          (condition) => !systemExcludeKeys.has(conditionKey(condition))
        ),
      });

      return;
    }

    const currentKeys = new Set(filter.excludes.map(conditionKey));

    onChange({
      ...filter,
      excludes: [
        ...filter.excludes,
        ...section.systemExcludes.filter(
          (condition) => !currentKeys.has(conditionKey(condition))
        ),
      ],
    });
  };

  return (
    <section
      className="tw:overflow-hidden tw:rounded-2xl tw:border tw:border-primary tw:bg-primary tw:shadow-xs"
      data-testid={`filter-section-${section.fieldName}`}>
      <button
        className={classNames(
          'tw:flex tw:w-full tw:items-center tw:gap-3 tw:border-0 tw:bg-primary tw:px-[18px] tw:py-4 tw:text-left tw:cursor-pointer',
          isOpen && 'tw:bg-secondary'
        )}
        type="button"
        onClick={() => {
          onFocus(section.fieldName);
          onToggle();
        }}>
        <span className="tw:grid tw:size-[34px] tw:shrink-0 tw:place-items-center tw:rounded-[9px] tw:bg-utility-brand-50 tw:text-utility-brand-600">
          <Icon size={18} />
        </span>
        <span className="tw:text-sm tw:font-medium tw:leading-6 tw:text-primary">
          {section.label}
        </span>
        <span
          className={classNames(
            'tw:inline-flex tw:items-center tw:gap-[5px] tw:rounded-full tw:border tw:px-2.5 tw:py-0.5 tw:text-xs tw:font-medium',
            summary.tone === 'success'
              ? 'tw:border-utility-success-200 tw:bg-utility-success-50 tw:text-utility-success-700'
              : 'tw:border-utility-brand-200 tw:bg-utility-brand-50 tw:text-utility-brand-700'
          )}>
          <span className="tw:size-1.5 tw:rounded-full tw:bg-current" />
          {t(summary.textKey, summary.values)}
        </span>
        <ChevronDown
          className={classNames(
            'tw:ml-auto tw:shrink-0 tw:text-quaternary tw:transition-transform tw:duration-150',
            isOpen && 'tw:rotate-180'
          )}
          size={18}
        />
      </button>

      {isOpen && (
        <div className="tw:grid tw:gap-[18px] tw:border-t tw:border-secondary tw:p-[18px]">
          <div>
            <div className="tw:mb-2 tw:text-xs tw:font-medium tw:text-secondary">
              {t('label.what-to-scan')}
            </div>
            <div className="tw:grid tw:grid-cols-2 tw:gap-1 tw:rounded-[10px] tw:border tw:border-primary tw:bg-secondary tw:p-1">
              <button
                className={classNames(
                  'tw:flex tw:min-h-10 tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-[7px] tw:border tw:px-3 tw:py-2 tw:text-center tw:text-sm tw:leading-5 tw:transition-colors',
                  filter.restrict
                    ? 'tw:border-transparent tw:font-medium tw:text-tertiary'
                    : 'tw:border-primary tw:bg-primary tw:font-medium tw:text-primary tw:shadow-xs'
                )}
                data-testid={`${section.fieldName}-scan-all-button`}
                type="button"
                onClick={() =>
                  onChange({ ...filter, includes: [], restrict: false })
                }>
                {t('label.scan-all-entity', {
                  entity: section.label.toLowerCase(),
                })}
              </button>
              <button
                className={classNames(
                  'tw:flex tw:min-h-10 tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-[7px] tw:border tw:px-3 tw:py-2 tw:text-center tw:text-sm tw:leading-5 tw:transition-colors',
                  filter.restrict
                    ? 'tw:border-primary tw:bg-primary tw:font-medium tw:text-primary tw:shadow-xs'
                    : 'tw:border-transparent tw:font-medium tw:text-tertiary'
                )}
                data-testid={`${section.fieldName}-only-specific-button`}
                type="button"
                onClick={() => onChange({ ...filter, restrict: true })}>
                {t('label.only-specific-entity', {
                  entity: section.label.toLowerCase(),
                })}
              </button>
            </div>
          </div>

          {filter.restrict && (
            <div>
              <div className="tw:mb-2 tw:text-xs tw:font-medium tw:text-utility-brand-700">
                {t('message.include-only-entities-where-name', {
                  entity: section.label.toLowerCase(),
                })}
              </div>
              {filter.includes.length > 0 && (
                <div className="tw:mb-2.5 tw:flex tw:flex-wrap tw:gap-1.5">
                  {filter.includes.map((condition, index) => (
                    <ConditionChip
                      condition={condition}
                      key={`${conditionKey(condition)}-${index}`}
                      operatorLabel={t(OPERATOR_LABEL_KEYS[condition.op])}
                      removeLabel={t('label.remove')}
                      tone="include"
                      onRemove={() =>
                        onChange({
                          ...filter,
                          includes: removeConditionAtIndex(
                            filter.includes,
                            index
                          ),
                        })
                      }
                    />
                  ))}
                </div>
              )}
              <ConditionComposer
                defaultOperator="contains"
                fieldName={section.fieldName}
                placeholder={t('message.example-value', {
                  value: t('message.entity-name-example', {
                    entity: section.singleLabel.toLowerCase(),
                  }),
                })}
                onAdd={(condition) => addCondition('includes', condition)}
                onFocus={onFocus}
              />
            </div>
          )}

          <div className="tw:border-t tw:border-dashed tw:border-primary tw:pt-1">
            <div className="tw:my-3.5 tw:mb-2 tw:flex tw:flex-col tw:gap-2 tw:relative">
              {hasSystemExcludes && (
                <BooleanFieldTemplate
                  {...({
                    formData: !hasSystemExcludesEnabled,
                    idSchema: {
                      $id: `${section.fieldName}-exclude-system-filters`,
                    },
                    name: `${section.fieldName}-exclude-system-filters`,
                    schema: {
                      description: t(
                        'message.exclude-system-entity-description',
                        { entity: section.label.toLowerCase() }
                      ),
                      title: t('label.exclude-system-entity', {
                        entity: section.label.toLowerCase(),
                      }),
                    },
                    onChange: toggleSystemExcludes,
                  } as unknown as FieldProps)}
                />
              )}
              <span className="tw:text-xs tw:font-medium tw:text-utility-error-700">
                {t('label.always-exclude')}
              </span>
            </div>

            {filter.excludes.length > 0 && (
              <div className="tw:mb-2.5 tw:flex tw:flex-wrap tw:gap-1.5">
                {filter.excludes.map((condition, index) => (
                  <ConditionChip
                    condition={condition}
                    key={`${conditionKey(condition)}-${index}`}
                    operatorLabel={t(OPERATOR_LABEL_KEYS[condition.op])}
                    removeLabel={t('label.remove')}
                    tone="exclude"
                    onRemove={() =>
                      onChange({
                        ...filter,
                        excludes: removeConditionAtIndex(
                          filter.excludes,
                          index
                        ),
                      })
                    }
                  />
                ))}
              </div>
            )}

            <ConditionComposer
              defaultOperator="startsWith"
              fieldName={section.fieldName}
              placeholder={t('message.example-value', { value: 'TMP_' })}
              tone="exclude"
              onAdd={(condition) => addCondition('excludes', condition)}
              onFocus={onFocus}
            />
          </div>

          <RulePreview filter={filter} section={section} />
          <RegexDisclosure filter={filter} />
        </div>
      )}
    </section>
  );
}
