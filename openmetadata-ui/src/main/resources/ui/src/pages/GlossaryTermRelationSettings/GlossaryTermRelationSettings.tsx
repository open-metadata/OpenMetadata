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

import { CheckOutlined, CloseOutlined, LockOutlined } from '@ant-design/icons';
import {
  AutoComplete,
  Button,
  Col,
  Drawer,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CloseIcon } from '../../assets/svg/close.svg';
import Table from '../../components/common/Table/Table';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import {
  GlossaryTermRelationSettings,
  GlossaryTermRelationType,
  RelationCardinality,
} from '../../generated/configuration/glossaryTermRelationSettings';
import { useAuth } from '../../hooks/authHooks';
import {
  getGlossaryTermRelationSettings,
  getRelationTypeUsageCounts,
  updateGlossaryTermRelationSettings,
} from '../../rest/glossaryAPI';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

const CATEGORY_OPTIONS = [
  { label: 'Hierarchical', value: 'hierarchical' },
  { label: 'Associative', value: 'associative' },
  { label: 'Equivalence', value: 'equivalence' },
];

const CATEGORY_STYLES: Record<
  string,
  { background: string; border: string; text: string }
> = {
  hierarchical: {
    background: '#e8f4ee',
    border: '#7bc47f',
    text: '#1e5d2a',
  },
  associative: {
    background: '#e8f0fe',
    border: '#7da6ff',
    text: '#1d4ed8',
  },
  equivalence: {
    background: '#f3e8ff',
    border: '#c084fc',
    text: '#6d28d9',
  },
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
  const [form] = Form.useForm();
  const rdfPredicateValue = Form.useWatch('rdfPredicate', form);

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.GOVERNANCE,
        t('label.glossary-term-relation-plural')
      ),
    [t]
  );

  const cardinalityOptions = useMemo(
    () => [
      { label: t('label.one-to-one'), value: RelationCardinality.OneToOne },
      { label: t('label.one-to-many'), value: RelationCardinality.OneToMany },
      { label: t('label.many-to-one'), value: RelationCardinality.ManyToOne },
      { label: t('label.many-to-many'), value: RelationCardinality.ManyToMany },
      { label: t('label.custom'), value: RelationCardinality.Custom },
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
        return <Tag>{label}</Tag>;
      }

      const sourceLabel =
        relation.sourceMax === null || relation.sourceMax === undefined
          ? t('label.unlimited')
          : relation.sourceMax;
      const targetLabel =
        relation.targetMax === null || relation.targetMax === undefined
          ? t('label.unlimited')
          : relation.targetMax;

      return (
        <div className="d-flex flex-column gap-1">
          <Tag>{label}</Tag>
          <Typography.Text style={{ fontSize: 12 }} type="secondary">
            {t('label.source')}: {sourceLabel}, {t('label.target')}:{' '}
            {targetLabel}
          </Typography.Text>
        </div>
      );
    },
    [cardinalityLabels, t]
  );

  const rdfPredicateOptions = useMemo(() => {
    const uniquePredicates = new Set<string>();
    (settings?.relationTypes ?? []).forEach((relationType) => {
      const predicate = relationType.rdfPredicate;
      if (predicate) {
        uniquePredicates.add(predicate);
      }
    });

    return Array.from(uniquePredicates).map((predicate) => ({
      label: predicate,
      value: predicate,
    }));
  }, [settings]);

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
    const predicate = rdfPredicateValue?.trim();
    if (!predicate) {
      return null;
    }
    const usedBy = rdfPredicateUsage.get(predicate);
    if (!usedBy || usedBy.length === 0) {
      return null;
    }
    const filtered = usedBy.filter((name) => name !== editingRelation?.name);

    return filtered.length > 0 ? filtered : null;
  }, [rdfPredicateValue, rdfPredicateUsage, editingRelation]);

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
    form.resetFields();
    form.setFieldsValue({
      isSymmetric: false,
      isTransitive: false,
      isCrossGlossaryAllowed: true,
      category: 'associative',
      cardinality: RelationCardinality.ManyToMany,
      sourceMax: null,
      targetMax: null,
    });
    setIsModalOpen(true);
  }, [form]);

  const handleEdit = useCallback(
    (relation: GlossaryTermRelationType) => {
      if (relation.isSystemDefined) {
        return;
      }
      setEditingRelation(relation);
      form.setFieldsValue(applyCardinalityDefaults(relation));
      setIsModalOpen(true);
    },
    [form]
  );

  const handleDelete = useCallback(
    async (relationName: string) => {
      if (!settings) {
        return;
      }

      try {
        setSaving(true);
        const updatedRelationTypes = settings.relationTypes.filter(
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
    try {
      const values = await form.validateFields();
      setSaving(true);

      const newRelation = applyCardinalityDefaults({
        ...(values as GlossaryTermRelationType),
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
      if ((error as { errorFields?: unknown[] }).errorFields) {
        return;
      }
      showErrorToast(
        error as AxiosError,
        t('server.update-entity-error', {
          entity: t('label.relation-type'),
        })
      );
    } finally {
      setSaving(false);
    }
  }, [form, editingRelation, settings, t]);

  const handleModalCancel = useCallback(() => {
    setIsModalOpen(false);
    setEditingRelation(null);
    form.resetFields();
  }, [form]);

  const drawerFooter = (
    <Space className="w-full justify-end">
      <Button data-testid="cancel-btn" onClick={handleModalCancel}>
        {t('label.cancel')}
      </Button>
      <Button
        data-testid="save-btn"
        loading={saving}
        type="primary"
        onClick={handleModalOk}>
        {editingRelation ? t('label.update') : t('label.add')}
      </Button>
    </Space>
  );

  const columns: ColumnsType<GlossaryTermRelationType> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        width: 160,
        ellipsis: true,
        render: (name: string, record) => (
          <div className="d-flex items-center gap-2">
            <Typography.Text strong data-testid={`relation-name-${name}`}>
              {name}
            </Typography.Text>
            {record.isSystemDefined && (
              <Tooltip title={t('label.system-defined')}>
                <LockOutlined
                  className="text-grey-muted"
                  data-testid={`system-defined-${name}`}
                />
              </Tooltip>
            )}
          </div>
        ),
      },
      {
        title: t('label.display-name'),
        dataIndex: 'displayName',
        key: 'displayName',
        width: 180,
        ellipsis: true,
      },
      {
        title: t('label.category'),
        dataIndex: 'category',
        key: 'category',
        width: 140,
        render: (category: string) => {
          const style = CATEGORY_STYLES[category] ?? {
            background: '#f5f5f5',
            border: '#d9d9d9',
            text: '#595959',
          };

          return (
            <Tag
              style={{
                backgroundColor: style.background,
                borderColor: style.border,
                color: style.text,
                fontWeight: 500,
                textTransform: 'capitalize',
              }}>
              {category}
            </Tag>
          );
        },
      },
      {
        title: t('label.inverse'),
        dataIndex: 'inverseRelation',
        key: 'inverseRelation',
        width: 140,
        ellipsis: true,
        render: (inverse?: string) => inverse || '-',
      },
      {
        title: t('label.symmetric'),
        dataIndex: 'isSymmetric',
        key: 'isSymmetric',
        width: 90,
        align: 'center',
        render: (isSymmetric?: boolean) =>
          isSymmetric ? (
            <CheckOutlined className="text-success" />
          ) : (
            <CloseOutlined className="text-grey-muted" />
          ),
      },
      {
        title: t('label.transitive'),
        dataIndex: 'isTransitive',
        key: 'isTransitive',
        width: 90,
        align: 'center',
        render: (isTransitive?: boolean) =>
          isTransitive ? (
            <CheckOutlined className="text-success" />
          ) : (
            <CloseOutlined className="text-grey-muted" />
          ),
      },
      {
        title: t('label.cross-glossary'),
        dataIndex: 'isCrossGlossaryAllowed',
        key: 'isCrossGlossaryAllowed',
        width: 120,
        align: 'center',
        render: (allowed?: boolean) =>
          allowed ? (
            <CheckOutlined className="text-success" />
          ) : (
            <CloseOutlined className="text-grey-muted" />
          ),
      },
      {
        title: t('label.cardinality'),
        dataIndex: 'cardinality',
        key: 'cardinality',
        width: 140,
        render: (_, record) => renderCardinality(record),
      },
      {
        title: t('label.color'),
        dataIndex: 'color',
        key: 'color',
        width: 140,
        render: (color?: string) =>
          color ? (
            <div className="d-flex items-center gap-2">
              <div
                style={{
                  width: 20,
                  height: 20,
                  backgroundColor: color,
                  borderRadius: 4,
                  border: '1px solid #d9d9d9',
                }}
              />
              <Typography.Text code>{color}</Typography.Text>
            </div>
          ) : (
            '-'
          ),
      },
      {
        title: t('label.usage'),
        key: 'usage',
        width: 90,
        align: 'center',
        render: (_, record) => {
          const count = usageCounts[record.name] || 0;

          return (
            <Tooltip
              title={
                count > 0
                  ? t('message.relation-type-in-use-count', { count })
                  : t('message.relation-type-not-in-use')
              }>
              <Tag
                color={count > 0 ? 'blue' : 'default'}
                data-testid={`usage-count-${record.name}`}>
                {count}
              </Tag>
            </Tooltip>
          );
        },
      },
      {
        title: t('label.action-plural'),
        key: 'actions',
        width: 140,
        align: 'right',
        render: (_, record) => {
          const count = usageCounts[record.name] || 0;
          const isInUse = count > 0;

          return (
            <div className="d-flex justify-end gap-2">
              <Button
                data-testid={`edit-${record.name}-btn`}
                disabled={record.isSystemDefined}
                size="small"
                type="link"
                onClick={() => handleEdit(record)}>
                {t('label.edit')}
              </Button>
              {!record.isSystemDefined && (
                <Tooltip
                  title={
                    isInUse
                      ? t('message.cannot-delete-relation-type-in-use', {
                          count,
                        })
                      : undefined
                  }>
                  <Button
                    danger
                    data-testid={`delete-${record.name}-btn`}
                    disabled={saving || isInUse}
                    size="small"
                    type="link"
                    onClick={() => handleDelete(record.name)}>
                    {t('label.delete')}
                  </Button>
                </Tooltip>
              )}
            </div>
          );
        },
      },
    ],
    [t, handleEdit, handleDelete, renderCardinality, saving, usageCounts]
  );

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <PageLayoutV1 pageTitle={t('label.glossary-term-relation-plural')}>
      <Row
        align="middle"
        className="p-lg bg-white border-radius-sm"
        gutter={[0, 16]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Col>
        <Col span={24}>
          <Row align="top" justify="space-between">
            <Col>
              <PageHeader
                data={{
                  header: t('label.glossary-term-relation-plural'),
                  subHeader: t(
                    'message.glossary-term-relation-settings-description'
                  ),
                }}
              />
            </Col>
            <Col>
              {isAdminUser && (
                <Button
                  data-testid="add-relation-type-btn"
                  type="primary"
                  onClick={handleAddNew}>
                  {t('label.add-entity', {
                    entity: t('label.relation-type'),
                  })}
                </Button>
              )}
            </Col>
          </Row>
        </Col>
        <Col span={24}>
          <Table
            columns={columns}
            data-testid="relation-types-table"
            dataSource={settings?.relationTypes || []}
            loading={loading}
            pagination={false}
            rowKey="name"
            size="middle"
          />
        </Col>
      </Row>

      <Drawer
        destroyOnClose
        className="custom-drawer-style"
        closable={false}
        data-testid="relation-type-drawer"
        extra={
          <Button
            className="drawer-close-icon flex-center"
            data-testid="drawer-close-btn"
            icon={<CloseIcon />}
            type="link"
            onClick={handleModalCancel}
          />
        }
        footer={drawerFooter}
        open={isModalOpen}
        placement="right"
        title={
          editingRelation
            ? t('label.edit-entity', { entity: t('label.relation-type') })
            : t('label.add-entity', { entity: t('label.relation-type') })
        }
        width={600}
        onClose={handleModalCancel}>
        <Form data-testid="relation-type-form" form={form} layout="vertical">
          <Form.Item
            label={t('label.name')}
            name="name"
            rules={[
              {
                required: true,
                message: t('label.field-required', { field: t('label.name') }),
              },
              {
                pattern: /^[a-zA-Z][a-zA-Z0-9]*$/,
                message: t('message.must-start-with-letter-alphanumeric'),
              },
            ]}>
            <Input
              data-testid="name-input"
              disabled={Boolean(editingRelation)}
              placeholder={t('label.enter-entity', { entity: t('label.name') })}
            />
          </Form.Item>

          <Form.Item
            label={t('label.display-name')}
            name="displayName"
            rules={[
              {
                required: true,
                message: t('label.field-required', {
                  field: t('label.display-name'),
                }),
              },
            ]}>
            <Input
              data-testid="display-name-input"
              placeholder={t('label.enter-entity', {
                entity: t('label.display-name'),
              })}
            />
          </Form.Item>

          <Form.Item label={t('label.description')} name="description">
            <Input.TextArea
              data-testid="description-input"
              placeholder={t('label.enter-entity', {
                entity: t('label.description'),
              })}
              rows={3}
            />
          </Form.Item>

          <Form.Item
            label={t('label.category')}
            name="category"
            rules={[{ required: true }]}>
            <Select data-testid="category-select" options={CATEGORY_OPTIONS} />
          </Form.Item>

          <Form.Item
            label={t('label.inverse-relation')}
            name="inverseRelation"
            tooltip={t('message.inverse-relation-tooltip')}>
            <Input
              data-testid="inverse-relation-input"
              placeholder={t('label.enter-entity', {
                entity: t('label.inverse-relation'),
              })}
            />
          </Form.Item>

          <Form.Item
            help={
              rdfPredicateDuplicates
                ? `${t('label.used-by')}: ${rdfPredicateDuplicates.join(', ')}`
                : undefined
            }
            label={t('label.rdf-predicate')}
            name="rdfPredicate"
            tooltip={t('message.rdf-predicate-tooltip')}
            validateStatus={rdfPredicateDuplicates ? 'warning' : undefined}>
            <AutoComplete
              className="w-full"
              data-testid="rdf-predicate-input"
              filterOption={(inputValue, option) =>
                (option?.value ?? '')
                  .toString()
                  .toLowerCase()
                  .includes(inputValue.toLowerCase())
              }
              options={rdfPredicateOptions}
              placeholder="http://www.w3.org/2004/02/skos/core#broader"
            />
          </Form.Item>

          <Form.Item
            label={t('label.cardinality')}
            name="cardinality"
            rules={[
              {
                required: true,
                message: t('label.field-required', {
                  field: t('label.cardinality'),
                }),
              },
            ]}>
            <Select
              data-testid="cardinality-select"
              options={cardinalityOptions}
            />
          </Form.Item>

          <Form.Item
            label={t('label.color')}
            name="color"
            tooltip={t('message.relation-color-tooltip')}>
            <Input
              data-testid="color-input"
              placeholder="#1890ff"
              style={{ width: 150 }}
              suffix={
                <Form.Item noStyle shouldUpdate>
                  {({ getFieldValue }) => (
                    <div
                      data-testid="color-preview"
                      style={{
                        width: 16,
                        height: 16,
                        backgroundColor: getFieldValue('color') || '#d9d9d9',
                        borderRadius: 2,
                        border: '1px solid #d9d9d9',
                      }}
                    />
                  )}
                </Form.Item>
              }
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label={t('label.symmetric')}
                name="isSymmetric"
                valuePropName="checked">
                <Switch data-testid="symmetric-switch" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label={t('label.transitive')}
                name="isTransitive"
                valuePropName="checked">
                <Switch data-testid="transitive-switch" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label={t('label.cross-glossary')}
                name="isCrossGlossaryAllowed"
                valuePropName="checked">
                <Switch data-testid="cross-glossary-switch" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item noStyle shouldUpdate>
            {({ getFieldValue }) =>
              getFieldValue('cardinality') === RelationCardinality.Custom ? (
                <Row gutter={[0, 12]}>
                  <Col span={24}>
                    <Form.Item
                      label={`${t('label.source')} ${t('label.max')}`}
                      name="sourceMax">
                      <InputNumber
                        className="w-full"
                        data-testid="source-max-input"
                        min={1}
                        placeholder={t('label.unlimited')}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item
                      label={`${t('label.target')} ${t('label.max')}`}
                      name="targetMax">
                      <InputNumber
                        className="w-full"
                        data-testid="target-max-input"
                        min={1}
                        placeholder={t('label.unlimited')}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              ) : null
            }
          </Form.Item>
        </Form>
      </Drawer>
    </PageLayoutV1>
  );
}

export default GlossaryTermRelationSettingsPage;
