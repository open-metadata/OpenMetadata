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

import { Input, Select } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Node } from 'reactflow';
import {
  FieldOptions,
  FIELD_OPTIONS_DROPDOWN,
} from '../../../../constants/WorkflowBuilder.constants';
import { useWorkflowModeContext } from '../../../../contexts/WorkflowModeContext';
import { EntityType } from '../../../../enums/entity.enum';
import { TagSource } from '../../../../generated/api/domains/createDataProduct';
import { EntityStatus } from '../../../../generated/entity/data/glossaryTerm';
import {
  LabelType,
  State,
  TagLabel,
} from '../../../../generated/type/tagLabel';
import { getTags } from '../../../../rest/tagAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import {
  createNodeConfig,
  isValidString,
} from '../../../../utils/WorkflowBuilderUtils';
import TagSuggestion from '../../../common/TagSuggestion/TagSuggestion';

import { FormActionButtons, MetadataFormSection } from './';

interface SetActionFormProps {
  node: Node;
  onSave: (nodeId: string, config: Record<string, unknown>) => void;
  onClose: () => void;
  onDelete?: (nodeId: string) => void;
  entityTypes?: EntityType[];
}

export const SetActionForm: React.FC<SetActionFormProps> = ({
  node,
  onSave,
  onClose,
  onDelete,
}) => {
  const { t } = useTranslation();
  const { isFormDisabled } = useWorkflowModeContext();
  const [formData, setFormData] = useState({
    displayName: '',
    description: '',
    fieldName: '',
    fieldValue: '',
    actionConditions: '',
  });
  const [fieldOptions, setFieldOptions] = useState<Record<string, string[]>>({
    certification: [],
    tier: [],
    status: Object.values(EntityStatus),
  });
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);

  const updateFormData = useCallback(
    (field: keyof typeof formData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const parseFieldValueToTags = (value: string): TagLabel[] => {
    if (!value) {
      return [];
    }

    const uniqueTagFQNs = [
      ...new Set(value.split(',').map((tag) => tag.trim())),
    ];

    return uniqueTagFQNs.map((tagFQN: string) => ({
      tagFQN,
      source:
        formData.fieldName === FieldOptions.GLOSSARY_TERMS
          ? TagSource.Glossary
          : TagSource.Classification,
      labelType: LabelType.Manual,
      state: State.Confirmed,
    }));
  };

  const convertTagsToFieldValue = (tags: TagLabel[]): string => {
    if (tags.length === 0) {
      return '';
    } else if (tags.length === 1) {
      return tags[0].tagFQN;
    } else {
      return tags.map((tag) => tag.tagFQN).join(',');
    }
  };

  const handleTagsChange = useCallback(
    (newTags: TagLabel[]) => {
      if (newTags && Array.isArray(newTags)) {
        updateFormData('fieldValue', convertTagsToFieldValue(newTags));
      }
    },
    [updateFormData]
  );

  useEffect(() => {
    if (node?.data) {
      const nodeConfig = node.data.config || {};

      setFormData({
        displayName: node.data.displayName || node.data.label || '',
        description: node.data.description || '',
        fieldName: nodeConfig.fieldName || '',
        fieldValue: nodeConfig.fieldValue || '',
        actionConditions: node.data.actionConditions || '',
      });
    }
  }, [node]);

  const fetchCertificationOptions = async () => {
    try {
      setIsLoadingOptions(true);
      const response = await getTags({
        limit: 1000,
        parent: 'Certification',
      });
      const options = (response.data
        ?.map((tag) => tag.fullyQualifiedName)
        .filter(Boolean) || []) as string[];
      setFieldOptions((prev) => ({ ...prev, certification: options }));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoadingOptions(false);
    }
  };

  const fetchTierOptions = async () => {
    try {
      setIsLoadingOptions(true);
      const response = await getTags({
        limit: 1000,
        parent: 'Tier',
      });
      const options = (response.data
        ?.map((tag) => tag.fullyQualifiedName)
        .filter(Boolean) || []) as string[];
      setFieldOptions((prev) => ({ ...prev, tier: options }));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoadingOptions(false);
    }
  };

  useEffect(() => {
    if (formData.fieldName === FieldOptions.CERTIFICATION) {
      fetchCertificationOptions();
    } else if (formData.fieldName === FieldOptions.TIER) {
      fetchTierOptions();
    }
  }, [formData.fieldName]);

  const getSelectOptions = (field: string): string[] => {
    return fieldOptions[field] || [];
  };

  const isSelectField = (field: string): boolean => {
    return ['certification', 'tier', 'status'].includes(field);
  };

  const handleSave = () => {
    const config = createNodeConfig({
      displayName: formData.displayName,
      description: formData.description,
      actionConditions: formData.actionConditions,
      type: 'automatedTask',
      subType: 'setEntityAttributeTask',
      config: {
        fieldName: formData.fieldName,
        fieldValue: formData.fieldValue,
      },
    });

    onSave(node.id, config);
    onClose();
  };

  const handleDeleteNode = () => {
    if (onDelete) {
      onDelete(node.id);
    }
    onClose();
  };

  const renderFieldValue = () => {
    if (formData.fieldName === 'tags') {
      return (
        <TagSuggestion
          key="tags"
          label={t('label.field-value')}
          tagType={TagSource.Classification}
          value={parseFieldValueToTags(formData.fieldValue)}
          onChange={handleTagsChange}
        />
      );
    }

    if (formData.fieldName === 'glossaryTerms') {
      return (
        <TagSuggestion
          key="glossaryTerms"
          label={t('label.field-value')}
          placeholder={t('label.select-field', {
            field: t('label.glossary-term-plural'),
          })}
          tagType={TagSource.Glossary}
          value={parseFieldValueToTags(formData.fieldValue)}
          onChange={handleTagsChange}
        />
      );
    }

    if (isSelectField(formData.fieldName)) {
      return (
        <Select
          data-testid="field-value-select"
          isDisabled={isFormDisabled || isLoadingOptions}
          label={t('label.field-value')}
          value={formData.fieldValue}
          onChange={(e) => updateFormData('fieldValue', String(e ?? ''))}>
          {getSelectOptions(formData.fieldName).map((o) => (
            <Select.Item id={o} key={o} label={o} />
          ))}
        </Select>
      );
    }

    return (
      <Input
        data-testid="field-value-input"
        isDisabled={isFormDisabled}
        label={t('label.field-value')}
        placeholder={t('message.enter-field-value')}
        value={formData.fieldValue}
        onChange={(value) => updateFormData('fieldValue', value)}
      />
    );
  };

  return (
    <>
      <div className="tw:flex-1 tw:flex tw:flex-col">
        <MetadataFormSection
          description={formData.description}
          isStartNode={false}
          name={formData.displayName}
          onDescriptionChange={(value) => updateFormData('description', value)}
          onNameChange={(value) => updateFormData('displayName', value)}
        />
        <div className="tw:mb-6">
          <Select
            isRequired
            data-testid="field-name-select"
            isDisabled={isFormDisabled}
            label={t('label.field-name')}
            value={formData.fieldName}
            onChange={(e) => {
              updateFormData('fieldName', String(e ?? ''));
              updateFormData('fieldValue', '');
            }}>
            {FIELD_OPTIONS_DROPDOWN.map((opt) => (
              <Select.Item id={opt.value} key={opt.value} label={opt.label} />
            ))}
          </Select>
        </div>

        <div className="tw:mb-6">{renderFieldValue()}</div>
      </div>

      <FormActionButtons
        showDelete
        isDisabled={!isValidString(formData.displayName) || !formData.fieldName}
        onCancel={onClose}
        onDelete={handleDeleteNode}
        onSave={handleSave}
      />
    </>
  );
};
