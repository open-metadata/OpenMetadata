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
import { isEmpty } from 'lodash';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MCPConfiguration } from '../../../../generated/configuration/mcpConfiguration';
import { formatFormDataForSubmit } from '../../../../utils/JSONSchemaFormUtils';
import FormBuilderV1 from '../../../common/FormBuilderV1/FormBuilderV1';
import Loader from '../../../common/Loader/Loader';
import ResizablePanels from '../../../common/ResizablePanels/ResizablePanels';
import ServiceDocPanel from '../../../common/ServiceDocPanel/ServiceDocPanel';
import SettingsSourceBanner from '../../../platform/settings/SettingsSourceBanner/SettingsSourceBanner';
import { useMcpConfiguration } from './useMcpConfiguration';

export interface McpApplicationConfigurationProps {
  appName: string;
  jsonSchema: RJSFSchema;
}

const McpApplicationConfiguration = ({
  appName,
  jsonSchema,
}: McpApplicationConfigurationProps) => {
  const { t } = useTranslation();
  const [activeField, setActiveField] = useState<string>('');
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

  const handleFieldFocus = useCallback((fieldName: string) => {
    if (isEmpty(fieldName)) {
      return;
    }
    setTimeout(() => {
      setActiveField(fieldName);
    }, 50);
  }, []);

  if (isFetching) {
    return <Loader />;
  }

  const formPanel = (
    <>
      <SettingsSourceBanner
        className="tw:mb-4"
        sources={sources}
        onAdopted={fetchMcpConfig}
        onRefetch={refetchSources}
      />
      <FormBuilderV1
        hideCancelButton
        cancelText={t('label.back')}
        disabled={isEveryFieldManaged}
        formData={formConfig}
        hideFooter={isEveryFieldManaged}
        isLoading={isSaving}
        okText={t('label.save')}
        readonly={isEveryFieldManaged}
        schema={jsonSchema}
        uiSchema={formUiSchema}
        onFocus={handleFieldFocus}
        onSubmit={({ formData }: IChangeEvent<MCPConfiguration>) =>
          saveMcpConfig(formatFormDataForSubmit(formData ?? {}))
        }
      />
    </>
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
