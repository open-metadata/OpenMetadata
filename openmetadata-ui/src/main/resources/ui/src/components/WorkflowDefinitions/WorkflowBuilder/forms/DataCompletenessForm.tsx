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

import {
  Autocomplete,
  Button,
  Input,
  SelectItemType,
  Typography,
} from '@openmetadata/ui-core-components';
import { Trash01 } from '@untitledui/icons';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useListData } from 'react-stately';
import { Node } from 'reactflow';
import { useWorkflowModeContext } from '../../../../contexts/WorkflowModeContext';
import { EntityType } from '../../../../enums/entity.enum';
import { NodeSubType } from '../../../../generated/governance/workflows/elements/nodeSubType';
import { NodeType } from '../../../../generated/governance/workflows/elements/nodeType';
import { useEntityFields } from '../../../../hooks/useEntityFields';
import { FormActionButtons, MetadataFormSection } from './';

interface ScoringLevel {
  threshold: number | string;
  levelName: string;
}

interface QualityBand {
  name: string;
  minimumScore: number;
}

interface DataCompletenessFormProps {
  node: Node;
  onSave: (nodeId: string, config: Record<string, unknown>) => void;
  onClose: () => void;
  onDelete?: (nodeId: string) => void;
  entityTypes?: EntityType[];
}

const convertScoringLevelsToQualityBands = (
  scoringLevels: ScoringLevel[]
): QualityBand[] => {
  const sortedLevels = [...scoringLevels].sort((a, b) => {
    const thresholdA = typeof a.threshold === 'string' ? 0 : a.threshold;
    const thresholdB = typeof b.threshold === 'string' ? 0 : b.threshold;

    return thresholdB - thresholdA;
  });

  return sortedLevels.map((level) => ({
    name: level.levelName,
    minimumScore:
      typeof level.threshold === 'string'
        ? parseFloat(level.threshold) || 0
        : level.threshold,
  }));
};

const convertQualityBandsToScoringLevels = (
  qualityBands: QualityBand[]
): ScoringLevel[] => {
  return qualityBands.map((band) => ({
    threshold: band.minimumScore,
    levelName: band.name,
  }));
};

export const DataCompletenessForm: React.FC<DataCompletenessFormProps> = ({
  node,
  onSave,
  onClose,
  onDelete,
  entityTypes = [EntityType.ALL],
}) => {
  const { t } = useTranslation();
  const { isFormDisabled } = useWorkflowModeContext();
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [checkForNull, setCheckForNull] = useState(false);
  const [scoringLevels, setScoringLevels] = useState<ScoringLevel[]>([
    { threshold: 100, levelName: 'Gold' },
    { threshold: 75, levelName: 'Silver' },
  ]);

  const { fieldOptions } = useEntityFields(entityTypes);
  const selectedFieldItems = useListData<SelectItemType>({ initialItems: [] });
  const initDoneRef = useRef(false);

  useEffect(() => {
    if (node?.data) {
      setDisplayName(node.data.displayName || node.data.label || '');
      setDescription(node.data.description || '');
      const fields: string[] =
        node.data.config?.fieldsToCheck || node.data.fields || [];
      setSelectedFields(fields);
      // Sync useListData with loaded fields
      if (!initDoneRef.current) {
        fields.forEach((f) => selectedFieldItems.append({ id: f, label: f }));
        initDoneRef.current = true;
      }
      setCheckForNull(node.data.checkForNull || false);
      if (
        node.data.config?.qualityBands &&
        Array.isArray(node.data.config.qualityBands)
      ) {
        setScoringLevels(
          convertQualityBandsToScoringLevels(node.data.config.qualityBands)
        );
      } else if (
        node.data.qualityBands &&
        Array.isArray(node.data.qualityBands)
      ) {
        setScoringLevels(
          convertQualityBandsToScoringLevels(node.data.qualityBands)
        );
      } else if (node.data.scoringLevels) {
        setScoringLevels(node.data.scoringLevels);
      } else {
        setScoringLevels([
          { threshold: 100, levelName: 'Gold' },
          { threshold: 75, levelName: 'Silver' },
        ]);
      }
    }
  }, [node]);

  const handleScoringLevelChange = (
    index: number,
    field: keyof ScoringLevel,
    value: string | number
  ) => {
    const updatedLevels = [...scoringLevels];
    updatedLevels[index] = { ...updatedLevels[index], [field]: value };
    setScoringLevels(updatedLevels);
  };

  const addScoringLevel = () => {
    setScoringLevels([...scoringLevels, { threshold: '', levelName: '' }]);
  };

  const removeScoringLevel = (index: number) => {
    if (scoringLevels.length > 1) {
      setScoringLevels(scoringLevels.filter((_, i) => i !== index));
    }
  };

  const handleSave = () => {
    const validScoringLevels = scoringLevels.filter(
      (level) => level.levelName.trim() !== ''
    );
    const qualityBands = convertScoringLevelsToQualityBands(validScoringLevels);

    const config = {
      displayName,
      description,
      type: NodeType.AutomatedTask,
      subType: NodeSubType.DataCompletenessTask,
      lastSaved: new Date().toISOString(),
      userModified: true,
      config: {
        fieldsToCheck: selectedFields,
        qualityBands,
      },
      fields: selectedFields,
      checkForNull,
      scoringLevels: validScoringLevels,
    };

    onSave(node.id, config);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const handleDeleteNode = () => {
    if (onDelete) {
      onDelete(node.id);
    }
    onClose();
  };

  const isFormValid = displayName.trim() && selectedFields.length > 0;

  return (
    <>
      <div className="tw:flex-1 tw:flex tw:flex-col">
        <MetadataFormSection
          description={description}
          isStartNode={false}
          name={displayName}
          onDescriptionChange={setDescription}
          onNameChange={setDisplayName}
        />

        <div className="tw:mb-6">
          <Autocomplete
            isRequired
            data-testid="fields-to-check-select"
            isDisabled={isFormDisabled}
            items={fieldOptions.map((f) => ({ id: f, label: f }))}
            label={t('label.fields')}
            placeholder={t('message.select-fields-to-check')}
            selectedItems={selectedFieldItems}
            onItemCleared={(key) => {
              selectedFieldItems.remove(key);
              setSelectedFields((prev) =>
                prev.filter((f) => f !== String(key))
              );
            }}
            onItemInserted={(key) => {
              const item = { id: String(key), label: String(key) };
              selectedFieldItems.append(item);
              setSelectedFields((prev) => [...prev, String(key)]);
            }}>
            {(item) => (
              <Autocomplete.Item
                id={item.id}
                isDisabled={item.isDisabled}
                key={item.id}
                label={item.label}
              />
            )}
          </Autocomplete>
        </div>

        <div className="tw:mb-6">
          <Typography
            className="tw:text-primary"
            size="text-sm"
            weight="semibold">
            {t('label.scoring-levels')}
          </Typography>

          <div className="tw:flex tw:gap-3 tw:mb-2 tw:mt-2 tw:items-center">
            <div className="tw:w-1/3">
              <Typography
                className="tw:m-0  tw:text-secondary"
                size="text-sm"
                weight="semibold">
                {t('label.threshold-percentage')}
              </Typography>
            </div>
            <div className="tw:w-3/5">
              <Typography
                className="tw:m-0 tw:text-secondary"
                size="text-sm"
                weight="semibold">
                {t('label.level-name')}
              </Typography>
            </div>
            <div className="tw:w-1/10" />
          </div>

          {scoringLevels.map((level, index) => (
            <div
              className="tw:flex tw:gap-3 tw:mb-3 tw:items-center"
              key={index}>
              <div className="tw:flex tw:w-1/3 tw:min-w-0 tw:items-center tw:gap-2">
                <div className="tw:min-w-0 tw:flex-1">
                  <Input
                    isDisabled={isFormDisabled}
                    type="number"
                    value={String(level.threshold)}
                    onChange={(value) => {
                      handleScoringLevelChange(
                        index,
                        'threshold',
                        value === '' ? '' : parseInt(value) || 0
                      );
                    }}
                  />
                </div>
                <Typography
                  aria-hidden
                  as="span"
                  className="tw:shrink-0 tw:text-tertiary"
                  size="text-sm"
                  weight="medium">
                  %
                </Typography>
              </div>

              <div className="tw:w-3/5">
                <Input
                  isDisabled={isFormDisabled}
                  placeholder={t('message.enter-level-name')}
                  value={level.levelName}
                  onChange={(value) =>
                    handleScoringLevelChange(index, 'levelName', value)
                  }
                />
              </div>

              <div className="tw:w-1/10 tw:flex tw:justify-center">
                {scoringLevels.length > 1 && (
                  <Button
                    color="tertiary-destructive"
                    iconLeading={Trash01}
                    isDisabled={isFormDisabled}
                    size="sm"
                    onPress={() => removeScoringLevel(index)}
                  />
                )}
              </div>
            </div>
          ))}

          <Button
            color="primary"
            data-testid="add-scoring-level-button"
            isDisabled={isFormDisabled}
            size="sm"
            onPress={addScoringLevel}>
            {t('label.add-level')}
          </Button>
        </div>
      </div>

      <FormActionButtons
        showDelete
        isDisabled={!isFormValid}
        onCancel={handleCancel}
        onDelete={handleDeleteNode}
        onSave={handleSave}
      />
    </>
  );
};
