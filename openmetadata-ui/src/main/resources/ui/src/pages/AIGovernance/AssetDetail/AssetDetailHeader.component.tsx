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

import { AxiosError } from 'axios';
import { compare, Operation } from 'fast-json-patch';
import { isEmpty } from 'lodash';
import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { DomainLabel } from '../../../components/common/DomainLabel/DomainLabel.component';
import { OwnerLabel } from '../../../components/common/OwnerLabel/OwnerLabel.component';
import TagsSectionV1 from '../../../components/common/TagsSection/TagsSection';
import { EntityType } from '../../../enums/entity.enum';
import { EntityReference as DomainEntityReference } from '../../../generated/entity/type';
import { EntityReference } from '../../../generated/type/entityReference';
import { TagLabel } from '../../../generated/type/tagLabel';
import { patchAIApplicationDetails } from '../../../rest/aiApplicationAPI';
import { patchLLMModelDetails } from '../../../rest/llmModelAPI';
import { patchMcpServerDetails } from '../../../rest/mcpServerAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import {
  Button,
  Card,
  Input,
  Modal,
  Space,
  Typography,
} from '../components/AIGovUntitled.component';
import { IcFlag } from '../icons/AIGovIcons';
import { RegistryRiskClassification } from '../sections/Registry/Registry.types';
import { AIAssetEntityType, AIAssetView } from './AssetDetail.types';

interface AssetDetailHeaderProps {
  view: AIAssetView;
  onReload: () => void;
}

type EditableTextField = 'displayName' | 'description';

const REGISTRATION_PILL: Record<string, string> = {
  Registered: 'ai-gov-pill--info',
  Approved: 'ai-gov-pill--success',
  PendingApproval: 'ai-gov-pill--warning',
  Rejected: 'ai-gov-pill--error',
  Unregistered: 'ai-gov-pill--error',
};

const RISK_PILL: Record<RegistryRiskClassification, string> = {
  Unacceptable: 'ai-gov-pill--unacceptable',
  High: 'ai-gov-pill--high',
  Limited: 'ai-gov-pill--limited',
  Minimal: 'ai-gov-pill--minimal',
};

const ENTITY_TYPE_BY_ASSET: Record<AIAssetEntityType, EntityType> = {
  aiApplication: EntityType.AI_APPLICATION,
  llmModel: EntityType.LLM_MODEL,
  mcpServer: EntityType.MCP_SERVER,
};

const patchAssetDetails = (
  entityType: AIAssetEntityType,
  id: string,
  ops: Operation[]
) => {
  if (entityType === 'aiApplication') {
    return patchAIApplicationDetails(id, ops);
  }
  if (entityType === 'llmModel') {
    return patchLLMModelDetails(id, ops);
  }

  return patchMcpServerDetails(id, ops);
};

const HeaderField = ({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) => (
  <div className="ai-gov-detail-header-field">
    <Typography.Text className="ai-gov-detail-header-field-label">
      {label}
    </Typography.Text>
    <div className="ai-gov-detail-header-field-value">{children}</div>
  </div>
);

export const AssetDetailHeader = ({
  onReload,
  view,
}: AssetDetailHeaderProps) => {
  const { t } = useTranslation();
  const [editingField, setEditingField] = useState<EditableTextField>();
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const handlePatch = async (ops: Operation[], successEntityLabel: string) => {
    if (!view.id || ops.length === 0) {
      return;
    }
    try {
      await patchAssetDetails(view.entityType, view.id, ops);
      showSuccessToast(
        t('server.update-entity-success', { entity: successEntityLabel })
      );
      onReload();
    } catch (error) {
      showErrorToast(error as AxiosError);

      throw error;
    }
  };

  const handleEditOpen = (field: EditableTextField) => {
    setEditingField(field);
    setEditValue(
      field === 'displayName' ? view.displayName ?? '' : view.description ?? ''
    );
  };

  const handleEditCancel = () => {
    setEditingField(undefined);
    setEditValue('');
    setSaving(false);
  };

  const handleTextFieldSave = async () => {
    if (!editingField) {
      return;
    }
    const nextValue = editValue.trim();
    const currentValue =
      editingField === 'displayName'
        ? view.source.entity.displayName
        : view.source.entity.description;
    const original = {
      [editingField]: currentValue,
    };
    const updated = {
      [editingField]: nextValue,
    };
    const ops = compare(original, updated);
    if (ops.length === 0) {
      handleEditCancel();

      return;
    }
    setSaving(true);
    try {
      await handlePatch(
        ops,
        editingField === 'displayName'
          ? t('label.display-name')
          : t('label.description')
      );
      handleEditCancel();
    } catch {
      setSaving(false);
    }
  };

  const handleOwnersUpdate = async (owners?: EntityReference[]) => {
    const ops = compare({ owners: view.owners }, { owners: owners ?? [] });
    await handlePatch(ops, t('label.owner-plural'));
  };

  const handleDomainsUpdate = async (
    domain: DomainEntityReference | DomainEntityReference[]
  ) => {
    const nextDomains = Array.isArray(domain)
      ? domain
      : isEmpty(domain)
      ? []
      : [domain];
    const ops = compare(
      { domains: view.domains },
      { domains: nextDomains as EntityReference[] }
    );
    await handlePatch(ops, t('label.domain-plural'));
  };

  const handleTagsUpdate = async (updatedTags: TagLabel[]) => {
    const ops = compare({ tags: view.tags }, { tags: updatedTags });
    await handlePatch(ops, t('label.tag-plural'));

    return updatedTags;
  };

  const title = view.displayName ?? view.name;
  const textFieldLabel =
    editingField === 'displayName'
      ? t('label.display-name')
      : t('label.description');

  return (
    <>
      <Card className="ai-gov-detail-header-card tw:mt-4">
        <div className="ai-gov-detail-header">
          <div className="ai-gov-detail-header-main">
            <div className="ai-gov-detail-header-title-row">
              <Typography.Title
                className="ai-gov-detail-header-title"
                level={3}>
                {title}
              </Typography.Title>
              <Button
                className="ai-gov-detail-header-edit-button"
                data-testid="ai-gov-edit-display-name"
                title={t('label.edit-entity', {
                  entity: t('label.display-name'),
                })}
                type="button"
                onClick={() => handleEditOpen('displayName')}>
                <EditIcon />
              </Button>
            </div>

            <Space wrap className="ai-gov-detail-header-pills" size="small">
              {view.registrationStatus && (
                <span
                  className={`ai-gov-pill ${
                    REGISTRATION_PILL[view.registrationStatus] ??
                    'ai-gov-pill--quiet'
                  }`}>
                  <span className="ai-gov-pill-dot" />
                  {view.registrationStatus}
                </span>
              )}
              {view.riskClassification && (
                <span
                  className={`ai-gov-pill ${
                    RISK_PILL[view.riskClassification] ?? 'ai-gov-pill--quiet'
                  }`}>
                  <span className="ai-gov-pill-dot" />
                  {t('label.risk-class-label', {
                    risk: view.riskClassification,
                  })}
                </span>
              )}
              {view.highRiskAnnexes.map((label) => (
                <span className="ai-gov-pill ai-gov-pill--error" key={label}>
                  <IcFlag style={{ width: 11, height: 11 }} />
                  {label}
                </span>
              ))}
            </Space>

            <div className="ai-gov-detail-header-description">
              <Typography.Paragraph className="tw:m-0" type="secondary">
                {view.description || t('label.no-description')}
              </Typography.Paragraph>
              <Button
                className="ai-gov-detail-header-edit-button"
                data-testid="ai-gov-edit-description"
                title={t('label.edit-entity', {
                  entity: t('label.description'),
                })}
                type="button"
                onClick={() => handleEditOpen('description')}>
                <EditIcon />
              </Button>
            </div>

            <div className="ai-gov-detail-header-fields">
              <HeaderField label={t('label.owner-plural')}>
                <OwnerLabel
                  hasPermission
                  showDashPlaceholder
                  avatarSize={24}
                  maxVisibleOwners={4}
                  multiple={{ user: true, team: true }}
                  owners={view.owners}
                  showLabel={false}
                  onUpdate={handleOwnersUpdate}
                />
              </HeaderField>
              <HeaderField label={t('label.domain-plural')}>
                <DomainLabel
                  hasPermission
                  multiple
                  showDashPlaceholder
                  domains={view.domains as DomainEntityReference[]}
                  entityFqn={view.fullyQualifiedName}
                  entityId={view.id}
                  entityType={ENTITY_TYPE_BY_ASSET[view.entityType]}
                  onUpdate={handleDomainsUpdate}
                />
              </HeaderField>
              <HeaderField label={t('label.tag-plural')}>
                <TagsSectionV1
                  hasPermission
                  entityId={view.id}
                  entityType={ENTITY_TYPE_BY_ASSET[view.entityType]}
                  maxVisibleTags={5}
                  tags={view.tags}
                  onTagsUpdate={handleTagsUpdate}
                />
              </HeaderField>
            </div>
          </div>

          <div className="ai-gov-detail-header-actions">
            <Button>{t('label.share')}</Button>
            <Button type="primary">{t('label.reassess')}</Button>
          </div>
        </div>
      </Card>

      <Modal
        cancelText={t('label.cancel')}
        confirmLoading={saving}
        okText={t('label.save')}
        open={Boolean(editingField)}
        title={t('label.edit-entity', { entity: textFieldLabel })}
        width={520}
        onCancel={handleEditCancel}
        onOk={handleTextFieldSave}>
        {editingField === 'description' ? (
          <Input.TextArea
            data-testid="ai-gov-description-input"
            minRows={5}
            value={editValue}
            onChange={(event) => setEditValue(event.target.value)}
          />
        ) : (
          <Input
            data-testid="ai-gov-display-name-input"
            value={editValue}
            onChange={(event) => setEditValue(event.target.value)}
          />
        )}
      </Modal>
    </>
  );
};

export { patchAssetDetails };
