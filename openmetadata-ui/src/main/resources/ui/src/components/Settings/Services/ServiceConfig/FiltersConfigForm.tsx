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
import Form, { IChangeEvent } from '@rjsf/core';
import {
  FieldTemplateProps,
  ObjectFieldTemplateProps,
  RJSFSchema,
  UiSchema,
} from '@rjsf/utils';
import { customizeValidator } from '@rjsf/validator-ajv8';
import { CheckCircle } from '@untitledui/icons';
import { isEmpty, isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { ConfigData } from '../../../../interface/service.interface';
import { formatFormDataForSubmit } from '../../../../utils/JSONSchemaFormUtils';
import {
  buildValidConfig,
  EMPTY_CONNECTION_SCHEMA,
  loadConnectionSchema,
} from '../../../../utils/ServiceConnectionUtils';
import InlineAlert from '../../../common/InlineAlert/InlineAlert';
import { FilterPatternField } from './FilterPatternField';
import { FORM_TEST_ID } from './FiltersConfigForm.constants';
import { FiltersConfigFormProps } from './FiltersConfigForm.interface';
import {
  FilterPatternConfig,
  FilterSchemaProperty,
} from './FiltersConfigForm.types';
import {
  addSnowflakeSystemExcludes,
  getConnectionDisplayHost,
  getFilterPatternConfig,
  getOrderedFilterEntries,
} from './FiltersConfigForm.utils';

const validator = customizeValidator();

const FiltersFormObjectTemplate = ({
  properties,
}: ObjectFieldTemplateProps) => (
  <div className="tw:grid tw:gap-3">
    {properties.map((p) => (
      <div key={p.name}>{p.content}</div>
    ))}
  </div>
);

const FiltersFormFieldTemplate = ({ children, hidden }: FieldTemplateProps) =>
  hidden ? <div className="tw:hidden">{children}</div> : <>{children}</>;

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
  const [connSch, setConnSch] = useState(EMPTY_CONNECTION_SCHEMA);
  const validConfig = useMemo(() => buildValidConfig(data), [data]);
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

  const filterEntries = useMemo(
    () =>
      getOrderedFilterEntries(
        (connSch.schema.properties ?? {}) as Record<string, unknown>
      ),
    [connSch.schema.properties]
  );

  const filterSchema = useMemo<RJSFSchema>(() => {
    const properties: Record<string, unknown> = {};
    filterEntries.forEach(([fieldName, property]) => {
      properties[fieldName as string] = property;
    });

    return { properties, type: 'object' };
  }, [filterEntries]);

  const initialFilterFormData = useMemo(() => {
    const formData: Record<string, FilterPatternConfig | undefined> = {};
    filterEntries.forEach(([fieldName]) => {
      const existing = getFilterPatternConfig(validConfig, fieldName as string);
      if (existing) {
        formData[fieldName as string] = existing;
      }
    });

    return formData;
  }, [filterEntries, validConfig]);

  const filterUiSchema = useMemo<UiSchema>(() => {
    const uiSchema: UiSchema = {};
    filterEntries.forEach(([fieldName, property], index) => {
      const schemaProperty = property as FilterSchemaProperty;
      const systemExcludes = addSnowflakeSystemExcludes(
        serviceType,
        fieldName as string,
        schemaProperty.default?.excludes ?? []
      );
      uiSchema[fieldName as string] = {
        'ui:field': 'FilterPatternField',
        'ui:options': {
          defaultOpen: index < 2,
          hasExistingData: (fieldName as string) in initialFilterFormData,
          systemExcludes,
        },
      };
    });

    return uiSchema;
  }, [filterEntries, initialFilterFormData, serviceType]);

  const filterDataRef = useRef<Record<string, FilterPatternConfig | undefined>>(
    initialFilterFormData
  );

  const handleFilterFormChange = useCallback((e: IChangeEvent) => {
    if (e.formData !== undefined) {
      filterDataRef.current = e.formData as Record<
        string,
        FilterPatternConfig | undefined
      >;
    }
  }, []);

  const handleSubmit = async () => {
    const filterData = Object.fromEntries(
      Object.entries(filterDataRef.current).filter(([, v]) => v !== undefined)
    );
    const formattedFormData = formatFormDataForSubmit(filterData) as ConfigData;
    await onSave({ formData: formattedFormData } as IChangeEvent<ConfigData>);
  };

  const connectionHost = getConnectionDisplayHost(validConfig, serviceType);
  const formKey = filterEntries.map(([name]) => name as string).join(',');

  return (
    <div className="tw:grid tw:gap-4" data-testid={FORM_TEST_ID}>
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

      {isEmpty(filterEntries) ? (
        <div
          className="tw:rounded-xl tw:border tw:border-secondary tw:bg-secondary tw:p-6 tw:text-center tw:font-medium tw:leading-5 tw:text-tertiary"
          data-testid="no-config-available">
          {t('message.no-filter-patterns-available')}
        </div>
      ) : (
        <Form
          noHtml5Validate
          fields={{ FilterPatternField }}
          formContext={{ handleFocus: onFocus }}
          formData={initialFilterFormData}
          idSeparator="/"
          key={formKey}
          schema={filterSchema}
          showErrorList={false}
          templates={{
            FieldTemplate: FiltersFormFieldTemplate,
            ObjectFieldTemplate: FiltersFormObjectTemplate,
          }}
          uiSchema={filterUiSchema}
          validator={validator}
          onChange={handleFilterFormChange}>
          {null}
        </Form>
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
