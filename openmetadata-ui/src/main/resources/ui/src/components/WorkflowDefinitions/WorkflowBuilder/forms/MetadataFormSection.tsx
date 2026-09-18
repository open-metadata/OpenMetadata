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

import { Input, TextArea } from '@openmetadata/ui-core-components';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkflowModeContext } from '../../../../contexts/WorkflowModeContext';
import { MetadataFormSectionProps } from '../../../../interface/workflow-builder-components.interface';

export const MetadataFormSection: React.FC<MetadataFormSectionProps> = ({
  description,
  isStartNode,
  lockFields = false,
  lockDescriptionField,
  name,
  onDescriptionChange,
  onNameChange,
}) => {
  const { t } = useTranslation();
  const { isFormDisabled } = useWorkflowModeContext();
  const nameDisabled = isFormDisabled || lockFields;
  const descriptionDisabled =
    isFormDisabled || (lockDescriptionField ?? lockFields);

  return (
    <div data-testid="metadata-form-section">
      <div className="tw:mb-6" data-testid="workflow-name-section">
        <Input
          isRequired
          data-testid="workflow-name-input"
          isDisabled={nameDisabled}
          label={
            isStartNode ? t('label.workflow-name') : t('label.display-name')
          }
          value={name}
          onChange={(value) => {
            const capitalizedValue =
              value.length > 0
                ? value.charAt(0).toUpperCase() + value.slice(1)
                : value;
            onNameChange(capitalizedValue);
          }}
        />
      </div>

      <div className="tw:mb-6" data-testid="workflow-description-section">
        <TextArea
          data-testid="workflow-description-input"
          isDisabled={descriptionDisabled}
          label={
            isStartNode
              ? t('label.workflow-description')
              : t('label.description')
          }
          placeholder={t('label.description')}
          rows={3}
          value={description}
          onChange={onDescriptionChange}
        />
      </div>
    </div>
  );
};
