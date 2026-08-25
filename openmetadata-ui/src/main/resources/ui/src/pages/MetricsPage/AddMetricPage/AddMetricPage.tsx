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
  Box,
  Breadcrumbs,
  Button,
  Card,
  Input,
  Select,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { ArrowLeft, Plus } from '@untitledui/icons';
import { AxiosError } from 'axios';
import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DocumentTitle from '../../../components/common/DocumentTitle/DocumentTitle';
import MetricGroupSelect from '../../../components/Metric/MetricGroupSelect/MetricGroupSelect';
import MetricReferencePicker from '../../../components/Metric/MetricReferencePicker/MetricReferencePicker';
import { ROUTES } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import type { CreateMetric } from '../../../generated/api/data/createMetric';
import {
  Language,
  MetricGranularity,
  MetricType,
  UnitOfMeasurement,
} from '../../../generated/api/data/createMetric';
import type { EntityReference } from '../../../generated/entity/type';
import {
  createMetricGroup,
  deleteMetricGroup,
} from '../../../rest/metricGroupsAPI';
import { createMetric } from '../../../rest/metricsAPI';
import { getMetricEnumLabel } from '../../../utils/MetricEntityUtils/MetricDisplayUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

interface MetricFormState {
  name: string;
  displayName: string;
  description: string;
  granularity?: MetricGranularity;
  metricType?: MetricType;
  language: Language;
  code: string;
  unitOfMeasurement?: UnitOfMeasurement;
  customUnitOfMeasurement: string;
  metricGroup?: string;
  isNewMetricGroup: boolean;
  owners: EntityReference[];
  reviewers: EntityReference[];
  experts: EntityReference[];
  domains: EntityReference[];
  relatedMetrics: EntityReference[];
}

const INITIAL_FORM: MetricFormState = {
  name: '',
  displayName: '',
  description: '',
  language: Language.SQL,
  code: '',
  customUnitOfMeasurement: '',
  isNewMetricGroup: false,
  owners: [],
  reviewers: [],
  experts: [],
  domains: [],
  relatedMetrics: [],
};

interface AddMetricPageProps {
  pageTitle?: string;
}

const AddMetricPage = ({ pageTitle }: AddMetricPageProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const parentMetricFqn = searchParams.get('parent') ?? undefined;
  const [values, setValues] = useState<MetricFormState>(INITIAL_FORM);
  const [isCreating, setIsCreating] = useState(false);
  const [nameError, setNameError] = useState<string>();
  const [codeError, setCodeError] = useState<string>();
  const [customUnitError, setCustomUnitError] = useState<string>();
  const title =
    pageTitle ?? t('label.add-new-entity', { entity: t('label.metric') });

  const setField = <K extends keyof MetricFormState>(
    key: K,
    value: MetricFormState[K]
  ) => setValues((current) => ({ ...current, [key]: value }));

  const breadcrumbs = useMemo(
    () => [
      { id: 'metrics', label: t('label.metric-plural'), href: ROUTES.METRICS },
      { id: 'add-metric', label: title },
    ],
    [t, title]
  );

  const handleMetricGroupChange = (
    metricGroup?: string,
    isNewMetricGroup = false
  ) =>
    setValues((current) => ({
      ...current,
      metricGroup,
      isNewMetricGroup,
    }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = values.name.trim();
    const expressionCode = values.code.trim();
    const requiredNameError = name
      ? undefined
      : t('label.field-required', {
          field: t('label.name'),
        });
    const requiredCodeError = expressionCode
      ? undefined
      : t('label.field-required', {
          field: t('label.code'),
        });
    const requiredCustomUnitError =
      values.unitOfMeasurement === UnitOfMeasurement.Other &&
      !values.customUnitOfMeasurement.trim()
        ? t('label.field-required', {
            field: t('label.unit-of-measurement'),
          })
        : undefined;
    setNameError(requiredNameError);
    setCodeError(requiredCodeError);
    setCustomUnitError(requiredCustomUnitError);
    if (requiredNameError || requiredCodeError || requiredCustomUnitError) {
      return;
    }

    setIsCreating(true);
    let createdGroupId: string | undefined;
    try {
      let metricGroup = parentMetricFqn ? undefined : values.metricGroup;
      if (metricGroup && values.isNewMetricGroup) {
        const group = await createMetricGroup({ name: metricGroup });
        createdGroupId = group.id;
        metricGroup = group.fullyQualifiedName ?? group.name;
      }

      const payload: CreateMetric = {
        name,
        ...(values.displayName.trim()
          ? { displayName: values.displayName.trim() }
          : {}),
        ...(values.description.trim()
          ? { description: values.description.trim() }
          : {}),
        ...(values.granularity ? { granularity: values.granularity } : {}),
        ...(values.metricType ? { metricType: values.metricType } : {}),
        ...(values.unitOfMeasurement
          ? { unitOfMeasurement: values.unitOfMeasurement }
          : {}),
        ...(values.unitOfMeasurement === UnitOfMeasurement.Other &&
        values.customUnitOfMeasurement.trim()
          ? { customUnitOfMeasurement: values.customUnitOfMeasurement.trim() }
          : {}),
        ...(metricGroup ? { metricGroup } : {}),
        ...(parentMetricFqn ? { parent: parentMetricFqn } : {}),
        ...(values.owners.length ? { owners: values.owners } : {}),
        ...(values.reviewers.length ? { reviewers: values.reviewers } : {}),
        ...(values.experts.length
          ? {
              experts: values.experts.map(
                ({ fullyQualifiedName, name }) =>
                  fullyQualifiedName ?? name ?? ''
              ),
            }
          : {}),
        ...(values.domains.length
          ? {
              domains: values.domains.map(
                ({ fullyQualifiedName, name }) =>
                  fullyQualifiedName ?? name ?? ''
              ),
            }
          : {}),
        ...(values.relatedMetrics.length
          ? {
              relatedMetrics: values.relatedMetrics.map(
                ({ fullyQualifiedName, name }) =>
                  fullyQualifiedName ?? name ?? ''
              ),
            }
          : {}),
        metricExpression: {
          language: values.language,
          code: expressionCode,
        },
      };
      const metric = await createMetric(payload);
      navigate(
        getEntityDetailsPath(
          EntityType.METRIC,
          metric.fullyQualifiedName ?? metric.name
        )
      );
    } catch (error) {
      if (createdGroupId) {
        try {
          await deleteMetricGroup(createdGroupId, true);
        } catch {
          // The create failure remains the actionable error; cleanup can be retried by an admin.
        }
      }
      showErrorToast(error as AxiosError);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main
      className="tw:min-h-full tw:bg-secondary tw:px-4 tw:py-6 tw:md:px-6"
      data-testid="add-metric-container">
      <DocumentTitle title={title} />
      <Box
        className="tw:mx-auto tw:w-full tw:max-w-5xl"
        direction="col"
        gap={5}>
        <Breadcrumbs autoCollapse items={breadcrumbs} size="sm" />
        <Box direction="col" gap={1}>
          <Typography size="display-xs" weight="semibold">
            <h1 data-testid="heading">{title}</h1>
          </Typography>
          <Typography className="tw:text-tertiary" size="text-sm">
            {t('message.metric-description')}
          </Typography>
        </Box>
        <Box className="tw:grid tw:grid-cols-1 tw:items-start tw:gap-5 tw:lg:grid-cols-[minmax(0,1fr)_18rem]">
          <Card>
            <Card.Content>
              <form noValidate onSubmit={handleSubmit}>
                <Box direction="col" gap={5}>
                  <Box className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2">
                    <Input
                      isRequired
                      hint={nameError}
                      inputDataTestId="name"
                      isInvalid={Boolean(nameError)}
                      label={t('label.name')}
                      placeholder={t('label.name')}
                      value={values.name}
                      onChange={(name) => {
                        setField('name', name);
                        setNameError(undefined);
                      }}
                    />
                    <Input
                      inputDataTestId="display-name"
                      label={t('label.display-name')}
                      placeholder={t('label.display-name')}
                      value={values.displayName}
                      onChange={(displayName) =>
                        setField('displayName', displayName)
                      }
                    />
                  </Box>
                  <TextArea
                    label={t('label.description')}
                    placeholder={t('label.description')}
                    rows={5}
                    value={values.description}
                    onChange={(description) =>
                      setField('description', description)
                    }
                  />
                  <Box className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2">
                    <Select
                      label={t('label.metric-type')}
                      placeholder={t('label.select-field', {
                        field: t('label.metric-type'),
                      })}
                      selectedKey={values.metricType ?? null}
                      onSelectionChange={(key) =>
                        setField('metricType', key as MetricType)
                      }>
                      {Object.values(MetricType).map((metricType) => (
                        <Select.Item
                          id={metricType}
                          key={metricType}
                          label={getMetricEnumLabel(t, metricType)}
                        />
                      ))}
                    </Select>
                    <Select
                      label={t('label.granularity')}
                      placeholder={t('label.select-field', {
                        field: t('label.granularity'),
                      })}
                      selectedKey={values.granularity ?? null}
                      onSelectionChange={(key) =>
                        setField('granularity', key as MetricGranularity)
                      }>
                      {Object.values(MetricGranularity).map((granularity) => (
                        <Select.Item
                          id={granularity}
                          key={granularity}
                          label={getMetricEnumLabel(t, granularity)}
                        />
                      ))}
                    </Select>
                    <Select
                      label={t('label.unit-of-measurement')}
                      placeholder={t('label.select-field', {
                        field: t('label.unit-of-measurement'),
                      })}
                      selectedKey={values.unitOfMeasurement ?? null}
                      onSelectionChange={(key) => {
                        setField('unitOfMeasurement', key as UnitOfMeasurement);
                        setCustomUnitError(undefined);
                      }}>
                      {Object.values(UnitOfMeasurement).map((unit) => (
                        <Select.Item
                          id={unit}
                          key={unit}
                          label={getMetricEnumLabel(t, unit)}
                        />
                      ))}
                    </Select>
                    {values.unitOfMeasurement === UnitOfMeasurement.Other && (
                      <Input
                        isRequired
                        hint={customUnitError}
                        inputDataTestId="custom-unit"
                        isInvalid={Boolean(customUnitError)}
                        label={t('label.enter-custom-unit-of-measurement')}
                        value={values.customUnitOfMeasurement}
                        onChange={(customUnitOfMeasurement) => {
                          setField(
                            'customUnitOfMeasurement',
                            customUnitOfMeasurement
                          );
                          setCustomUnitError(undefined);
                        }}
                      />
                    )}
                  </Box>
                  {parentMetricFqn ? (
                    <Alert
                      data-testid="metric-group-inherited"
                      title={t('label.parent-metric')}
                      variant="brand">
                      {parentMetricFqn}
                    </Alert>
                  ) : (
                    <Box
                      data-testid="metric-group-field"
                      direction="col"
                      gap={2}>
                      <Typography size="text-sm" weight="medium">
                        {t('label.metric-group')}
                      </Typography>
                      <MetricGroupSelect
                        value={values.metricGroup}
                        onChange={handleMetricGroupChange}
                      />
                      <Typography className="tw:text-tertiary" size="text-xs">
                        {t('message.metric-group-optional')}
                      </Typography>
                    </Box>
                  )}
                  <Card size="sm">
                    <Card.Header title={t('label.metadata')} />
                    <Card.Content>
                      <Box direction="col" gap={3}>
                        <MetricReferencePicker
                          label={t('label.owner-plural')}
                          searchIndexes={[SearchIndex.USER, SearchIndex.TEAM]}
                          selected={values.owners}
                          onChange={(owners) => setField('owners', owners)}
                        />
                        <MetricReferencePicker
                          label={t('label.reviewer-plural')}
                          searchIndexes={[SearchIndex.USER, SearchIndex.TEAM]}
                          selected={values.reviewers}
                          onChange={(reviewers) =>
                            setField('reviewers', reviewers)
                          }
                        />
                        <MetricReferencePicker
                          label={t('label.expert-plural')}
                          searchIndexes={[SearchIndex.USER]}
                          selected={values.experts}
                          onChange={(experts) => setField('experts', experts)}
                        />
                        <MetricReferencePicker
                          label={t('label.domain-plural')}
                          searchIndexes={[SearchIndex.DOMAIN]}
                          selected={values.domains}
                          onChange={(domains) => setField('domains', domains)}
                        />
                        <MetricReferencePicker
                          label={t('label.related-metric-plural')}
                          searchIndexes={[SearchIndex.METRIC]}
                          selected={values.relatedMetrics}
                          onChange={(relatedMetrics) =>
                            setField('relatedMetrics', relatedMetrics)
                          }
                        />
                      </Box>
                    </Card.Content>
                  </Card>
                  <Card color="brandOutlined" size="sm">
                    <Card.Header title={t('label.expression')} />
                    <Card.Content>
                      <Box direction="col" gap={4}>
                        <Select
                          label={t('label.language')}
                          selectedKey={values.language}
                          onSelectionChange={(key) =>
                            setField('language', key as Language)
                          }>
                          {Object.values(Language).map((language) => (
                            <Select.Item
                              id={language}
                              key={language}
                              label={getMetricEnumLabel(t, language)}
                            />
                          ))}
                        </Select>
                        <TextArea
                          isRequired
                          data-testid="metric-code"
                          hint={codeError}
                          isInvalid={Boolean(codeError)}
                          label={t('label.code')}
                          rows={8}
                          textAreaRef={undefined}
                          value={values.code}
                          onChange={(code) => {
                            setField('code', code);
                            setCodeError(undefined);
                          }}
                        />
                      </Box>
                    </Card.Content>
                  </Card>
                  <Box gap={3} justify="end">
                    <Button
                      color="secondary"
                      data-testid="back-button"
                      iconLeading={ArrowLeft}
                      type="button"
                      onPress={() => navigate(ROUTES.METRICS)}>
                      {t('label.back')}
                    </Button>
                    <Button
                      color="primary"
                      data-testid="create-button"
                      iconLeading={Plus}
                      isDisabled={isCreating}
                      isLoading={isCreating}
                      type="submit">
                      {t('label.create')}
                    </Button>
                  </Box>
                </Box>
              </form>
            </Card.Content>
          </Card>
          <Card className="tw:sticky tw:top-4" color="brand" size="sm">
            <Card.Header title={t('label.metric')} />
            <Card.Content>
              <Typography className="tw:text-secondary" size="text-sm">
                {t('message.metric-description')}
              </Typography>
            </Card.Content>
          </Card>
        </Box>
      </Box>
    </main>
  );
};

export default AddMetricPage;
