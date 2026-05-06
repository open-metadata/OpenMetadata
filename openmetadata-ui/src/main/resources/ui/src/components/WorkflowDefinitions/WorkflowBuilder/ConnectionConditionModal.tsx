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
  Button,
  Card,
  Divider,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AVAILABLE_OPTIONS,
  ConditionValue,
  DEFAULT_QUALITY_BANDS,
} from '../../../constants/WorkflowBuilder.constants';
import { NodeSubType } from '../../../generated/governance/workflows/elements/nodeSubType';
import {
  ConnectionCondition,
  ConnectionConditionModalProps,
} from '../../../interface/workflow-builder-components.interface';

export const ConnectionConditionModal: React.FC<
  ConnectionConditionModalProps
> = ({
  connection,
  initialConditions,
  isOpen,
  sourceNode,
  sourceNodeLabel,
  targetNodeLabel,
  onCancel,
  onSave,
}) => {
  const { t } = useTranslation();

  const isDataCompletenessNode =
    sourceNode?.data?.subType === NodeSubType.DataCompletenessTask;

  const availableOptions = useMemo(() => {
    if (!isDataCompletenessNode) {
      return AVAILABLE_OPTIONS.CONDITION_VALUES;
    }
    const nodeQualityBands =
      sourceNode?.data?.qualityBands ||
      sourceNode?.data?.config?.qualityBands ||
      sourceNode?.data?.scoringLevels;

    if (
      nodeQualityBands &&
      Array.isArray(nodeQualityBands) &&
      nodeQualityBands.length > 0
    ) {
      const options = nodeQualityBands.map(
        (band: { levelName: string; minimumScore: number; name: string }) => ({
          label: band.name || band.levelName,
          value: band.name || band.levelName,
        })
      );

      return options;
    }

    return AVAILABLE_OPTIONS.CONDITION_VALUES;
  }, [isDataCompletenessNode, sourceNode?.data]);

  const defaultValue = useMemo(() => {
    return isDataCompletenessNode
      ? availableOptions[0]?.value || DEFAULT_QUALITY_BANDS[0].name
      : ConditionValue.TRUE;
  }, [isDataCompletenessNode, availableOptions]);

  const [conditions, setConditions] = useState<ConnectionCondition[]>(() => {
    if (initialConditions && initialConditions.length > 0) {
      return initialConditions;
    }

    return [
      {
        id: '1',
        operator: 'equals',
        type: 'simple',
        value: defaultValue,
      },
    ];
  });

  useEffect(() => {
    if (isOpen) {
      if (initialConditions && initialConditions.length > 0) {
        const validConditions = initialConditions.map((condition) => {
          const isValidValue = availableOptions.some(
            (option) => option.value === condition.value
          );
          if (!isValidValue) {
            return { ...condition, value: defaultValue };
          }

          return condition;
        });
        setConditions(validConditions);
      } else {
        setConditions([
          {
            id: '1',
            operator: 'equals',
            type: 'simple',
            value: defaultValue,
          },
        ]);
      }
    }
  }, [isOpen, initialConditions, defaultValue]);

  const handleSave = () => {
    if (connection) {
      onSave(connection, conditions);
    }
  };

  const handleCancel = () => {
    onCancel();
  };

  const updateCondition = (
    id: string,
    field: keyof ConnectionCondition,
    value: string
  ) => {
    setConditions((prev) => {
      const updated = prev.map((condition) =>
        condition.id === id ? { ...condition, [field]: value } : condition
      );

      return updated;
    });
  };

  if (!isOpen || !connection) {
    return null;
  }

  return (
    <Card
      className="tw:fixed tw:left-[400px] tw:top-[30%] tw:min-w-90 tw:max-w-100 tw:z-10000"
      data-testid="connection-condition-modal">
      <div className="tw:flex tw:justify-between tw:items-center tw:p-3">
        <Typography
          as="p"
          className="tw:m-0 tw:text-primary tw:leading-5"
          size="text-xs"
          weight="medium">
          {t('label.connection-condition')}
        </Typography>

        <div className="tw:flex tw:gap-1">
          <Button color="tertiary" size="sm" onPress={handleCancel}>
            {t('label.cancel')}
          </Button>
          <Button
            color="primary"
            data-testid="save-connection-button"
            size="sm"
            onPress={handleSave}>
            {t('label.save')}
          </Button>
        </div>
      </div>

      <Divider orientation="horizontal" />

      <div className="tw:flex tw:flex-col tw:p-3">
        <div className="tw:flex tw:items-center">
          <Typography
            className="tw:m-0  tw:text-secondary"
            size="text-xs"
            weight="medium">
            {t('label.source')}
          </Typography>
          <Typography
            className="tw:m-0  tw:text-primary tw:pl-11"
            size="text-xs"
            weight="medium">
            {sourceNodeLabel}
          </Typography>
        </div>

        <div className="tw:h-4 tw:w-px tw:bg-border-secondary tw:ml-3 tw:mb-0.5" />

        <Select
          data-testid="condition-select-dropdown"
          value={conditions[0]?.value || defaultValue}
          onChange={(key) => {
            if (conditions[0]) {
              updateCondition(conditions[0].id, 'value', String(key));
            }
          }}>
          {availableOptions.map((option) => (
            <Select.Item
              data-testid={`condition-select-option-${option.value}`}
              id={option.value}
              key={option.value}
              label={option.label}
            />
          ))}
        </Select>

        <div className="tw:h-4 tw:w-px tw:bg-border-secondary tw:ml-3 tw:mb-0.5" />

        <div className="tw:flex tw:items-center">
          <Typography
            className="tw:m-0 tw:text-secondary"
            size="text-xs"
            weight="medium">
            {t('label.destination')}
            {' : '}
          </Typography>

          <Typography
            className="tw:m-0  tw:text-primary tw:pl-4"
            size="text-xs"
            weight="medium">
            {targetNodeLabel}
          </Typography>
        </div>
      </div>
    </Card>
  );
};
