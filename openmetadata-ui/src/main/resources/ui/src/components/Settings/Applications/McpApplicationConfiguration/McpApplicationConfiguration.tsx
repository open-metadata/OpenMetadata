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

import { IChangeEvent } from '@rjsf/core';
import { RJSFSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { AxiosError } from 'axios';
import { isEmpty, pick } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClientErrors } from '../../../../enums/Axios.enum';
import { ServiceCategory } from '../../../../enums/service.enum';
import { MCPConfiguration } from '../../../../generated/configuration/mcpConfiguration';
import { getMcpConfig, updateMcpConfig } from '../../../../rest/mcpConfigAPI';
import { formatFormDataForSubmit } from '../../../../utils/JSONSchemaFormUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import FormBuilder from '../../../common/FormBuilder/FormBuilder';
import Loader from '../../../common/Loader/Loader';
import ResizablePanels from '../../../common/ResizablePanels/ResizablePanels';
import ServiceDocPanel from '../../../common/ServiceDocPanel/ServiceDocPanel';
import applicationsClassBase from '../AppDetails/ApplicationsClassBase';

export interface McpApplicationConfigurationProps {
  appName: string;
  jsonSchema: RJSFSchema;
}

/**
 * Base URL and allowed origins are the two settings an operator has to be able to correct from
 * the product: an empty allowlist makes the MCP server reject every cross-origin request, and a
 * wrong base URL breaks the OAuth metadata behind a load balancer. Everything else in the stored
 * `mcpConfiguration` (timeouts, plus fields no code reads) stays out of the form but is merged
 * back on save, because the PUT replaces the whole setting.
 */
const EDITABLE_MCP_CONFIG_FIELDS: (keyof MCPConfiguration)[] = [
  'baseUrl',
  'allowedOrigins',
];

/**
 * The MCP app entity holds no configuration of its own. Everything the MCP server actually reads
 * lives in the `mcpConfiguration` system setting, so this tab talks to `/system/mcp/config`
 * directly rather than going through the app entity's `appConfiguration`.
 */
const McpApplicationConfiguration = ({
  appName,
  jsonSchema,
}: McpApplicationConfigurationProps) => {
  const { t } = useTranslation();
  const UiSchema = applicationsClassBase.getJSONUISchema();
  const [activeField, setActiveField] = useState<string>('');
  const [formConfig, setFormConfig] = useState<MCPConfiguration>({});
  const [isFetching, setIsFetching] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  // Fields outside the form are not rendered but must survive a save, since the PUT replaces the
  // whole setting. Held in a ref because they never affect rendering.
  const storedConfig = useRef<MCPConfiguration>({});

  const applyConfig = useCallback((config: MCPConfiguration) => {
    storedConfig.current = config;
    setFormConfig(pick(config, EDITABLE_MCP_CONFIG_FIELDS));
  }, []);

  const fetchMcpConfig = useCallback(async () => {
    setIsFetching(true);
    try {
      applyConfig(await getMcpConfig());
    } catch (error) {
      // A 404 means the setting has never been written. That is a valid starting state, so the
      // form falls back to the schema defaults instead of showing an error.
      if ((error as AxiosError)?.response?.status === ClientErrors.NOT_FOUND) {
        applyConfig({});
      } else {
        showErrorToast(error as AxiosError);
      }
    } finally {
      setIsFetching(false);
    }
  }, [applyConfig]);

  useEffect(() => {
    fetchMcpConfig();
  }, [fetchMcpConfig]);

  const handleFieldFocus = useCallback((fieldName: string) => {
    if (isEmpty(fieldName)) {
      return;
    }
    setTimeout(() => {
      setActiveField(fieldName);
    }, 50);
  }, []);

  const handleSubmit = useCallback(
    async ({ formData }: IChangeEvent<MCPConfiguration>) => {
      setIsSaving(true);
      try {
        const payload = {
          ...storedConfig.current,
          ...formatFormDataForSubmit(formData as MCPConfiguration),
        };
        applyConfig(await updateMcpConfig(payload));
        showSuccessToast(
          t('message.entity-saved-successfully', {
            entity: t('label.configuration'),
          })
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsSaving(false);
      }
    },
    [applyConfig, t]
  );

  if (isFetching) {
    return <Loader />;
  }

  const formPanel = (
    <FormBuilder
      capitalizeOptionLabel
      hideCancelButton
      useSelectWidget
      cancelText={t('label.back')}
      formData={formConfig}
      isLoading={isSaving}
      okText={t('label.save')}
      schema={jsonSchema}
      serviceCategory={ServiceCategory.DASHBOARD_SERVICES}
      uiSchema={UiSchema}
      validator={validator}
      onFocus={handleFieldFocus}
      onSubmit={handleSubmit}
    />
  );

  const docPanel = (
    <ServiceDocPanel
      activeField={activeField}
      serviceName={appName}
      serviceType="Applications"
    />
  );

  return (
    <ResizablePanels
      className="h-full content-height-with-resizable-panel"
      firstPanel={{
        children: formPanel,
        minWidth: 700,
        flex: 0.7,
        className: 'content-resizable-panel-container',
      }}
      secondPanel={{
        children: docPanel,
        className: 'service-doc-panel content-resizable-panel-container',
        minWidth: 400,
        flex: 0.3,
      }}
    />
  );
};

export default McpApplicationConfiguration;
