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

import { Box, Skeleton } from '@openmetadata/ui-core-components';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import SettingsSourceBanner from '../../../../../platform/settings/SettingsSourceBanner/SettingsSourceBanner';
import { useMcpConfiguration } from '../../../../../Settings/Applications/McpApplicationConfiguration/useMcpConfiguration';
import AppConfigForm from './AppConfigForm';
import type { McpConfigFormProps } from './Applications.types';

/** The MCP server settings in the same form, hints and footer as every other app. */
const McpConfigForm: FC<McpConfigFormProps> = ({
  appData,
  jsonSchema,
  showHint,
  onCancel,
}) => {
  const { t } = useTranslation();
  const {
    formConfig,
    formUiSchema,
    isEveryFieldManaged,
    isFetching,
    isSaving,
    sources,
    fetchMcpConfig,
    refetchSources,
    saveMcpConfig,
  } = useMcpConfiguration();

  if (isFetching) {
    return <Skeleton height={240} variant="rounded" width="100%" />;
  }

  return (
    <Box data-testid="mcp-config" direction="col" gap={4}>
      <SettingsSourceBanner
        sources={sources}
        onAdopted={fetchMcpConfig}
        onRefetch={refetchSources}
      />
      <AppConfigForm
        appData={{ ...appData, appConfiguration: formConfig }}
        isReadOnly={isEveryFieldManaged}
        isSaving={isSaving}
        jsonSchema={jsonSchema}
        showHint={showHint}
        submitLabel={t('label.save')}
        uiSchema={formUiSchema}
        onCancel={onCancel}
        onSave={({ formData }) => saveMcpConfig(formData)}
      />
    </Box>
  );
};

export default McpConfigForm;
