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
import { IChangeEvent } from '@rjsf/core';
import { CheckCircle } from '@untitledui/icons';
import { isEmpty, isUndefined, startCase } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ServiceConnectionFilterPatternFields } from '../../../../enums/ServiceConnection.enum';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { ConfigData } from '../../../../interface/service.interface';
import { formatFormDataForSubmit } from '../../../../utils/JSONSchemaFormUtils';
import {
  buildValidConfig,
  ConnectionSchemaResult,
  EMPTY_CONNECTION_SCHEMA,
  loadConnectionSchema,
} from '../../../../utils/ServiceConnectionUtils';
import InlineAlert from '../../../common/InlineAlert/InlineAlert';
import {
  FILTER_LABEL_KEYS,
  FILTER_SINGLE_LABEL_KEYS,
  FORM_TEST_ID,
} from './FiltersConfigForm.constants';
import { FiltersConfigFormProps } from './FiltersConfigForm.interface';
import {
  FilterSchemaProperty,
  FilterSection,
  FilterSectionState,
  FiltersState,
} from './FiltersConfigForm.types';
import {
  addSnowflakeSystemExcludes,
  buildPatternFromState,
  cleanSchemaTitle,
  getConnectionDisplayHost,
  getFilterPatternConfig,
  getOrderedFilterEntries,
  getSectionIcon,
  parseRegexPattern,
  pluralizeFallback,
  singularizeFallback,
} from './FiltersConfigForm.utils';
import { FilterSectionCard } from './FilterSectionCard';

function FiltersConfigForm({
  data,
  okText,
  cancelText,
  serviceType,
  serviceCategory,
  status,
  onCancel,
  onSave,
  onFocus,
}: Readonly<FiltersConfigFormProps>) {
  const { t } = useTranslation();
  const { inlineAlertDetails } = useApplicationStore();
  const [connSch, setConnSch] = useState<ConnectionSchemaResult['connSch']>(
    EMPTY_CONNECTION_SCHEMA
  );
  const validConfig = useMemo(() => buildValidConfig(data), [data]);
  const [filters, setFilters] = useState<FiltersState>({});
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const submitText = okText ?? t('label.save');
  const backText = cancelText ?? t('label.cancel');
  const isSaving = status === 'waiting';

  useEffect(() => {
    let cancelled = false;
    loadConnectionSchema(serviceCategory, serviceType)
      .then((schema) => {
        if (!cancelled) {
          setConnSch(schema);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConnSch(EMPTY_CONNECTION_SCHEMA);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [serviceCategory, serviceType]);

  const filterSections = useMemo<FilterSection[]>(() => {
    const properties = (connSch.schema.properties ?? {}) as Record<
      string,
      unknown
    >;

    return (getOrderedFilterEntries(properties) as [string, unknown][]).map(
      ([fieldName, property]) => {
        const schemaProperty = property as FilterSchemaProperty;
        const field = fieldName as ServiceConnectionFilterPatternFields;
        const cleanedTitle = cleanSchemaTitle(
          schemaProperty.title ?? '',
          fieldName
        );
        const labelKey = FILTER_LABEL_KEYS[field];
        const singleLabelKey = FILTER_SINGLE_LABEL_KEYS[field];
        const label = labelKey
          ? t(labelKey)
          : pluralizeFallback(cleanedTitle || startCase(fieldName));
        const singleLabel = singleLabelKey
          ? t(singleLabelKey)
          : singularizeFallback(label);
        const defaultExcludes = addSnowflakeSystemExcludes(
          serviceType,
          fieldName,
          schemaProperty.default?.excludes ?? []
        );

        return {
          description: schemaProperty.description,
          fieldName,
          icon: getSectionIcon(fieldName),
          label,
          singleLabel,
          systemExcludes: defaultExcludes.map(parseRegexPattern),
        };
      }
    );
  }, [connSch.schema.properties, serviceType, t]);

  useEffect(() => {
    const initialFilters = filterSections.reduce<FiltersState>(
      (accumulator, section) => {
        const property = (
          (connSch.schema.properties ?? {}) as Record<
            string,
            FilterSchemaProperty
          >
        )[section.fieldName];
        const defaultConfig = {
          excludes: addSnowflakeSystemExcludes(
            serviceType,
            section.fieldName,
            property?.default?.excludes ?? []
          ),
          includes: property?.default?.includes ?? [],
        };
        const existingConfig = getFilterPatternConfig(
          validConfig,
          section.fieldName
        );
        const config = existingConfig ?? defaultConfig;
        const includes = (config.includes ?? []).map(parseRegexPattern);
        const excludes = (config.excludes ?? []).map(parseRegexPattern);

        accumulator[section.fieldName] = {
          excludes,
          includes,
          restrict: includes.length > 0,
        };

        return accumulator;
      },
      {}
    );
    const initialOpenSections = filterSections.reduce<Record<string, boolean>>(
      (accumulator, section, index) => {
        accumulator[section.fieldName] = index < 2;

        return accumulator;
      },
      {}
    );

    setFilters(initialFilters);
    setOpenSections(initialOpenSections);
  }, [connSch.schema.properties, filterSections, serviceType, validConfig]);

  const updateFilter = useCallback(
    (fieldName: string, filter: FilterSectionState) => {
      setFilters((currentFilters) => ({
        ...currentFilters,
        [fieldName]: filter,
      }));
    },
    []
  );

  const handleSubmit = async () => {
    const filterFormData = filterSections.reduce<
      Record<string, { excludes: string[]; includes: string[] }>
    >((accumulator, section) => {
      const filter = filters[section.fieldName];

      if (!filter) {
        return accumulator;
      }

      accumulator[section.fieldName] = buildPatternFromState(filter);

      return accumulator;
    }, {});
    const formattedFormData = formatFormDataForSubmit(
      filterFormData
    ) as ConfigData;

    await onSave({
      formData: formattedFormData,
    } as IChangeEvent<ConfigData>);
  };

  const connectionHost = getConnectionDisplayHost(validConfig, serviceType);

  return (
    <div
      className="tw:grid tw:gap-4 tw:font-[Inter,sans-serif]"
      data-testid={FORM_TEST_ID}>
      <div>
        <h2 className="tw:m-0 tw:text-lg tw:font-semibold tw:leading-7 tw:text-primary">
          {t('label.what-should-we-ingest')}
        </h2>
        <p className="tw:mt-1 tw:text-sm tw:font-normal tw:leading-5 tw:text-tertiary">
          {t('message.what-to-ingest-description')}
        </p>
      </div>

      <div className="tw:flex tw:items-start tw:gap-3 tw:rounded-xl tw:border tw:border-utility-success-200 tw:bg-utility-success-50 tw:px-4 tw:py-3.5">
        <span className="tw:grid tw:size-[30px] tw:shrink-0 tw:place-items-center tw:rounded-full tw:bg-white tw:text-utility-success-600">
          <CheckCircle size={17} />
        </span>
        <div>
          <div className="tw:font-semibold tw:leading-5 tw:text-primary">
            {t('message.connected-to-host', { host: connectionHost })}
          </div>
          <div className="tw:mt-px tw:text-xs tw:font-normal tw:leading-[18px] tw:text-tertiary">
            {t('message.connection-verified-ingestion-scope')}
          </div>
        </div>
      </div>

      <div className="tw:grid tw:gap-3">
        {filterSections.map((section) => {
          const filter = filters[section.fieldName];

          return filter ? (
            <FilterSectionCard
              filter={filter}
              isOpen={Boolean(openSections[section.fieldName])}
              key={section.fieldName}
              section={section}
              onChange={(updatedFilter) =>
                updateFilter(section.fieldName, updatedFilter)
              }
              onFocus={onFocus}
              onToggle={() =>
                setOpenSections((currentOpenSections) => ({
                  ...currentOpenSections,
                  [section.fieldName]: !currentOpenSections[section.fieldName],
                }))
              }
            />
          ) : null;
        })}
      </div>

      {isEmpty(filterSections) && (
        <div
          className="tw:rounded-xl tw:border tw:border-secondary tw:bg-secondary tw:p-6 tw:text-center tw:font-medium tw:leading-5 tw:text-tertiary"
          data-testid="no-config-available">
          {t('message.no-filter-patterns-available')}
        </div>
      )}

      {!isUndefined(inlineAlertDetails) && (
        <InlineAlert alertClassName="m-t-xs" {...inlineAlertDetails} />
      )}

      <div className="tw:sticky tw:bottom-0 tw:z-10 tw:mt-2 tw:flex tw:items-center tw:justify-end tw:gap-5 tw:border-t tw:border-secondary tw:bg-primary tw:pt-4 tw:pb-1">
        {onCancel && (
          <Button
            color="secondary"
            isDisabled={isSaving}
            size="sm"
            type="button"
            onPress={onCancel}>
            {backText}
          </Button>
        )}
        <Button
          color="primary"
          isDisabled={isSaving}
          size="sm"
          type="button"
          onPress={handleSubmit}>
          {submitText}
        </Button>
      </div>
    </div>
  );
}

export default FiltersConfigForm;
