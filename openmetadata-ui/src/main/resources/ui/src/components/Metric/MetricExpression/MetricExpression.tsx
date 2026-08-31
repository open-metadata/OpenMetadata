/*
 *  Copyright 2024 Collate.
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
  Badge,
  Box,
  Button,
  Card,
  Select,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { Edit03 } from '@untitledui/icons';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Metric } from '../../../generated/entity/data/metric';
import { Language } from '../../../generated/entity/data/metric';
import { showErrorToast } from '../../../utils/ToastUtils';

export interface MetricExpressionProps {
  metric: Metric;
  onUpdate?: (updatedData: Metric, key?: keyof Metric) => Promise<void>;
  canEdit?: boolean;
  isEmbedded?: boolean;
}

const MetricExpression = ({
  metric,
  onUpdate,
  canEdit = false,
  isEmbedded = false,
}: MetricExpressionProps) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [code, setCode] = useState(metric.metricExpression?.code ?? '');
  const [language, setLanguage] = useState<Language>(
    metric.metricExpression?.language ?? Language.SQL
  );

  useEffect(() => {
    if (!isEditing) {
      setCode(metric.metricExpression?.code ?? '');
      setLanguage(metric.metricExpression?.language ?? Language.SQL);
    }
  }, [isEditing, metric.metricExpression]);

  const startEditing = () => {
    setCode(metric.metricExpression?.code ?? '');
    setLanguage(metric.metricExpression?.language ?? Language.SQL);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setCode(metric.metricExpression?.code ?? '');
    setLanguage(metric.metricExpression?.language ?? Language.SQL);
    setIsEditing(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onUpdate) {
      return;
    }
    setIsUpdating(true);
    try {
      await onUpdate(
        {
          ...metric,
          metricExpression: {
            ...metric.metricExpression,
            code,
            language,
          },
        },
        'metricExpression'
      );
      setIsEditing(false);
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : String(error));
    } finally {
      setIsUpdating(false);
    }
  };

  const content = isEditing ? (
    <form data-testid="metric-expression-form" onSubmit={handleSubmit}>
      <Box direction="col" gap={4}>
        <Select
          isDisabled={isUpdating}
          label={t('label.language')}
          selectedKey={language}
          onSelectionChange={(key) =>
            key !== null && setLanguage(key as Language)
          }>
          {Object.values(Language).map((option) => (
            <Select.Item id={option} key={option} label={option} />
          ))}
        </Select>
        <TextArea
          isRequired
          isDisabled={isUpdating}
          label={t('label.code')}
          rows={8}
          value={code}
          onChange={setCode}
        />
        <Box gap={2} justify="end">
          <Button
            color="secondary"
            data-testid="cancel-button"
            isDisabled={isUpdating}
            type="button"
            onPress={cancelEditing}>
            {t('label.cancel')}
          </Button>
          <Button
            data-testid="update-button"
            isDisabled={!code.trim()}
            isLoading={isUpdating}
            type="submit">
            {t('label.update')}
          </Button>
        </Box>
      </Box>
    </form>
  ) : (
    <Box
      className="tw:overflow-hidden tw:rounded-lg tw:border tw:border-secondary tw:bg-secondary"
      data-testid="metric-expression-panel"
      direction="col">
      <Box
        align="center"
        className="tw:border-b tw:border-secondary tw:bg-primary tw:px-3 tw:py-2"
        data-testid="metric-expression-header"
        justify="between">
        <Box align="center" gap={2}>
          <Badge
            className="tw:font-mono tw:uppercase tw:tracking-wide"
            color="purple"
            data-testid="metric-expression-language"
            size="xs"
            type="color">
            {metric.metricExpression?.language ?? t('label.empty-dash')}
          </Badge>
          {isEmbedded ? (
            <Typography className="tw:text-tertiary" size="text-xs">
              {t('label.expression')}
            </Typography>
          ) : null}
        </Box>
        {canEdit && onUpdate && !metric.deleted ? (
          <Button
            color="secondary"
            iconLeading={Edit03}
            size="sm"
            onPress={startEditing}>
            {t('label.edit-entity', { entity: t('label.expression') })}
          </Button>
        ) : null}
      </Box>
      <pre
        className="tw:m-0 tw:overflow-x-auto tw:bg-secondary tw:px-4 tw:py-3 tw:font-mono tw:text-sm tw:leading-5 tw:whitespace-pre-wrap tw:text-primary"
        data-testid="metric-expression-code">
        {metric.metricExpression?.code || t('label.empty-dash')}
      </pre>
    </Box>
  );

  if (isEmbedded) {
    return <section data-testid="code-component">{content}</section>;
  }

  return (
    <Card data-testid="code-component">
      <Card.Header
        title={
          <Typography size="text-sm" weight="semibold">
            {t('label.expression')}
          </Typography>
        }
      />
      <Card.Content>{content}</Card.Content>
    </Card>
  );
};

export default MetricExpression;
