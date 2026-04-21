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

import { DeleteOutlined, DownOutlined, EditOutlined } from '@ant-design/icons';
import {
  Button,
  Dropdown,
  MenuProps,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import { CreateIntakeForm } from '../../generated/api/governance/createIntakeForm';
import {
  FieldKind,
  IntakeForm,
  TargetEntityType,
} from '../../generated/governance/intakeForm';
import {
  createIntakeForm,
  createOrUpdateIntakeForm,
  deleteIntakeForm,
  listIntakeForms,
  patchIntakeForm,
} from '../../rest/intakeFormsAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import IntakeFormDesignerModal from './IntakeFormDesignerModal';

const ENTITY_TYPE_LABEL_KEYS: Record<TargetEntityType, string> = {
  [TargetEntityType.DataProduct]: 'label.data-product',
  [TargetEntityType.Domain]: 'label.domain',
  [TargetEntityType.GlossaryTerm]: 'label.glossary-term',
};

const IntakeFormsPage = () => {
  const { t } = useTranslation();
  const entityTypeLabel = useCallback(
    (et: TargetEntityType) => t(ENTITY_TYPE_LABEL_KEYS[et]),
    [t]
  );
  const [forms, setForms] = useState<IntakeForm[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalState, setModalState] = useState<{
    open: boolean;
    entityType: TargetEntityType;
    initialValue: IntakeForm | null;
  }>({
    open: false,
    entityType: TargetEntityType.DataProduct,
    initialValue: null,
  });

  const fetchForms = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listIntakeForms({
        fields: 'owners,requiredFields',
      });
      setForms(response.data ?? []);
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  const existingEntityTypes = useMemo(
    () => new Set(forms.map((f) => f.entityType)),
    [forms]
  );

  const allEntityTypesCovered =
    existingEntityTypes.size === Object.values(TargetEntityType).length;

  const handleCreate = (entityType: TargetEntityType) => {
    setModalState({ open: true, entityType, initialValue: null });
  };

  const handleEdit = (form: IntakeForm) => {
    setModalState({
      open: true,
      entityType: form.entityType,
      initialValue: form,
    });
  };

  const handleDelete = async (form: IntakeForm) => {
    try {
      await deleteIntakeForm(form.id);
      showSuccessToast(t('message.intake-form-deleted-successfully'));
      await fetchForms();
    } catch (err) {
      showErrorToast(err as AxiosError);
    }
  };

  const handleToggleEnabled = async (form: IntakeForm, enabled: boolean) => {
    try {
      // PATCH just /enabled. A PUT with the CreateIntakeForm payload would
      // replace the whole entity and the backend mapper copies owners from
      // the request — so any previously set owners would be cleared.
      await patchIntakeForm(form.id, [
        { op: 'replace', path: '/enabled', value: enabled },
      ]);
      showSuccessToast(t('message.intake-form-updated-successfully'));
      await fetchForms();
    } catch (err) {
      showErrorToast(err as AxiosError);
    }
  };

  const handleSubmit = async (payload: CreateIntakeForm) => {
    try {
      if (modalState.initialValue) {
        // Preserve server-managed fields (owners) on edit. The designer
        // modal doesn't collect owners, but PUT replaces the whole entity,
        // so we must carry them forward or they'll be cleared.
        const preservedOwners = modalState.initialValue.owners;
        const mergedPayload: CreateIntakeForm = preservedOwners
          ? { ...payload, owners: preservedOwners }
          : payload;
        await createOrUpdateIntakeForm(mergedPayload);
        showSuccessToast(t('message.intake-form-updated-successfully'));
      } else {
        await createIntakeForm(payload);
        showSuccessToast(t('message.intake-form-created-successfully'));
      }
      setModalState({
        open: false,
        entityType: TargetEntityType.DataProduct,
        initialValue: null,
      });
      await fetchForms();
    } catch (err) {
      showErrorToast(err as AxiosError);
    }
  };

  const addMenu: MenuProps = {
    items: Object.values(TargetEntityType).map((et) => {
      const alreadyExists = existingEntityTypes.has(et);

      return {
        key: et,
        label: alreadyExists
          ? `${entityTypeLabel(et)} (${t('label.already-configured')})`
          : entityTypeLabel(et),
        disabled: alreadyExists,
        'data-testid': `add-${et}`,
        onClick: () => handleCreate(et),
      } as MenuProps['items'] extends (infer I)[] ? I : never;
    }),
  };

  const columns = [
    {
      title: t('label.entity-type'),
      dataIndex: 'entityType',
      key: 'entityType',
      render: (entityType: TargetEntityType) => (
        <Typography.Text strong>{entityTypeLabel(entityType)}</Typography.Text>
      ),
    },
    {
      title: t('label.required-fields'),
      dataIndex: 'requiredFields',
      key: 'requiredFields',
      render: (_: unknown, record: IntakeForm) => (
        <Space direction="vertical" size={2}>
          {(record.requiredFields ?? []).map((rf) => (
            <Tag
              color={
                rf.fieldKind === FieldKind.CustomProperty ? 'purple' : 'blue'
              }
              key={rf.fieldPath}>
              {rf.fieldLabel}
              <Typography.Text className="tw:ml-1" type="secondary">
                ({rf.fieldPath})
              </Typography.Text>
            </Tag>
          ))}
          {(record.requiredFields ?? []).length === 0 && (
            <Typography.Text type="secondary">
              {t('label.none')}
            </Typography.Text>
          )}
        </Space>
      ),
    },
    {
      title: t('label.enabled'),
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean, record: IntakeForm) => (
        <Switch
          checked={enabled}
          data-testid={`toggle-${record.entityType}`}
          onChange={(checked) => handleToggleEnabled(record, checked)}
        />
      ),
    },
    {
      title: t('label.action-plural'),
      key: 'actions',
      render: (_: unknown, record: IntakeForm) => (
        <Space>
          <Tooltip title={t('label.edit')}>
            <Button
              data-testid={`edit-${record.entityType}`}
              icon={<EditOutlined />}
              type="text"
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            cancelText={t('label.cancel')}
            okText={t('label.delete')}
            title={t('message.delete-intake-form-confirmation')}
            onConfirm={() => handleDelete(record)}>
            <Tooltip title={t('label.delete')}>
              <Button
                danger
                data-testid={`delete-${record.entityType}`}
                icon={<DeleteOutlined />}
                type="text"
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="tw:p-6">
      <div className="tw:flex tw:justify-between tw:items-center tw:mb-4">
        <PageHeader
          data={{
            header: t('label.intake-form-plural'),
            subHeader: t('message.intake-form-plural-description'),
          }}
        />
        <Tooltip
          title={
            allEntityTypesCovered
              ? t('message.intake-form-all-types-covered')
              : undefined
          }>
          <Dropdown
            disabled={allEntityTypesCovered}
            menu={addMenu}
            trigger={['click']}>
            <Button data-testid="add-intake-form" type="primary">
              {t('label.add-entity', { entity: t('label.intake-form') })}
              <DownOutlined />
            </Button>
          </Dropdown>
        </Tooltip>
      </div>

      <Table
        columns={columns}
        dataSource={forms}
        loading={loading}
        pagination={false}
        rowKey="id"
      />

      {modalState.open && (
        <IntakeFormDesignerModal
          entityType={modalState.entityType}
          initialValue={modalState.initialValue}
          open={modalState.open}
          onCancel={() =>
            setModalState({
              open: false,
              entityType: TargetEntityType.DataProduct,
              initialValue: null,
            })
          }
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
};

export default IntakeFormsPage;
