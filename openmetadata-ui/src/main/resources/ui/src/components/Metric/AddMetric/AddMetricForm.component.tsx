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
  Alert,
  Avatar,
  Box,
  FieldProp,
  FieldPropsMap,
  FieldTypes,
  getField,
  HookForm,
} from '@openmetadata/ui-core-components';
import { Users01 } from '@untitledui/icons';
import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZE_MEDIUM } from '../../../constants/constants';
import { ENTITY_NAME_REGEX } from '../../../constants/regex.constants';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import {
  Language,
  MetricGranularity,
  MetricType,
  UnitOfMeasurement,
} from '../../../generated/api/data/createMetric';
import type { EntityReference } from '../../../generated/entity/type';
import { searchQuery } from '../../../rest/searchAPI';
import { formatTeamsResponse } from '../../../utils/APIUtils';
import { getRandomColor } from '../../../utils/ColorUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getEntityReferenceListFromEntities } from '../../../utils/EntityReferenceUtils';
import { getMetricEnumLabel } from '../../../utils/MetricEntityUtils/MetricDisplayUtils';
import { getTermQuery } from '../../../utils/SearchPureUtils';
import {
  AddMetricFormProps,
  MetricFormSelectItem,
  MetricFormValues,
} from './AddMetricForm.interface';

export const METRIC_FORM_DEFAULTS: MetricFormValues = {
  name: '',
  displayName: '',
  description: '',
  metricType: null,
  granularity: null,
  unitOfMeasurement: null,
  customUnitOfMeasurement: '',
  language: { id: Language.SQL, label: Language.SQL, value: Language.SQL },
  code: '',
  parentMetric: null,
  owners: [],
  reviewers: [],
  domains: [],
  relatedMetrics: [],
};

const mapEntityReferenceToOption = (
  reference: EntityReference
): MetricFormSelectItem => ({
  id: reference.id,
  label: getEntityName(reference),
  supportingText: reference.fullyQualifiedName || reference.type,
  value: reference,
});

const AddMetricForm = ({
  form,
  parentMetricFqn,
  onSubmit,
}: AddMetricFormProps) => {
  const { t } = useTranslation();
  const [userTeamOptions, setUserTeamOptions] = useState<
    MetricFormSelectItem[]
  >([]);
  const [domainOptions, setDomainOptions] = useState<MetricFormSelectItem[]>(
    []
  );
  const [relatedMetricOptions, setRelatedMetricOptions] = useState<
    MetricFormSelectItem[]
  >([]);
  const [parentMetricOptions, setParentMetricOptions] = useState<
    MetricFormSelectItem[]
  >([]);

  const selectedUnit = useWatch({
    control: form.control,
    name: 'unitOfMeasurement',
  });
  const isCustomUnit = selectedUnit?.value === UnitOfMeasurement.Other;

  const metricTypeOptions = useMemo<MetricFormSelectItem[]>(
    () =>
      Object.values(MetricType).map((value) => ({
        id: value,
        label: getMetricEnumLabel(t, value),
        value,
      })),
    [t]
  );

  const granularityOptions = useMemo<MetricFormSelectItem[]>(
    () =>
      Object.values(MetricGranularity).map((value) => ({
        id: value,
        label: getMetricEnumLabel(t, value),
        value,
      })),
    [t]
  );

  const unitOptions = useMemo<MetricFormSelectItem[]>(
    () =>
      Object.values(UnitOfMeasurement).map((value) => ({
        id: value,
        label: getMetricEnumLabel(t, value),
        value,
      })),
    [t]
  );

  const languageOptions = useMemo<MetricFormSelectItem[]>(
    () =>
      Object.values(Language).map((value) => ({
        id: value,
        label: getMetricEnumLabel(t, value),
        value,
      })),
    [t]
  );

  const fetchUserTeamOptions = useCallback(async (searchText = '') => {
    try {
      const [usersResponse, teamsResponse] = await Promise.all([
        searchQuery({
          pageNumber: 1,
          pageSize: PAGE_SIZE_MEDIUM,
          query: searchText,
          queryFilter: getTermQuery({ isBot: 'false' }),
          searchIndex: SearchIndex.USER,
          sortField: 'displayName.keyword',
          sortOrder: 'asc',
        }),
        searchQuery({
          pageNumber: 1,
          pageSize: PAGE_SIZE_MEDIUM,
          query: searchText,
          queryFilter: getTermQuery({}, 'must', undefined, {
            matchTerms: { teamType: 'Group' },
          }),
          searchIndex: SearchIndex.TEAM,
          sortField: 'displayName.keyword',
          sortOrder: 'asc',
        }),
      ]);

      const userOptions = usersResponse.hits.hits.map((hit) => {
        const source = hit._source;
        const name = getEntityName(source);
        const { color, backgroundColor, character } = getRandomColor(
          source.displayName ?? source.name ?? ''
        );

        return {
          id: source.id,
          label: name,
          supportingText: source.fullyQualifiedName ?? EntityType.USER,
          icon: (
            <Avatar
              initials={character}
              size="xs"
              src={source.profile?.images?.image ?? undefined}
              style={{ color, backgroundColor }}
            />
          ),
          value: {
            id: source.id,
            type: EntityType.USER,
            name: source.name,
            displayName: source.displayName,
            fullyQualifiedName: source.fullyQualifiedName,
          },
        };
      });

      const teams = getEntityReferenceListFromEntities(
        formatTeamsResponse(teamsResponse.hits.hits),
        EntityType.TEAM
      );

      setUserTeamOptions([
        ...userOptions,
        ...teams.map((reference) => ({
          ...mapEntityReferenceToOption(reference),
          icon: <Avatar placeholderIcon={Users01} size="xs" />,
        })),
      ]);
    } catch {
      setUserTeamOptions([]);
    }
  }, []);

  const fetchDomainOptions = useCallback(async (searchText = '') => {
    try {
      const response = await searchQuery({
        pageNumber: 1,
        pageSize: PAGE_SIZE_MEDIUM,
        query: searchText,
        searchIndex: SearchIndex.DOMAIN,
      });
      const references = getEntityReferenceListFromEntities(
        response.hits.hits.map((hit) => hit._source),
        EntityType.DOMAIN
      );

      setDomainOptions(references.map(mapEntityReferenceToOption));
    } catch {
      setDomainOptions([]);
    }
  }, []);

  const fetchRelatedMetricOptions = useCallback(async (searchText = '') => {
    try {
      const response = await searchQuery({
        pageNumber: 1,
        pageSize: PAGE_SIZE_MEDIUM,
        query: searchText,
        searchIndex: SearchIndex.METRIC,
      });

      setRelatedMetricOptions(
        response.hits.hits.flatMap((hit) => {
          const source = hit._source;
          const fullyQualifiedName = source.fullyQualifiedName ?? source.name;
          if (!fullyQualifiedName) {
            return [];
          }
          const reference: EntityReference = {
            id: fullyQualifiedName,
            type: EntityType.METRIC,
            name: source.name,
            displayName: source.displayName,
            fullyQualifiedName,
          };

          return [
            {
              id: fullyQualifiedName,
              label: getEntityName(source),
              supportingText: fullyQualifiedName,
              value: reference,
            },
          ];
        })
      );
    } catch {
      setRelatedMetricOptions([]);
    }
  }, []);

  const fetchParentMetricOptions = useCallback(async (searchText = '') => {
    try {
      const response = await searchQuery({
        pageNumber: 1,
        pageSize: PAGE_SIZE_MEDIUM,
        query: searchText,
        searchIndex: SearchIndex.METRIC,
      });

      setParentMetricOptions(
        response.hits.hits.flatMap((hit) => {
          const source = hit._source;
          const fullyQualifiedName = source.fullyQualifiedName ?? source.name;
          if (!fullyQualifiedName) {
            return [];
          }
          const reference: EntityReference = {
            id: fullyQualifiedName,
            type: EntityType.METRIC,
            name: source.name,
            displayName: source.displayName,
            fullyQualifiedName,
          };

          return [
            {
              id: fullyQualifiedName,
              label: getEntityName(source),
              supportingText: fullyQualifiedName,
              value: reference,
            },
          ];
        })
      );
    } catch {
      setParentMetricOptions([]);
    }
  }, []);

  const handleUserTeamFocus = useCallback(
    () => void fetchUserTeamOptions(),
    [fetchUserTeamOptions]
  );
  const handleDomainFocus = useCallback(
    () => void fetchDomainOptions(),
    [fetchDomainOptions]
  );
  const handleParentMetricFocus = useCallback(
    () => void fetchParentMetricOptions(),
    [fetchParentMetricOptions]
  );
  const handleRelatedMetricFocus = useCallback(
    () => void fetchRelatedMetricOptions(),
    [fetchRelatedMetricOptions]
  );

  const debouncedUserTeamSearch = useMemo(
    () =>
      debounce(
        (searchText: string) => void fetchUserTeamOptions(searchText),
        250
      ),
    [fetchUserTeamOptions]
  );
  const debouncedDomainSearch = useMemo(
    () =>
      debounce(
        (searchText: string) => void fetchDomainOptions(searchText),
        250
      ),
    [fetchDomainOptions]
  );
  const debouncedRelatedMetricSearch = useMemo(
    () =>
      debounce(
        (searchText: string) => void fetchRelatedMetricOptions(searchText),
        250
      ),
    [fetchRelatedMetricOptions]
  );
  const debouncedParentMetricSearch = useMemo(
    () =>
      debounce(
        (searchText: string) => void fetchParentMetricOptions(searchText),
        250
      ),
    [fetchParentMetricOptions]
  );

  useEffect(
    () => () => {
      debouncedUserTeamSearch.cancel();
      debouncedDomainSearch.cancel();
      debouncedRelatedMetricSearch.cancel();
      debouncedParentMetricSearch.cancel();
    },
    [
      debouncedUserTeamSearch,
      debouncedDomainSearch,
      debouncedRelatedMetricSearch,
      debouncedParentMetricSearch,
    ]
  );

  const nameField: FieldProp = {
    id: 'root/name',
    label: t('label.name'),
    name: 'name',
    placeholder: t('label.name'),
    // inputDataTestId puts the testid on the inner <input> (not the wrapper) so
    // Playwright's `getByTestId('name').fill(...)` targets a fillable element,
    // matching the previous AddMetricPage behaviour. FieldPropsMap does not type
    // this pass-through key, hence the cast.
    props: { inputDataTestId: 'name' } as FieldPropsMap,
    required: true,
    rules: {
      required: t('label.field-required', { field: t('label.name') }),
      maxLength: {
        message: t('message.entity-size-in-between', {
          entity: t('label.name'),
          max: 128,
          min: 1,
        }),
        value: 128,
      },
      minLength: {
        message: t('message.entity-size-in-between', {
          entity: t('label.name'),
          max: 128,
          min: 1,
        }),
        value: 1,
      },
      pattern: {
        message: t('message.entity-name-validation'),
        value: ENTITY_NAME_REGEX,
      },
    },
    type: FieldTypes.TEXT,
  };

  const displayNameField: FieldProp = {
    id: 'root/displayName',
    label: t('label.display-name'),
    name: 'displayName',
    placeholder: t('label.display-name'),
    props: { inputDataTestId: 'display-name' } as FieldPropsMap,
    type: FieldTypes.TEXT,
  };

  const descriptionField: FieldProp = {
    id: 'root/description',
    label: t('label.description'),
    name: 'description',
    placeholder: t('label.description'),
    type: FieldTypes.DESCRIPTION,
  };

  const metricTypeField: FieldProp = {
    id: 'root/metricType',
    label: t('label.metric-type'),
    name: 'metricType',
    placeholder: t('label.select-field', { field: t('label.metric-type') }),
    props: { 'data-testid': 'metric-type-select', options: metricTypeOptions },
    type: FieldTypes.SELECT,
  };

  const granularityField: FieldProp = {
    id: 'root/granularity',
    label: t('label.granularity'),
    name: 'granularity',
    placeholder: t('label.select-field', { field: t('label.granularity') }),
    props: { 'data-testid': 'granularity-select', options: granularityOptions },
    type: FieldTypes.SELECT,
  };

  const unitField: FieldProp = {
    id: 'root/unitOfMeasurement',
    label: t('label.unit-of-measurement'),
    name: 'unitOfMeasurement',
    placeholder: t('label.select-field', {
      field: t('label.unit-of-measurement'),
    }),
    props: {
      'data-testid': 'unit-of-measurement-select',
      options: unitOptions,
    },
    type: FieldTypes.SELECT,
  };

  const customUnitField: FieldProp = {
    id: 'root/customUnitOfMeasurement',
    label: t('label.enter-custom-unit-of-measurement'),
    name: 'customUnitOfMeasurement',
    placeholder: t('label.enter-custom-unit-of-measurement'),
    props: { inputDataTestId: 'custom-unit' } as FieldPropsMap,
    required: true,
    rules: {
      required: t('label.field-required', {
        field: t('label.unit-of-measurement'),
      }),
    },
    type: FieldTypes.TEXT,
  };

  const languageField: FieldProp = {
    id: 'root/language',
    label: t('label.language'),
    name: 'language',
    placeholder: t('label.select-field', { field: t('label.language') }),
    props: { 'data-testid': 'language-select', options: languageOptions },
    type: FieldTypes.SELECT,
  };

  const codeField: FieldProp = {
    id: 'root/code',
    label: t('label.code'),
    name: 'code',
    placeholder: t('label.code'),
    props: { 'data-testid': 'metric-code' },
    required: true,
    rules: {
      required: t('label.field-required', { field: t('label.code') }),
    },
    type: FieldTypes.TEXTAREA,
  };

  const ownersField: FieldProp = {
    id: 'root/owners',
    label: t('label.owner-plural'),
    name: 'owners',
    placeholder: t('label.select-field', { field: t('label.owner-plural') }),
    props: {
      filterOption: () => true,
      multiple: true,
      onFocus: handleUserTeamFocus,
      onSearchChange: (searchText: string) =>
        debouncedUserTeamSearch(searchText),
      options: userTeamOptions,
    },
    type: FieldTypes.USER_TEAM_SELECT_INPUT,
  };

  const reviewersField: FieldProp = {
    id: 'root/reviewers',
    label: t('label.reviewer-plural'),
    name: 'reviewers',
    placeholder: t('label.select-field', { field: t('label.reviewer-plural') }),
    props: {
      filterOption: () => true,
      multiple: true,
      onFocus: handleUserTeamFocus,
      onSearchChange: (searchText: string) =>
        debouncedUserTeamSearch(searchText),
      options: userTeamOptions,
    },
    type: FieldTypes.USER_TEAM_SELECT_INPUT,
  };

  const domainsField: FieldProp = {
    id: 'root/domains',
    label: t('label.domain-plural'),
    name: 'domains',
    placeholder: t('label.select-field', { field: t('label.domain-plural') }),
    props: {
      filterOption: () => true,
      multiple: true,
      onFocus: handleDomainFocus,
      onSearchChange: (searchText: string) => debouncedDomainSearch(searchText),
      options: domainOptions,
    },
    type: FieldTypes.DOMAIN_SELECT,
  };

  const relatedMetricsField: FieldProp = {
    id: 'root/relatedMetrics',
    label: t('label.related-metric-plural'),
    name: 'relatedMetrics',
    placeholder: t('label.select-field', {
      field: t('label.related-metric-plural'),
    }),
    props: {
      filterOption: () => true,
      multiple: true,
      onFocus: handleRelatedMetricFocus,
      onSearchChange: (searchText: string) =>
        debouncedRelatedMetricSearch(searchText),
      options: relatedMetricOptions,
    },
    type: FieldTypes.ASYNC_SELECT,
  };

  const parentMetricField: FieldProp = {
    id: 'root/parentMetric',
    label: t('label.parent-metric'),
    name: 'parentMetric',
    placeholder: t('label.select-field', { field: t('label.parent-metric') }),
    props: {
      filterOption: () => true,
      onFocus: handleParentMetricFocus,
      onSearchChange: (searchText: string) =>
        debouncedParentMetricSearch(searchText),
      options: parentMetricOptions,
    },
    type: FieldTypes.ASYNC_SELECT,
  };

  return (
    <HookForm
      className="tw:flex tw:flex-col tw:gap-5"
      data-testid="add-metric-container"
      form={form}
      onSubmit={form.handleSubmit(onSubmit)}>
      <Box gap={4}>
        <div className="tw:min-w-0 tw:flex-1 tw:basis-0">
          {getField(nameField)}
        </div>
        <div className="tw:min-w-0 tw:flex-1 tw:basis-0">
          {getField(displayNameField)}
        </div>
      </Box>
      <div>{getField(descriptionField)}</div>
      <Box gap={4}>
        <div className="tw:min-w-0 tw:flex-1 tw:basis-0">
          {getField(metricTypeField)}
        </div>
        <div className="tw:min-w-0 tw:flex-1 tw:basis-0">
          {getField(granularityField)}
        </div>
      </Box>
      <Box gap={4}>
        <div className="tw:min-w-0 tw:flex-1 tw:basis-0">
          {getField(unitField)}
        </div>
        {isCustomUnit && (
          <div className="tw:min-w-0 tw:flex-1 tw:basis-0">
            {getField(customUnitField)}
          </div>
        )}
      </Box>
      {parentMetricFqn ? (
        <Alert
          data-testid="parent-metric-inherited"
          title={t('label.parent-metric')}
          variant="brand">
          {parentMetricFqn}
        </Alert>
      ) : (
        <div data-testid="parent-metric-field">
          {getField(parentMetricField)}
        </div>
      )}
      <div>{getField(ownersField)}</div>
      <div>{getField(reviewersField)}</div>
      <div>{getField(domainsField)}</div>
      <div>{getField(relatedMetricsField)}</div>
      <div>{getField(languageField)}</div>
      <div>{getField(codeField)}</div>
    </HookForm>
  );
};

export default AddMetricForm;
