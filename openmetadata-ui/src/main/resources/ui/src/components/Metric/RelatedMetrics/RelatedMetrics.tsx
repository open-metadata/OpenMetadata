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
  Box,
  Button,
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import { Edit03, Plus } from '@untitledui/icons';
import type { FC } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntityType } from '../../../enums/entity.enum';
import type { Metric } from '../../../generated/entity/data/metric';
import type { EntityReference } from '../../../generated/type/entityReference';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import type { RelatedMetricOption } from './RelatedMetricsForm';
import { RelatedMetricsForm } from './RelatedMetricsForm';

interface RelatedMetricsActionProps {
  canEdit: boolean;
  hasMetrics: boolean;
  isEditing: boolean;
  onEdit: () => void;
}

const RelatedMetricsAction = ({
  canEdit,
  hasMetrics,
  isEditing,
  onEdit,
}: RelatedMetricsActionProps) => {
  const { t } = useTranslation();
  if (isEditing || !canEdit) {
    return null;
  }

  return (
    <Button
      aria-label={t(hasMetrics ? 'label.edit' : 'label.add')}
      color="secondary"
      data-testid={
        hasMetrics ? 'edit-related-metrics' : 'add-related-metrics-container'
      }
      iconLeading={hasMetrics ? Edit03 : Plus}
      onPress={onEdit}
    />
  );
};

interface RelatedMetricsContentProps {
  initialOptions: RelatedMetricOption[];
  isEditing: boolean;
  isExpanded: boolean;
  metricFqn: string;
  onCancel: () => void;
  onExpand: () => void;
  onSubmit: (options: RelatedMetricOption[]) => Promise<void>;
  relatedMetrics: EntityReference[];
  visibleMetrics: EntityReference[];
}

const RelatedMetricsContent = ({
  initialOptions,
  isEditing,
  isExpanded,
  metricFqn,
  onCancel,
  onExpand,
  onSubmit,
  relatedMetrics,
  visibleMetrics,
}: RelatedMetricsContentProps) => {
  const { t } = useTranslation();
  if (isEditing) {
    return (
      <RelatedMetricsForm
        defaultValue={relatedMetrics.map(({ id }) => id)}
        initialOptions={initialOptions}
        metricFqn={metricFqn}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    );
  }

  if (!visibleMetrics.length) {
    return (
      <Typography className="tw:text-tertiary" size="text-sm">
        {t('label.empty-dash')}
      </Typography>
    );
  }

  return (
    <Box direction="col" gap={2}>
      {visibleMetrics.map((reference) => (
        <Link
          className="tw:text-sm tw:font-medium tw:text-brand-secondary tw:outline-brand hover:tw:text-brand-secondary_hover focus-visible:tw:outline-2 focus-visible:tw:outline-offset-2"
          data-testid={getEntityName(reference)}
          key={reference.id}
          to={getEntityDetailsPath(
            EntityType.METRIC,
            reference.fullyQualifiedName ?? ''
          )}>
          {getEntityName(reference)}
        </Link>
      ))}
      {relatedMetrics.length > 5 && (
        <Button
          color="link-color"
          data-testid={`show-${isExpanded ? 'less' : 'more'}`}
          onPress={onExpand}>
          {isExpanded ? t('label.show-less') : t('label.show-more')}
        </Button>
      )}
    </Box>
  );
};

const RelatedMetrics: FC = () => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: metric, onUpdate, permissions } = useGenericContext<Metric>();
  const relatedMetrics = metric.relatedMetrics ?? [];
  const visibleMetrics = isExpanded
    ? relatedMetrics
    : relatedMetrics.slice(0, 5);
  const initialOptions = useMemo<RelatedMetricOption[]>(
    () =>
      relatedMetrics.map((reference) => ({
        label: getEntityName(reference),
        value: reference.id,
        reference,
      })),
    [relatedMetrics]
  );

  const handleSubmit = useCallback(
    async (options: RelatedMetricOption[]) => {
      try {
        await onUpdate?.(
          {
            ...metric,
            relatedMetrics: options.map(({ reference }) => reference),
          },
          'relatedMetrics'
        );
        setIsEditing(false);
      } catch (error) {
        showErrorToast(error instanceof Error ? error.message : String(error));

        throw error;
      }
    },
    [metric, onUpdate]
  );

  return (
    <Card data-testid="related-metrics-card">
      <Card.Header
        extra={
          <RelatedMetricsAction
            canEdit={permissions.EditAll && !metric.deleted}
            hasMetrics={relatedMetrics.length > 0}
            isEditing={isEditing}
            onEdit={() => setIsEditing(true)}
          />
        }
        title={t('label.related-metric-plural')}
      />
      <Card.Content>
        <RelatedMetricsContent
          initialOptions={initialOptions}
          isEditing={isEditing}
          isExpanded={isExpanded}
          metricFqn={metric.fullyQualifiedName ?? ''}
          relatedMetrics={relatedMetrics}
          visibleMetrics={visibleMetrics}
          onCancel={() => setIsEditing(false)}
          onExpand={() => setIsExpanded((expanded) => !expanded)}
          onSubmit={handleSubmit}
        />
      </Card.Content>
    </Card>
  );
};

export default RelatedMetrics;
