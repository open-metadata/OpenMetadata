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
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Dialog,
  Input,
  Modal,
  ModalOverlay,
  Select,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { Calendar, Edit03, Percent01, Variable } from '@untitledui/icons';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntityType } from '../../../enums/entity.enum';
import type { Metric } from '../../../generated/entity/data/metric';
import {
  Language,
  MetricGranularity,
  MetricType,
  UnitOfMeasurement,
} from '../../../generated/entity/data/metric';
import { getEntityName } from '../../../utils/EntityNameUtils';
import {
  getMetricEnumLabel,
  getMetricTypeBadgeColor,
  METRIC_TYPE_BADGE_CLASS_NAME,
} from '../../../utils/MetricEntityUtils/MetricDisplayUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import MetricExpression from '../MetricExpression/MetricExpression';
import type { RelatedMetricOption } from '../RelatedMetrics/RelatedMetricsForm';
import { RelatedMetricsForm } from '../RelatedMetrics/RelatedMetricsForm';

interface MetricDefinitionCardProps {
  metric?: Metric;
  onUpdate?: (updatedData: Metric, key?: keyof Metric) => Promise<void>;
  canEdit?: boolean;
}

interface DefinitionFieldProps {
  children: ReactNode;
  label: string;
  testId: string;
}

const DefinitionField = ({ children, label, testId }: DefinitionFieldProps) => (
  <Box className="tw:min-w-0" data-testid={testId} direction="col" gap={1}>
    <Typography
      className="tw:uppercase tw:tracking-wide tw:text-tertiary"
      size="text-xs"
      weight="semibold">
      {label}
    </Typography>
    <Box align="center" className="tw:min-h-6 tw:text-primary" gap={2}>
      {children}
    </Box>
  </Box>
);

interface MetricDefinitionEditDialogProps {
  metric: Metric;
  open: boolean;
  onClose: () => void;
  onUpdate: (updatedData: Metric, key?: keyof Metric) => Promise<void>;
}

const MetricDefinitionEditDialog = ({
  metric,
  onClose,
  onUpdate,
  open,
}: MetricDefinitionEditDialogProps) => {
  const { t } = useTranslation();
  const initialRelatedOptions = useMemo<RelatedMetricOption[]>(
    () =>
      (metric.relatedMetrics ?? []).map((reference) => ({
        label: getEntityName(reference),
        reference,
        value: reference.id,
      })),
    [metric.relatedMetrics]
  );
  const [metricType, setMetricType] = useState(metric.metricType);
  const [granularity, setGranularity] = useState(metric.granularity);
  const [unit, setUnit] = useState(metric.unitOfMeasurement);
  const [customUnit, setCustomUnit] = useState(
    metric.customUnitOfMeasurement ?? ''
  );
  const [language, setLanguage] = useState(
    metric.metricExpression?.language ?? Language.SQL
  );
  const [code, setCode] = useState(metric.metricExpression?.code ?? '');
  const [relatedOptions, setRelatedOptions] = useState(initialRelatedOptions);
  const [codeError, setCodeError] = useState<string>();
  const [customUnitError, setCustomUnitError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setMetricType(metric.metricType);
    setGranularity(metric.granularity);
    setUnit(metric.unitOfMeasurement);
    setCustomUnit(metric.customUnitOfMeasurement ?? '');
    setLanguage(metric.metricExpression?.language ?? Language.SQL);
    setCode(metric.metricExpression?.code ?? '');
    setRelatedOptions(initialRelatedOptions);
    setCodeError(undefined);
    setCustomUnitError(undefined);
    setSaveError(false);
  }, [initialRelatedOptions, metric, open]);

  const handleSave = async () => {
    const requiredCodeError = code.trim()
      ? undefined
      : t('label.field-required', { field: t('label.code') });
    const requiredCustomUnitError =
      unit === UnitOfMeasurement.Other && !customUnit.trim()
        ? t('label.field-required', {
            field: t('label.unit-of-measurement'),
          })
        : undefined;
    setCodeError(requiredCodeError);
    setCustomUnitError(requiredCustomUnitError);
    if (requiredCodeError || requiredCustomUnitError) {
      return;
    }

    setIsSaving(true);
    setSaveError(false);
    try {
      await onUpdate({
        ...metric,
        metricType,
        granularity,
        unitOfMeasurement: unit,
        customUnitOfMeasurement:
          unit === UnitOfMeasurement.Other ? customUnit.trim() : undefined,
        metricExpression: {
          ...metric.metricExpression,
          code: code.trim(),
          language,
        },
        relatedMetrics: relatedOptions.map(({ reference }) => reference),
      });
      onClose();
    } catch {
      setSaveError(true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalOverlay
      isDismissable={!isSaving}
      isOpen={open}
      onOpenChange={(isOpen) => !isOpen && !isSaving && onClose()}>
      <Modal>
        <Dialog
          showCloseButton
          data-testid="metric-definition-edit-dialog"
          title={t('label.edit-entity', { entity: t('label.definition') })}
          width={720}
          onClose={onClose}>
          <Dialog.Content className="tw:max-h-[70vh] tw:overflow-y-auto">
            <Box direction="col" gap={4}>
              {saveError && (
                <Alert
                  title={t('server.entity-updating-error', {
                    entityName: getEntityName(metric),
                  })}
                  variant="error"
                />
              )}
              <Box className="tw:grid tw:grid-cols-1 tw:gap-4 tw:sm:grid-cols-2">
                <Select
                  isDisabled={isSaving}
                  label={t('label.metric-type')}
                  selectedKey={metricType ?? null}
                  onSelectionChange={(key) =>
                    key !== null && setMetricType(key as MetricType)
                  }>
                  {Object.values(MetricType).map((value) => (
                    <Select.Item
                      id={value}
                      key={value}
                      label={getMetricEnumLabel(t, value)}
                    />
                  ))}
                </Select>
                <Select
                  isDisabled={isSaving}
                  label={t('label.granularity')}
                  selectedKey={granularity ?? null}
                  onSelectionChange={(key) =>
                    key !== null && setGranularity(key as MetricGranularity)
                  }>
                  {Object.values(MetricGranularity).map((value) => (
                    <Select.Item
                      id={value}
                      key={value}
                      label={getMetricEnumLabel(t, value)}
                    />
                  ))}
                </Select>
                <Select
                  isDisabled={isSaving}
                  label={t('label.unit-of-measurement')}
                  selectedKey={unit ?? null}
                  onSelectionChange={(key) => {
                    if (key === null) {
                      return;
                    }
                    setUnit(key as UnitOfMeasurement);
                    setCustomUnitError(undefined);
                  }}>
                  {Object.values(UnitOfMeasurement).map((value) => (
                    <Select.Item
                      id={value}
                      key={value}
                      label={getMetricEnumLabel(t, value)}
                    />
                  ))}
                </Select>
                {unit === UnitOfMeasurement.Other && (
                  <Input
                    isRequired
                    hint={customUnitError}
                    inputDataTestId="metric-definition-custom-unit"
                    isDisabled={isSaving}
                    isInvalid={Boolean(customUnitError)}
                    label={t('label.enter-custom-unit-of-measurement')}
                    value={customUnit}
                    onChange={(value) => {
                      setCustomUnit(value);
                      setCustomUnitError(undefined);
                    }}
                  />
                )}
              </Box>
              <Select
                isDisabled={isSaving}
                label={t('label.language')}
                selectedKey={language}
                onSelectionChange={(key) =>
                  key !== null && setLanguage(key as Language)
                }>
                {Object.values(Language).map((value) => (
                  <Select.Item
                    id={value}
                    key={value}
                    label={getMetricEnumLabel(t, value)}
                  />
                ))}
              </Select>
              <TextArea
                isRequired
                hint={codeError}
                isDisabled={isSaving}
                isInvalid={Boolean(codeError)}
                label={t('label.code')}
                rows={8}
                value={code}
                onChange={(value) => {
                  setCode(value);
                  setCodeError(undefined);
                }}
              />
              <Box direction="col" gap={2}>
                <Typography size="text-sm" weight="medium">
                  {t('label.related-metric-plural')}
                </Typography>
                <RelatedMetricsForm
                  defaultValue={relatedOptions.map(({ value }) => value)}
                  initialOptions={initialRelatedOptions}
                  metricFqn={metric.fullyQualifiedName ?? ''}
                  showActions={false}
                  onCancel={() => undefined}
                  onSelectionChange={setRelatedOptions}
                  onSubmit={async () => undefined}
                />
              </Box>
            </Box>
          </Dialog.Content>
          <Dialog.Footer>
            <Button color="secondary" isDisabled={isSaving} onPress={onClose}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              data-testid="metric-definition-save"
              isLoading={isSaving}
              onPress={handleSave}>
              {t('label.save')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

const MetricDefinitionCard = ({
  metric: metricProp,
  onUpdate: onUpdateProp,
  canEdit,
}: MetricDefinitionCardProps) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const {
    data: contextMetric,
    onUpdate: contextUpdate,
    permissions,
    isVersionView,
  } = useGenericContext<Metric>();
  const metric = metricProp ?? contextMetric;
  const onUpdate = onUpdateProp ?? contextUpdate;
  const allowEdit =
    canEdit ?? Boolean(permissions.EditAll && !isVersionView && onUpdate);

  return (
    <Card className="tw:shadow-xs" data-testid="metric-definition-card">
      <Card.Header
        extra={
          allowEdit && !metric.deleted ? (
            <Button
              className="tw:shadow-none tw:after:outline-dashed"
              color="secondary"
              data-testid="metric-definition-edit"
              iconLeading={Edit03}
              size="xs"
              onPress={() => setIsEditing(true)}>
              {t('label.edit')}
            </Button>
          ) : undefined
        }
        title={
          <Box align="center" gap={2}>
            <Variable
              aria-hidden="true"
              className="tw:size-4 tw:shrink-0 tw:text-fg-tertiary"
              data-testid="metric-definition-icon"
            />
            {t('label.definition')}
          </Box>
        }
      />
      <Card.Content>
        <Box direction="col" gap={5}>
          <MetricExpression isEmbedded metric={metric} />
          <Box
            className="tw:grid tw:grid-cols-1 tw:gap-4 tw:sm:grid-cols-2 tw:lg:grid-cols-4"
            data-testid="metric-definition-fields">
            <DefinitionField
              label={t('label.metric-type')}
              testId="metric-definition-type">
              <Badge
                className={METRIC_TYPE_BADGE_CLASS_NAME}
                color={getMetricTypeBadgeColor(metric.metricType)}
                size="xs"
                type="color">
                {metric.metricType
                  ? getMetricEnumLabel(t, metric.metricType)
                  : t('label.empty-dash')}
              </Badge>
            </DefinitionField>
            <DefinitionField
              label={t('label.unit-of-measurement')}
              testId="metric-definition-unit">
              <Percent01
                aria-hidden="true"
                className="tw:size-4 tw:text-fg-quaternary"
              />
              <Typography
                className="tw:font-mono tw:uppercase tw:tracking-wide"
                size="text-sm"
                weight="semibold">
                {metric.customUnitOfMeasurement ??
                  (metric.unitOfMeasurement
                    ? getMetricEnumLabel(t, metric.unitOfMeasurement)
                    : t('label.empty-dash'))}
              </Typography>
            </DefinitionField>
            <DefinitionField
              label={t('label.granularity')}
              testId="metric-definition-granularity">
              <Calendar
                aria-hidden="true"
                className="tw:size-4 tw:text-fg-quaternary"
              />
              <Typography
                className="tw:font-mono tw:uppercase tw:tracking-wide"
                size="text-sm"
                weight="semibold">
                {metric.granularity
                  ? getMetricEnumLabel(t, metric.granularity)
                  : t('label.empty-dash')}
              </Typography>
            </DefinitionField>
            <DefinitionField
              label={t('label.related-metric-plural')}
              testId="metric-definition-related-metrics">
              {metric.relatedMetrics?.length ? (
                <Box
                  aria-label={t('label.related-metric-plural')}
                  gap={1}
                  wrap="wrap">
                  {metric.relatedMetrics.map((relatedMetric) => (
                    <Link
                      className={
                        'tw:inline-flex tw:items-center tw:rounded-md tw:bg-secondary tw:px-2 tw:py-0.5 ' +
                        'tw:text-xs tw:font-medium tw:text-secondary tw:outline-brand tw:hover:bg-primary_hover ' +
                        'tw:hover:text-secondary_hover tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2'
                      }
                      key={relatedMetric.id}
                      to={getEntityDetailsPath(
                        EntityType.METRIC,
                        relatedMetric.fullyQualifiedName ?? ''
                      )}>
                      {getEntityName(relatedMetric)}
                    </Link>
                  ))}
                </Box>
              ) : (
                <Typography className="tw:text-tertiary" size="text-sm">
                  {t('label.empty-dash')}
                </Typography>
              )}
            </DefinitionField>
          </Box>
        </Box>
      </Card.Content>
      {onUpdate && (
        <MetricDefinitionEditDialog
          metric={metric}
          open={isEditing}
          onClose={() => setIsEditing(false)}
          onUpdate={onUpdate}
        />
      )}
    </Card>
  );
};

export default MetricDefinitionCard;
