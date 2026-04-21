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
  Button,
  Checkbox,
  Divider,
  Drawer,
  Empty,
  Input,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CreateIntakeForm } from '../../generated/api/governance/createIntakeForm';
import { CustomProperty } from '../../generated/entity/type';
import {
  FieldKind,
  IntakeForm,
  RequiredField,
  TargetEntityType,
} from '../../generated/governance/intakeForm';
import { getCustomPropertiesByEntityType } from '../../rest/metadataTypeAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import {
  ENTITY_TYPE_API_NAME,
  IntakeFormNativeField,
  NATIVE_FIELDS_BY_ENTITY_TYPE,
} from './intakeFormFields';

export interface IntakeFormDesignerModalProps {
  open: boolean;
  /** Pre-selected entity type. Required for create; derived from initialValue for edit. */
  entityType: TargetEntityType;
  initialValue: IntakeForm | null;
  onCancel: () => void;
  onSubmit: (payload: CreateIntakeForm) => Promise<void> | void;
}

interface FieldRow {
  path: string;
  label: string;
  kind: FieldKind;
  selected: boolean;
  errorMessage?: string;
}

const ENTITY_TYPE_LABEL_KEYS: Record<TargetEntityType, string> = {
  [TargetEntityType.DataProduct]: 'label.data-product',
  [TargetEntityType.Domain]: 'label.domain',
  [TargetEntityType.GlossaryTerm]: 'label.glossary-term',
};

const IntakeFormDesignerModal = ({
  open,
  entityType,
  initialValue,
  onCancel,
  onSubmit,
}: IntakeFormDesignerModalProps) => {
  const { t } = useTranslation();
  const [customProperties, setCustomProperties] = useState<CustomProperty[]>(
    []
  );
  const [rows, setRows] = useState<FieldRow[]>([]);
  const [description, setDescription] = useState<string>('');
  const [enabled, setEnabled] = useState<boolean>(true);
  const [loadingProps, setLoadingProps] = useState(false);

  // Sync local UI state from the initialValue each time the modal opens
  useEffect(() => {
    if (!open) {
      return;
    }
    setDescription(initialValue?.description ?? '');
    setEnabled(initialValue?.enabled ?? true);
  }, [open, initialValue]);

  // Fetch custom properties defined on the target entity type
  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setLoadingProps(true);
    getCustomPropertiesByEntityType(ENTITY_TYPE_API_NAME[entityType])
      .then((props) => {
        if (!cancelled) {
          setCustomProperties(props ?? []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCustomProperties([]);
          showErrorToast(err as AxiosError);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingProps(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, entityType]);

  // Rebuild rows whenever the data backing them changes
  useEffect(() => {
    const natives: IntakeFormNativeField[] =
      NATIVE_FIELDS_BY_ENTITY_TYPE[entityType] ?? [];
    const existingSelections = new Map<string, RequiredField>(
      (initialValue?.requiredFields ?? []).map((rf) => [rf.fieldPath, rf])
    );

    const nativeRows: FieldRow[] = natives.map((nf) => {
      const existing = existingSelections.get(nf.path);

      return {
        path: nf.path,
        label: t(nf.labelKey),
        kind: FieldKind.Native,
        selected: Boolean(existing),
        errorMessage: existing?.errorMessage,
      };
    });

    const customRows: FieldRow[] = customProperties.map((cp) => {
      const path = `extension.${cp.name}`;
      const existing = existingSelections.get(path);

      return {
        path,
        label: cp.displayName ?? cp.name ?? path,
        kind: FieldKind.CustomProperty,
        selected: Boolean(existing),
        errorMessage: existing?.errorMessage,
      };
    });

    setRows([...nativeRows, ...customRows]);
  }, [entityType, customProperties, initialValue, t]);

  const updateRow = useCallback((path: string, patch: Partial<FieldRow>) => {
    setRows((prev) =>
      prev.map((row) => (row.path === path ? { ...row, ...patch } : row))
    );
  }, []);

  const handleOk = async () => {
    const requiredFields: RequiredField[] = rows
      .filter((row) => row.selected)
      .map((row) => ({
        fieldPath: row.path,
        fieldLabel: row.label,
        fieldKind: row.kind,
        errorMessage: row.errorMessage || undefined,
      }));

    // One intake form per entity type — name is deterministically derived.
    // On edit, keep whatever displayName the form already has (users may
    // have renamed it via API). On create, fall back to a localized default
    // of "<Entity> <IntakeForm>" so the listing shows a meaningful label
    // without forcing the user to type one.
    const name = ENTITY_TYPE_API_NAME[entityType];
    const defaultDisplayName = t('label.entity-intake-form', {
      entity: t(ENTITY_TYPE_LABEL_KEYS[entityType]),
    });
    const displayName = initialValue?.displayName ?? defaultDisplayName;
    const payload: CreateIntakeForm = {
      name,
      displayName,
      description: description || undefined,
      entityType,
      enabled,
      requiredFields,
    };
    await onSubmit(payload);
  };

  const nativeRows = useMemo(
    () => rows.filter((r) => r.kind === FieldKind.Native),
    [rows]
  );
  const customRows = useMemo(
    () => rows.filter((r) => r.kind === FieldKind.CustomProperty),
    [rows]
  );

  const fieldColumns = [
    {
      title: t('label.required'),
      dataIndex: 'selected',
      key: 'selected',
      width: 90,
      render: (_: boolean, record: FieldRow) => (
        <Checkbox
          checked={record.selected}
          data-testid={`require-${record.path}`}
          onChange={(e) =>
            updateRow(record.path, { selected: e.target.checked })
          }
        />
      ),
    },
    {
      title: t('label.field'),
      dataIndex: 'label',
      key: 'label',
      render: (label: string, record: FieldRow) => (
        <div>
          <Typography.Text strong>{label}</Typography.Text>
          <div>
            <Typography.Text className="tw:text-xs" type="secondary">
              {record.path}
            </Typography.Text>
          </div>
        </div>
      ),
    },
    {
      title: t('label.custom-error-message'),
      dataIndex: 'errorMessage',
      key: 'errorMessage',
      render: (_: string, record: FieldRow) => (
        <Input
          data-testid={`error-${record.path}`}
          disabled={!record.selected}
          placeholder={t('message.optional-custom-error')}
          value={record.errorMessage ?? ''}
          onChange={(e) =>
            updateRow(record.path, { errorMessage: e.target.value })
          }
        />
      ),
    },
  ];

  return (
    <Drawer
      destroyOnClose
      data-testid="intake-form-designer-modal"
      extra={
        <Space>
          <Button data-testid="intake-form-cancel" onClick={onCancel}>
            {t('label.cancel')}
          </Button>
          <Button
            data-testid="intake-form-submit"
            type="primary"
            onClick={handleOk}>
            {initialValue ? t('label.save') : t('label.create')}
          </Button>
        </Space>
      }
      open={open}
      placement="right"
      title={
        initialValue
          ? t('label.edit-entity', {
              entity: t('label.entity-intake-form', {
                entity: t(ENTITY_TYPE_LABEL_KEYS[entityType]),
              }),
            })
          : t('label.add-entity', {
              entity: t('label.entity-intake-form', {
                entity: t(ENTITY_TYPE_LABEL_KEYS[entityType]),
              }),
            })
      }
      width="75%"
      onClose={onCancel}>
      <Alert
        showIcon
        className="tw:mb-4"
        description={t('message.intake-form-one-per-type-help', {
          entityType: t(ENTITY_TYPE_LABEL_KEYS[entityType]),
        })}
        type="info"
      />

      <div className="tw:mb-4">
        <Typography.Text strong>{t('label.description')}</Typography.Text>
        <Input.TextArea
          autoSize={{ minRows: 2, maxRows: 4 }}
          className="tw:mt-1"
          data-testid="intake-form-description"
          placeholder={t('message.intake-form-description-placeholder')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="tw:flex tw:items-center tw:gap-3 tw:mb-4">
        <Typography.Text strong>{t('label.enabled')}</Typography.Text>
        <Switch
          checked={enabled}
          data-testid="intake-form-enabled"
          onChange={setEnabled}
        />
        <Typography.Text type="secondary">
          {t('message.intake-form-enabled-help')}
        </Typography.Text>
      </div>

      <Divider />

      <Typography.Title level={5}>
        {t('label.native-field-plural')}
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        {t('message.intake-form-native-fields-help')}
      </Typography.Paragraph>
      <Table
        columns={fieldColumns}
        dataSource={nativeRows}
        locale={{
          emptyText: <Empty description={t('message.no-native-fields')} />,
        }}
        pagination={false}
        rowKey="path"
        size="small"
      />

      <Divider />

      <div className="tw:flex tw:items-center tw:gap-2">
        <Typography.Title className="tw:m-0" level={5}>
          {t('label.custom-property-plural')}
        </Typography.Title>
        <Tag>{customRows.length}</Tag>
      </div>
      <Typography.Paragraph type="secondary">
        {t('message.intake-form-custom-properties-help')}
      </Typography.Paragraph>
      <Table
        columns={fieldColumns}
        dataSource={customRows}
        loading={loadingProps}
        locale={{
          emptyText: (
            <Empty description={t('message.no-custom-properties-defined')} />
          ),
        }}
        pagination={false}
        rowKey="path"
        size="small"
      />
    </Drawer>
  );
};

export default IntakeFormDesignerModal;
