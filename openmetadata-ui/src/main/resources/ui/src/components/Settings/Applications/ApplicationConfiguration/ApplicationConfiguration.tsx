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
import { IChangeEvent } from '@rjsf/core';
import { RJSFSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { isEmpty } from 'lodash';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ServiceCategory } from '../../../../enums/service.enum';
import { App } from '../../../../generated/entity/applications/app';
import { AppMarketPlaceDefinition } from '../../../../generated/entity/applications/marketplace/appMarketPlaceDefinition';
import FormBuilder from '../../../common/FormBuilder/FormBuilder';
import ResizablePanels from '../../../common/ResizablePanels/ResizablePanels';
import ServiceDocPanel from '../../../common/ServiceDocPanel/ServiceDocPanel';
import applicationsClassBase from '../AppDetails/ApplicationsClassBase';

interface ApplicationConfigurationProps {
  appData: App | AppMarketPlaceDefinition;
  isLoading: boolean;
  jsonSchema: RJSFSchema;
  onConfigSave: (data: IChangeEvent) => void;
  onCancel?: () => void;
}

const ApplicationConfiguration = ({
  appData,
  isLoading,
  jsonSchema,
  onConfigSave,
  onCancel,
}: ApplicationConfigurationProps) => {
  const { t } = useTranslation();
  const UiSchema = applicationsClassBase.getJSONUISchema();
  const [activeField, setActiveField] = useState<string>('');

  // Service focused field
  const handleFieldFocus = (fieldName: string) => {
    if (isEmpty(fieldName)) {
      return;
    }
    setTimeout(() => {
      setActiveField(fieldName);
    }, 50);
  };

  const formPanel = (
    <FormBuilder
      useSelectWidget
      cancelText={t('label.back')}
      formData={appData?.appConfiguration ?? {}}
      hideCancelButton={!onCancel}
      isLoading={isLoading}
      okText={t('label.submit')}
      schema={jsonSchema}
      serviceCategory={ServiceCategory.DASHBOARD_SERVICES}
      uiSchema={UiSchema}
      validator={validator}
      onCancel={onCancel}
      onFocus={handleFieldFocus}
      onSubmit={onConfigSave}
    />
  );

  const docPanel = (
    <ServiceDocPanel
      activeField={activeField}
      serviceName={appData?.name}
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

export default ApplicationConfiguration;
