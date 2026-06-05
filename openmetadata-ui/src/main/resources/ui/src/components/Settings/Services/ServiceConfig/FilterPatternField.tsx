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
import { FieldProps } from '@rjsf/utils';
import { startCase } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ServiceConnectionFilterPatternFields } from '../../../../enums/ServiceConnection.enum';
import {
  FILTER_LABEL_KEYS,
  FILTER_SINGLE_LABEL_KEYS,
} from './FiltersConfigForm.constants';
import {
  FilterCondition,
  FilterPatternConfig,
  FilterSection,
  FilterSectionState,
} from './FiltersConfigForm.types';
import {
  buildPatternFromState,
  cleanSchemaTitle,
  getSectionIcon,
  parseRegexPattern,
  pluralizeFallback,
  singularizeFallback,
} from './FiltersConfigForm.utils';
import { FilterSectionCard } from './FilterSectionCard';

type FilterPatternFieldUiOptions = {
  defaultOpen?: boolean;
  systemExcludes?: string[];
};

function buildFilterSection(
  name: string,
  title: string | undefined,
  description: string | undefined,
  systemExcludes: FilterCondition[],
  t: (key: string) => string
): FilterSection {
  const field = name as ServiceConnectionFilterPatternFields;
  const labelKey = FILTER_LABEL_KEYS[field];
  const singleLabelKey = FILTER_SINGLE_LABEL_KEYS[field];
  const cleanedTitle = cleanSchemaTitle(title ?? '', name);
  const label = labelKey
    ? t(labelKey)
    : pluralizeFallback(cleanedTitle || startCase(name));
  const singleLabel = singleLabelKey
    ? t(singleLabelKey)
    : singularizeFallback(label);

  return {
    description,
    fieldName: name,
    icon: getSectionIcon(name),
    label,
    singleLabel,
    systemExcludes,
  };
}

function buildInitialState(
  formData: FilterPatternConfig | undefined
): FilterSectionState {
  const includes = (formData?.includes ?? []).map(parseRegexPattern);
  const excludes = (formData?.excludes ?? []).map(parseRegexPattern);

  return { excludes, includes, restrict: includes.length > 0 };
}

export function FilterPatternField({
  formData,
  name,
  schema,
  uiSchema,
  onChange,
  formContext,
}: FieldProps<FilterPatternConfig>) {
  const { t } = useTranslation();

  const uiOptions = (uiSchema?.['ui:options'] ??
    {}) as FilterPatternFieldUiOptions;

  const section = useMemo(() => {
    const systemExcludes = (uiOptions.systemExcludes ?? []).map(
      parseRegexPattern
    );

    return buildFilterSection(
      name,
      schema.title,
      schema.description,
      systemExcludes,
      t
    );
  }, [name, schema.title, schema.description, uiOptions.systemExcludes, t]);

  const [filter, setFilter] = useState<FilterSectionState>(() =>
    buildInitialState(formData)
  );

  const [isOpen, setIsOpen] = useState(uiOptions.defaultOpen ?? false);

  const handleFilterChange = (newFilter: FilterSectionState) => {
    setFilter(newFilter);
    const pattern = buildPatternFromState(newFilter);
    const isEmpty =
      pattern.includes.length === 0 && pattern.excludes.length === 0;
    onChange(isEmpty ? undefined : pattern);
  };

  return (
    <FilterSectionCard
      filter={filter}
      isOpen={isOpen}
      section={section}
      onChange={handleFilterChange}
      onFocus={formContext?.handleFocus ?? (() => {})}
      onToggle={() => setIsOpen((prev) => !prev)}
    />
  );
}
