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
  Button,
  Card,
  Divider,
  Input,
  Select,
  SelectItemType,
  SlideoutMenu,
  Table,
  TableCard,
  TextArea,
  Toggle,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { Check, XClose } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { Key, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import {
  GlossaryTermRelationSettings,
  GlossaryTermRelationType,
  RelationCardinality,
  RelationCategory,
} from '../../generated/configuration/glossaryTermRelationSettings';
import { useAuth } from '../../hooks/authHooks';
import {
  getGlossaryTermRelationSettings,
  getRelationTypeUsageCounts,
  updateGlossaryTermRelationSettings,
} from '../../rest/glossaryAPI';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

const CATEGORY_BADGE_COLORS: Record<
  string,
  'success' | 'blue' | 'purple' | 'gray'
> = {
  hierarchical: 'success',
  associative: 'blue',
  equivalence: 'purple',
};

const CARDINALITY_LIMITS: Record<
  RelationCardinality,
  { sourceMax: number | null; targetMax: number | null }
> = {
  [RelationCardinality.OneToOne]: { sourceMax: 1, targetMax: 1 },
  [RelationCardinality.OneToMany]: { sourceMax: 1, targetMax: null },
  [RelationCardinality.ManyToOne]: { sourceMax: null, targetMax: 1 },
  [RelationCardinality.ManyToMany]: { sourceMax: null, targetMax: null },
  [RelationCardinality.Custom]: { sourceMax: null, targetMax: null },
};

const deriveCardinality = (
  sourceMax?: number | null,
  targetMax?: number | null
): RelationCardinality => {
  if (sourceMax === null || sourceMax === undefined) {
    if (targetMax === null || targetMax === undefined) {
      return RelationCardinality.ManyToMany;
    }
    if (targetMax === 1) {
      return RelationCardinality.ManyToOne;
    }
  }

  if (sourceMax === 1) {
    if (targetMax === 1) {
      return RelationCardinality.OneToOne;
    }
    if (targetMax === null || targetMax === undefined) {
      return RelationCardinality.OneToMany;
    }
  }

  return RelationCardinality.Custom;
};

const applyCardinalityDefaults = (
  relation: GlossaryTermRelationType
): GlossaryTermRelationType => {
  const cardinality =
    relation.cardinality ??
    deriveCardinality(relation.sourceMax, relation.targetMax);

  switch (cardinality) {
    case RelationCardinality.OneToOne:
      return {
        ...relation,
        cardinality,
        ...CARDINALITY_LIMITS[RelationCardinality.OneToOne],
      };
    case RelationCardinality.OneToMany:
      return {
        ...relation,
        cardinality,
        ...CARDINALITY_LIMITS[RelationCardinality.OneToMany],
      };
    case RelationCardinality.ManyToOne:
      return {
        ...relation,
        cardinality,
        ...CARDINALITY_LIMITS[RelationCardinality.ManyToOne],
      };
    case RelationCardinality.ManyToMany:
      return {
        ...relation,
        cardinality,
        ...CARDINALITY_LIMITS[RelationCardinality.ManyToMany],
      };
    case RelationCardinality.Custom:
    default:
      return { ...relation, cardinality };
  }
};

const DEFAULT_FORM_VALUES: Partial<GlossaryTermRelationType> = {
  isSymmetric: false,
  isTransitive: false,
  isCrossGlossaryAllowed: true,
  category: RelationCategory.Associative,
  cardinality: RelationCardinality.ManyToMany,
  sourceMax: undefined,
  targetMax: undefined,
};

function GlossaryTermRelationSettingsPage() {
  const { t } = useTranslation();
  const { isAdminUser } = useAuth();
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [settings, setSettings] = useState<GlossaryTermRelationSettings | null>(
    null
  );
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingRelation, setEditingRelation] =
    useState<GlossaryTermRelationType | null>(null);
  const [formValues, setFormValues] =
    useState<Partial<GlossaryTermRelationType>>(DEFAULT_FORM_VALUES);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.GOVERNANCE,
        t('label.glossary-term-relation-plural')
      ),
    [t]
  );

  const categoryOptions: SelectItemType[] = useMemo(
    () => [
      { id: RelationCategory.Hierarchical, label: t('label.hierarchical') },
      { id: RelationCategory.Associative, label: t('label.associative') },
      { id: RelationCategory.Equivalence, label: t('label.equivalence') },
    ],
    [t]
  );

  const cardinalityOptions: SelectItemType[] = useMemo(
    () => [
      { id: RelationCardinality.OneToOne, label: t('label.one-to-one') },
      { id: RelationCardinality.OneToMany, label: t('label.one-to-many') },
      { id: RelationCardinality.ManyToOne, label: t('label.many-to-one') },
      { id: RelationCardinality.ManyToMany, label: t('label.many-to-many') },
      { id: RelationCardinality.Custom, label: t('label.custom') },
    ],
    [t]
  );

  const cardinalityLabels = useMemo(
    () => ({
      [RelationCardinality.OneToOne]: t('label.one-to-one'),
      [RelationCardinality.OneToMany]: t('label.one-to-many'),
      [RelationCardinality.ManyToOne]: t('label.many-to-one'),
      [RelationCardinality.ManyToMany]: t('label.many-to-many'),
      [RelationCardinality.Custom]: t('label.custom'),
    }),
    [t]
  );

  const renderCardinality = useCallback(
    (relation: GlossaryTermRelationType) => {
      const derived =
        relation.cardinality ??
        deriveCardinality(relation.sourceMax, relation.targetMax);
      const label = cardinalityLabels[derived];
      if (derived !== RelationCardinality.Custom) {
        return (
          <Badge color="gray" type="color">
            {label}
          </Badge>
        );
      }

      const sourceLabel = relation.sourceMax ?? t('label.unlimited');
      const targetLabel = relation.targetMax ?? t('label.unlimited');

      return (
        <div className="tw:flex tw:flex-col tw:gap-1">
          <Badge color="gray" type="color">
            {label}
          </Badge>
          <Typography as="span" className="tw:text-xs tw:text-tertiary">
            {t('label.source')}: {sourceLabel}, {t('label.target')}:{' '}
            {targetLabel}
          </Typography>
        </div>
      );
    },
    [cardinalityLabels, t]
  );

  const rdfPredicateUsage = useMemo(() => {
    const usageMap = new Map<string, string[]>();
    (settings?.relationTypes ?? []).forEach((relationType) => {
      const predicate = relationType.rdfPredicate?.trim();
      if (!predicate) {
        return;
      }
      const existing = usageMap.get(predicate) ?? [];
      usageMap.set(predicate, [...existing, relationType.name]);
    });

    return usageMap;
  }, [settings]);

  const rdfPredicateDuplicates = useMemo(() => {
    const predicate = formValues.rdfPredicate?.trim();
    if (!predicate) {
      return null;
    }
    const usedBy = rdfPredicateUsage.get(predicate);
    if (!usedBy || usedBy.length === 0) {
      return null;
    }
    const filtered = usedBy.filter((name) => name !== editingRelation?.name);

    return filtered.length > 0 ? filtered : null;
  }, [formValues.rdfPredicate, rdfPredicateUsage, editingRelation]);

  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (!formValues.name) {
      errors.name = t('label.field-required', { field: t('label.name') });
    } else if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(formValues.name)) {
      errors.name = t('message.must-start-with-letter-alphanumeric');
    }

    if (!formValues.displayName) {
      errors.displayName = t('label.field-required', {
        field: t('label.display-name'),
      });
    }

    if (!formValues.cardinality) {
      errors.cardinality = t('label.field-required', {
        field: t('label.cardinality'),
      });
    }

    setFormErrors(errors);

    return Object.keys(errors).length === 0;
  }, [formValues, t]);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const [settingsData, usageData] = await Promise.all([
        getGlossaryTermRelationSettings(),
        getRelationTypeUsageCounts(),
      ]);
      setSettings(settingsData as GlossaryTermRelationSettings);
      setUsageCounts(usageData);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.glossary-term-relation-plural'),
        })
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  const handleAddNew = useCallback(() => {
    setEditingRelation(null);
    setFormValues({ ...DEFAULT_FORM_VALUES });
    setFormErrors({});
    setIsModalOpen(true);
  }, []);

  const handleEdit = useCallback((relation: GlossaryTermRelationType) => {
    if (relation.isSystemDefined) {
      return;
    }
    setEditingRelation(relation);
    setFormValues(applyCardinalityDefaults(relation));
    setFormErrors({});
    setIsModalOpen(true);
  }, []);

  const handleDelete = useCallback(
    async (relationName: string) => {
      if (!settings) {
        return;
      }

      try {
        setSaving(true);
        const updatedRelationTypes = (settings.relationTypes ?? []).filter(
          (r) => r.name !== relationName
        );
        await updateGlossaryTermRelationSettings({
          relationTypes: updatedRelationTypes,
        });
        setSettings({ relationTypes: updatedRelationTypes });
        showSuccessToast(
          t('server.delete-entity-success', {
            entity: t('label.relation-type'),
          })
        );
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.delete-entity-error', {
            entity: t('label.relation-type'),
          })
        );
      } finally {
        setSaving(false);
      }
    },
    [settings, t]
  );

  const handleModalOk = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);

      const newRelation = applyCardinalityDefaults({
        ...(formValues as GlossaryTermRelationType),
        isSystemDefined: false,
      });

      let updatedRelationTypes: GlossaryTermRelationType[];

      if (editingRelation) {
        updatedRelationTypes = (settings?.relationTypes || []).map((r) =>
          r.name === editingRelation.name ? newRelation : r
        );
      } else {
        updatedRelationTypes = [
          ...(settings?.relationTypes || []),
          newRelation,
        ];
      }

      await updateGlossaryTermRelationSettings({
        relationTypes: updatedRelationTypes,
      });
      setSettings({ relationTypes: updatedRelationTypes });
      setIsModalOpen(false);
      showSuccessToast(
        t('server.update-entity-success', {
          entity: t('label.relation-type'),
        })
      );
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.update-entity-error', {
          entity: t('label.relation-type'),
        })
      );
    } finally {
      setSaving(false);
    }
  }, [validateForm, formValues, editingRelation, settings, t]);

  const handleModalCancel = useCallback(() => {
    setIsModalOpen(false);
    setEditingRelation(null);
    setFormValues({ ...DEFAULT_FORM_VALUES });
    setFormErrors({});
  }, []);

  const updateFormField = useCallback(
    <K extends keyof GlossaryTermRelationType>(
      field: K,
      value: GlossaryTermRelationType[K] | undefined
    ) => {
      setFormValues((prev) => ({ ...prev, [field]: value }));
      setFormErrors((prev) => {
        if (!prev[field]) {
          return prev;
        }
        const next = { ...prev };
        delete next[field];

        return next;
      });
    },
    []
  );

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <PageLayoutV1 pageTitle={t('label.glossary-term-relation-plural')}>
      <div className="tw:flex tw:flex-col tw:gap-4">
        <TitleBreadcrumb titleLinks={breadcrumbs} />

        <Card className="tw:flex tw:items-center tw:justify-between tw:p-6">
          <div className="tw:flex tw:flex-col tw:gap-1">
            <Typography as="h4" className="tw:font-semibold">
              {t('label.glossary-term-relation-plural')}
            </Typography>
            <Typography
              as="p"
              className="tw:text-xs tw:font-normal tw:text-secondary">
              {t('message.glossary-term-relation-settings-description')}
            </Typography>
          </div>
          {isAdminUser && (
            <Button
              color="primary"
              data-testid="add-relation-type-btn"
              size="sm"
              onClick={handleAddNew}>
              {t('label.add-entity', {
                entity: t('label.relation-type'),
              })}
            </Button>
          )}
        </Card>

        <div>
          {loading ? (
            <div className="tw:py-8 tw:text-center tw:text-sm tw:text-tertiary">
              {t('label.loading')}
            </div>
          ) : (
            <TableCard.Root size="sm">
              <Table
                className="tw:table-fixed tw:w-full"
                data-testid="relation-types-table">
                <Table.Header>
                  <Table.Head
                    className="tw:w-[9%]"
                    id="col-name"
                    label={t('label.name')}
                  />
                  <Table.Head
                    className="tw:w-[11%]"
                    id="col-display-name"
                    label={t('label.display-name')}
                  />
                  <Table.Head
                    className="tw:w-[9%]"
                    id="col-category"
                    label={t('label.category')}
                  />
                  <Table.Head
                    className="tw:w-[9%]"
                    id="col-inverse"
                    label={t('label.inverse')}
                  />
                  <Table.Head
                    className="tw:w-[7%]"
                    id="col-symmetric"
                    label={t('label.symmetric')}
                  />
                  <Table.Head
                    className="tw:w-[7%]"
                    id="col-transitive"
                    label={t('label.transitive')}
                  />
                  <Table.Head
                    className="tw:w-[8%]"
                    id="col-cross-glossary"
                    label={t('label.cross-glossary')}
                  />
                  <Table.Head
                    className="tw:w-[11%]"
                    id="col-cardinality"
                    label={t('label.cardinality')}
                  />
                  <Table.Head
                    className="tw:w-[9%]"
                    id="col-color"
                    label={t('label.color')}
                  />
                  <Table.Head
                    className="tw:w-[6%]"
                    id="col-usage"
                    label={t('label.usage')}
                  />
                  <Table.Head
                    className="tw:w-[14%]"
                    id="col-actions"
                    label={t('label.action-plural')}
                  />
                </Table.Header>
                <Table.Body items={settings?.relationTypes || []}>
                  {(record: GlossaryTermRelationType) => {
                    const count = usageCounts[record.name] || 0;
                    const isInUse = count > 0;

                    return (
                      <Table.Row id={record.name} key={record.name}>
                        <Table.Cell className="tw:max-w-0 tw:overflow-hidden">
                          <Tooltip placement="top" title={record.name}>
                            <TooltipTrigger className="tw:block tw:w-full tw:min-w-0">
                              <Typography
                                as="span"
                                className="tw:font-semibold tw:text-primary tw:truncate tw:block"
                                data-testid={`relation-name-${record.name}`}>
                                {record.name}
                              </Typography>
                            </TooltipTrigger>
                          </Tooltip>
                        </Table.Cell>
                        <Table.Cell className="tw:max-w-0 tw:overflow-hidden">
                          <Tooltip placement="top" title={record.displayName}>
                            <TooltipTrigger className="tw:block tw:w-full tw:min-w-0">
                              <Typography
                                as="span"
                                className="tw:truncate tw:block">
                                {record.displayName}
                              </Typography>
                            </TooltipTrigger>
                          </Tooltip>
                        </Table.Cell>
                        <Table.Cell className="tw:whitespace-nowrap">
                          <Badge
                            className="tw:capitalize"
                            color={
                              CATEGORY_BADGE_COLORS[record.category ?? ''] ??
                              'gray'
                            }
                            type="color">
                            {record.category}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell className="tw:max-w-0 tw:overflow-hidden">
                          <Tooltip
                            placement="top"
                            title={record.inverseRelation || ''}>
                            <TooltipTrigger className="tw:block tw:w-full tw:min-w-0">
                              <Typography
                                as="span"
                                className="tw:truncate tw:block">
                                {record.inverseRelation || '-'}
                              </Typography>
                            </TooltipTrigger>
                          </Tooltip>
                        </Table.Cell>
                        <Table.Cell className="tw:text-center">
                          <div className="tw:flex tw:justify-center">
                            {record.isSymmetric ? (
                              <Check className="tw:size-4 tw:text-success-500" />
                            ) : (
                              <XClose className="tw:size-4 tw:text-tertiary" />
                            )}
                          </div>
                        </Table.Cell>
                        <Table.Cell className="tw:text-center">
                          <div className="tw:flex tw:justify-center">
                            {record.isTransitive ? (
                              <Check className="tw:size-4 tw:text-success-500" />
                            ) : (
                              <XClose className="tw:size-4 tw:text-tertiary" />
                            )}
                          </div>
                        </Table.Cell>
                        <Table.Cell className="tw:text-center">
                          <div className="tw:flex tw:justify-center">
                            {record.isCrossGlossaryAllowed ? (
                              <Check className="tw:size-4 tw:text-success-500" />
                            ) : (
                              <XClose className="tw:size-4 tw:text-tertiary" />
                            )}
                          </div>
                        </Table.Cell>
                        <Table.Cell className="tw:whitespace-nowrap">
                          {renderCardinality(record)}
                        </Table.Cell>
                        <Table.Cell className="tw:overflow-hidden">
                          {record.color ? (
                            <div className="tw:flex tw:items-center tw:gap-2 tw:min-w-0 tw:overflow-hidden">
                              <div
                                className="tw:size-4 tw:rounded tw:border tw:border-secondary tw:shrink-0"
                                style={{ backgroundColor: record.color }}
                              />
                              <Tooltip placement="top" title={record.color}>
                                <TooltipTrigger className="tw:block tw:min-w-0 tw:overflow-hidden">
                                  <Typography
                                    as="span"
                                    className="tw:text-xs tw:font-mono tw:text-tertiary tw:truncate tw:block">
                                    {record.color}
                                  </Typography>
                                </TooltipTrigger>
                              </Tooltip>
                            </div>
                          ) : (
                            '-'
                          )}
                        </Table.Cell>
                        <Table.Cell className="tw:text-center">
                          <div className="tw:flex tw:justify-center">
                            <Tooltip
                              placement="top"
                              title={
                                isInUse
                                  ? t('message.relation-type-in-use-count', {
                                      count,
                                    })
                                  : t('message.relation-type-not-in-use')
                              }>
                              <TooltipTrigger>
                                <Badge
                                  color={isInUse ? 'brand' : 'gray'}
                                  data-testid={`usage-count-${record.name}`}
                                  type="pill-color">
                                  {count}
                                </Badge>
                              </TooltipTrigger>
                            </Tooltip>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="tw:flex tw:justify-end tw:gap-2 tw:whitespace-nowrap">
                            <span
                              className={
                                record.isSystemDefined
                                  ? 'tw:invisible'
                                  : undefined
                              }>
                              <Button
                                color="tertiary"
                                data-testid={`edit-${record.name}-btn`}
                                size="sm"
                                onClick={() => handleEdit(record)}>
                                {t('label.edit')}
                              </Button>
                            </span>
                            <span
                              className={
                                record.isSystemDefined
                                  ? 'tw:invisible'
                                  : undefined
                              }
                              title={
                                isInUse
                                  ? t(
                                      'message.cannot-delete-relation-type-in-use',
                                      { count }
                                    )
                                  : undefined
                              }>
                              <Button
                                color="tertiary-destructive"
                                data-testid={`delete-${record.name}-btn`}
                                isDisabled={saving || isInUse}
                                size="sm"
                                onClick={() => handleDelete(record.name)}>
                                {t('label.delete')}
                              </Button>
                            </span>
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    );
                  }}
                </Table.Body>
              </Table>
            </TableCard.Root>
          )}
        </div>
        <SlideoutMenu
          data-testid="relation-type-drawer"
          isOpen={isModalOpen}
          width="500"
          onOpenChange={(open) => {
            if (!open) {
              handleModalCancel();
            }
          }}>
          {() => (
            <>
              <SlideoutMenu.Header onClose={handleModalCancel}>
                <Typography as="h4">
                  {editingRelation
                    ? t('label.edit-entity', {
                        entity: t('label.relation-type'),
                      })
                    : t('label.add-entity', {
                        entity: t('label.relation-type'),
                      })}
                </Typography>
              </SlideoutMenu.Header>
              <Divider orientation="horizontal" />

              <SlideoutMenu.Content>
                <div
                  className="tw:flex tw:flex-col tw:gap-4"
                  data-testid="relation-type-form">
                  <Input
                    data-testid="name-input"
                    hint={formErrors.name}
                    isDisabled={Boolean(editingRelation)}
                    isInvalid={Boolean(formErrors.name)}
                    label={t('label.name')}
                    placeholder={t('label.enter-entity', {
                      entity: t('label.name'),
                    })}
                    value={formValues.name ?? ''}
                    onChange={(value) => updateFormField('name', value)}
                  />

                  <Input
                    data-testid="display-name-input"
                    hint={formErrors.displayName}
                    isInvalid={Boolean(formErrors.displayName)}
                    label={t('label.display-name')}
                    placeholder={t('label.enter-entity', {
                      entity: t('label.display-name'),
                    })}
                    value={formValues.displayName ?? ''}
                    onChange={(value) => updateFormField('displayName', value)}
                  />

                  <TextArea
                    data-testid="description-input"
                    label={t('label.description')}
                    placeholder={t('label.enter-entity', {
                      entity: t('label.description'),
                    })}
                    rows={3}
                    value={formValues.description ?? ''}
                    onChange={(value) => updateFormField('description', value)}
                  />

                  <Select
                    data-testid="category-select"
                    items={categoryOptions}
                    label={t('label.category')}
                    value={formValues.category ?? null}
                    onChange={(key: Key | null) =>
                      key &&
                      updateFormField(
                        'category',
                        String(key) as RelationCategory
                      )
                    }>
                    {(item) => <Select.Item {...item} />}
                  </Select>

                  <Input
                    data-testid="inverse-relation-input"
                    label={t('label.inverse-relation')}
                    placeholder={t('label.enter-entity', {
                      entity: t('label.inverse-relation'),
                    })}
                    tooltip={t('message.inverse-relation-tooltip')}
                    value={formValues.inverseRelation ?? ''}
                    onChange={(value) =>
                      updateFormField('inverseRelation', value || undefined)
                    }
                  />

                  <Input
                    data-testid="rdf-predicate-input"
                    hint={
                      rdfPredicateDuplicates
                        ? `${t('label.used-by')}: ${rdfPredicateDuplicates.join(
                            ', '
                          )}`
                        : undefined
                    }
                    isInvalid={Boolean(rdfPredicateDuplicates)}
                    label={t('label.rdf-predicate')}
                    placeholder="http://www.w3.org/2004/02/skos/core#broader"
                    tooltip={t('message.rdf-predicate-tooltip')}
                    value={formValues.rdfPredicate ?? ''}
                    onChange={(value) =>
                      updateFormField('rdfPredicate', value || undefined)
                    }
                  />

                  <Select
                    data-testid="cardinality-select"
                    hint={formErrors.cardinality}
                    isInvalid={Boolean(formErrors.cardinality)}
                    items={cardinalityOptions}
                    label={t('label.cardinality')}
                    value={formValues.cardinality ?? null}
                    onChange={(key: Key | null) =>
                      key &&
                      updateFormField(
                        'cardinality',
                        String(key) as RelationCardinality
                      )
                    }>
                    {(item) => <Select.Item {...item} />}
                  </Select>

                  {formValues.cardinality === RelationCardinality.Custom && (
                    <div className="tw:flex tw:flex-col tw:gap-4">
                      <Input
                        data-testid="source-max-input"
                        label={`${t('label.source')} ${t('label.max')}`}
                        placeholder={t('label.unlimited')}
                        type="number"
                        value={
                          formValues.sourceMax == null
                            ? ''
                            : String(formValues.sourceMax)
                        }
                        onChange={(value) =>
                          updateFormField(
                            'sourceMax',
                            value === '' ? undefined : parseInt(value, 10)
                          )
                        }
                      />
                      <Input
                        data-testid="target-max-input"
                        label={`${t('label.target')} ${t('label.max')}`}
                        placeholder={t('label.unlimited')}
                        type="number"
                        value={
                          formValues.targetMax == null
                            ? ''
                            : String(formValues.targetMax)
                        }
                        onChange={(value) =>
                          updateFormField(
                            'targetMax',
                            value === '' ? undefined : parseInt(value, 10)
                          )
                        }
                      />
                    </div>
                  )}

                  <div>
                    <Input
                      data-testid="color-input"
                      label={t('label.color')}
                      placeholder="#1890ff"
                      tooltip={t('message.relation-color-tooltip')}
                      value={formValues.color ?? ''}
                      onChange={(value) =>
                        updateFormField('color', value || undefined)
                      }
                    />
                    <div className="tw:mt-2 tw:flex tw:items-center tw:gap-2">
                      <div
                        className="tw:size-4 tw:rounded tw:border tw:border-secondary tw:shrink-0"
                        data-testid="color-preview"
                        style={{
                          backgroundColor:
                            formValues.color || 'var(--color-border-secondary)',
                        }}
                      />
                      <Typography
                        as="span"
                        className="tw:text-xs tw:text-tertiary">
                        {formValues.color ||
                          t('label.no-entity', { entity: t('label.color') })}
                      </Typography>
                    </div>
                  </div>

                  <div className="tw:grid tw:grid-cols-3 tw:gap-4">
                    <Toggle
                      data-testid="symmetric-switch"
                      isSelected={formValues.isSymmetric ?? false}
                      label={t('label.symmetric')}
                      size="sm"
                      onChange={(checked) =>
                        updateFormField('isSymmetric', checked)
                      }
                    />
                    <Toggle
                      data-testid="transitive-switch"
                      isSelected={formValues.isTransitive ?? false}
                      label={t('label.transitive')}
                      size="sm"
                      onChange={(checked) =>
                        updateFormField('isTransitive', checked)
                      }
                    />
                    <Toggle
                      data-testid="cross-glossary-switch"
                      isSelected={formValues.isCrossGlossaryAllowed ?? true}
                      label={t('label.cross-glossary')}
                      size="sm"
                      onChange={(checked) =>
                        updateFormField('isCrossGlossaryAllowed', checked)
                      }
                    />
                  </div>
                </div>
              </SlideoutMenu.Content>

              <SlideoutMenu.Footer>
                <div className="tw:flex tw:w-full tw:justify-end tw:gap-2">
                  <Button
                    color="secondary"
                    data-testid="cancel-btn"
                    size="sm"
                    onClick={handleModalCancel}>
                    {t('label.cancel')}
                  </Button>
                  <Button
                    color="primary"
                    data-testid="save-btn"
                    isLoading={saving}
                    size="sm"
                    onClick={handleModalOk}>
                    {editingRelation ? t('label.update') : t('label.add')}
                  </Button>
                </div>
              </SlideoutMenu.Footer>
            </>
          )}
        </SlideoutMenu>
      </div>
    </PageLayoutV1>
  );
}

export default GlossaryTermRelationSettingsPage;
