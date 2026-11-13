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

import { RJSFSchema } from '@rjsf/utils';
import { AxiosError } from 'axios';
import { isEmpty, omit, pick, uniq } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClientErrors } from '../../../../enums/Axios.enum';
import { MCPConfiguration } from '../../../../generated/configuration/mcpConfiguration';
import { SettingType } from '../../../../generated/settings/settings';
import { useSettingsSource } from '../../../../hooks/platform/useSettingsSource';
import {
  getMcpConfig,
  getMcpTools,
  updateMcpConfig,
} from '../../../../rest/mcpConfigAPI';
import {
  applyManagedPathsToUiSchema,
  findSettingSource,
  isPathManaged,
  toJsonPointer,
} from '../../../../utils/platform/settingsSource.utils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import applicationsClassBase from '../AppDetails/ApplicationsClassBase';

/**
 * Base URL and allowed origins are the two settings an operator has to be able to correct from
 * the product: an empty allowlist makes the MCP server reject every cross-origin request, and a
 * wrong base URL breaks the OAuth metadata behind a load balancer. The response cap depends on
 * which MCP clients connect, so it is set here too. Everything else in the stored
 * `mcpConfiguration` (timeouts, plus fields no code reads) stays out of the form but is merged
 * back on save, because the PUT replaces the whole setting. Read-only mode and disabled tools are
 * admin choices, so they are edited here as well.
 */
const EDITABLE_MCP_CONFIG_FIELDS: (keyof MCPConfiguration)[] = [
  'baseUrl',
  'allowedOrigins',
  'maxResponseChars',
  'readOnly',
  'disabledTools',
];

const MCP_SETTING_TYPES = [SettingType.MCPConfiguration];

/**
 * Which tools exist depends on the server: Collate adds its own and RDF tools are left out when RDF
 * is off, so the options are fetched, like the reindex entity list. Saved names stay options, or one
 * the server no longer registers would fail validation and block every save. With no list (it
 * failed, or the server registered none) the picker would offer only "All", which saves nothing, so
 * the field falls back to typing names, like Allowed Origins.
 */
export const withMcpToolNames = (
  schema: RJSFSchema,
  toolNames: string[] | undefined,
  savedNames: string[] = []
): RJSFSchema => {
  if (!toolNames) {
    return schema;
  }
  const field = schema.properties?.disabledTools as RJSFSchema;
  const disabledTools: RJSFSchema = isEmpty(toolNames)
    ? omit(field, ['uiFieldType', 'expandAllValue'])
    : {
        ...field,
        items: { type: 'string', enum: uniq([...toolNames, ...savedNames]) },
      };

  return { ...schema, properties: { ...schema.properties, disabledTools } };
};

/**
 * The MCP app entity holds no configuration of its own. Everything the MCP server actually reads
 * lives in the `mcpConfiguration` system setting, so the form talks to `/system/mcp/config`
 * directly rather than going through the app entity's `appConfiguration`.
 */
export const useMcpConfiguration = (jsonSchema: RJSFSchema) => {
  const { t } = useTranslation();
  const [formConfig, setFormConfig] = useState<MCPConfiguration>({});
  const [toolNames, setToolNames] = useState<string[]>();
  const [isFetching, setIsFetching] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  // Fields outside the form are not rendered but must survive a save, since the PUT replaces the
  // whole setting. Held in a ref because they never affect rendering.
  const storedConfig = useRef<MCPConfiguration>({});
  const { sources, refetch: refetchSources } =
    useSettingsSource(MCP_SETTING_TYPES);

  const { managedFields, isEveryFieldManaged } = useMemo(() => {
    const mcpSource = findSettingSource(sources, SettingType.MCPConfiguration);
    const fields = EDITABLE_MCP_CONFIG_FIELDS.filter((field) =>
      isPathManaged(mcpSource, toJsonPointer(field))
    );

    return {
      managedFields: fields,
      isEveryFieldManaged: fields.length === EDITABLE_MCP_CONFIG_FIELDS.length,
    };
  }, [sources]);

  const formUiSchema = useMemo(
    () =>
      applyManagedPathsToUiSchema(
        applicationsClassBase.getJSONUISchema(),
        managedFields.map((field) => toJsonPointer(field))
      ),
    [managedFields]
  );

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

  const fetchMcpTools = useCallback(async () => {
    try {
      setToolNames(await getMcpTools());
    } catch (error) {
      setToolNames([]);
      showErrorToast(error as AxiosError);
    }
  }, []);

  useEffect(() => {
    void fetchMcpConfig();
    void fetchMcpTools();
  }, [fetchMcpConfig, fetchMcpTools]);

  const formSchema = useMemo(
    () => withMcpToolNames(jsonSchema, toolNames, formConfig.disabledTools),
    [jsonSchema, toolNames, formConfig.disabledTools]
  );

  const saveMcpConfig = useCallback(
    // Callers pass form data already run through `formatFormDataForSubmit`.
    async (formData: MCPConfiguration) => {
      setIsSaving(true);
      try {
        const payload = {
          ...storedConfig.current,
          ...formData,
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

  return {
    formConfig,
    formSchema,
    formUiSchema,
    isEveryFieldManaged,
    isFetching,
    isSaving,
    sources,
    fetchMcpConfig,
    refetchSources,
    saveMcpConfig,
  };
};
