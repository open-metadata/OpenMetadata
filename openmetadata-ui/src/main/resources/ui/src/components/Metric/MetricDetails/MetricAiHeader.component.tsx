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
  Button,
  Dialog,
  Input,
  Modal,
  ModalOverlay,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ROUTES } from '../../../constants/constants';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../enums/entity.enum';
import { Metric } from '../../../generated/entity/data/metric';
import { EntityReference } from '../../../generated/type/entityReference';
import { HeaderDotSeparator } from '../../../utils/DataAssetsHeader.utils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { DomainLabel } from '../../common/DomainLabel/DomainLabel.component';
import HeaderBreadcrumb from '../../common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import { OwnerLabel } from '../../common/OwnerLabel/OwnerLabel.component';
import { EntityName } from '../../Modals/EntityNameModal/EntityNameModal.interface';

type EditableTextField = 'displayName' | 'description';

interface MetricAiHeaderProps {
  metric: Metric;
  permissions: OperationPermission;
  onDisplayNameUpdate: (data: EntityName) => Promise<void>;
  onDescriptionUpdate: (description: string) => Promise<void>;
  onOwnerUpdate: (owners?: EntityReference[]) => Promise<void>;
  onDomainUpdate: (
    domain: EntityReference | EntityReference[]
  ) => Promise<void>;
}

export const MetricAiHeader = ({
  metric,
  permissions,
  onDisplayNameUpdate,
  onDescriptionUpdate,
  onOwnerUpdate,
  onDomainUpdate,
}: MetricAiHeaderProps) => {
  const { t } = useTranslation();
  const [editingField, setEditingField] = useState<EditableTextField>();
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const title = getEntityName(metric);
  const canEdit = permissions.EditAll || permissions.EditDisplayName;
  const canEditDescription = permissions.EditAll || permissions.EditDescription;
  const textFieldLabel =
    editingField === 'displayName'
      ? t('label.display-name')
      : t('label.description');

  const handleEditOpen = (field: EditableTextField) => {
    setEditingField(field);
    setEditValue(
      field === 'displayName'
        ? metric.displayName ?? metric.name
        : metric.description ?? ''
    );
  };

  const handleEditCancel = () => {
    setEditingField(undefined);
    setEditValue('');
    setSaving(false);
  };

  const handleSave = async () => {
    if (!editingField) {
      return;
    }
    const nextValue = editValue.trim();
    setSaving(true);
    try {
      if (editingField === 'displayName') {
        await onDisplayNameUpdate({
          name: metric.name,
          displayName: nextValue,
        });
      } else {
        await onDescriptionUpdate(nextValue);
      }
      handleEditCancel();
    } catch {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="metric-ai-header ai-gov-asset-detail-card tw:flex tw:flex-col tw:gap-3 tw:rounded-xl tw:border tw:border-border-secondary tw:bg-bg-primary tw:py-4 tw:px-5 tw:shadow-xs">
        <HeaderBreadcrumb
          noMargin
          items={[
            { label: t('label.metric-plural'), href: ROUTES.METRICS },
            { label: title },
          ]}
          showHome={false}
        />

        <div className="tw:flex tw:items-start tw:justify-between tw:gap-6">
          <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-1">
            <div className="tw:flex tw:items-center tw:gap-2">
              <Typography size="text-lg" weight="semibold">
                {title}
              </Typography>
              {canEdit && (
                <Button
                  color="secondary"
                  data-testid="metric-ai-edit-display-name"
                  iconLeading={<EditIcon height={12} width={12} />}
                  size="xs"
                  title={t('label.edit-entity', {
                    entity: t('label.display-name'),
                  })}
                  type="button"
                  onClick={() => handleEditOpen('displayName')}
                />
              )}
            </div>

            <div className="tw:flex tw:max-w-3xl tw:items-start tw:gap-2">
              <span className="tw:text-sm tw:leading-relaxed tw:text-secondary">
                {metric.description || t('label.no-description')}
              </span>
              {canEditDescription && (
                <Button
                  className="tw:shrink-0"
                  color="secondary"
                  data-testid="metric-ai-edit-description"
                  iconLeading={<EditIcon height={12} width={12} />}
                  size="xs"
                  title={t('label.edit-entity', {
                    entity: t('label.description'),
                  })}
                  type="button"
                  onClick={() => handleEditOpen('description')}
                />
              )}
            </div>

            <div className="tw:flex tw:flex-wrap tw:items-start tw:gap-4.5 tw:mt-2">
              <OwnerLabel
                hasPermission
                showDashPlaceholder
                avatarSize={24}
                className="header-owner-heading"
                isCompactView={false}
                maxVisibleOwners={4}
                multiple={{ user: true, team: true }}
                owners={metric.owners}
                onUpdate={onOwnerUpdate}
              />
              <HeaderDotSeparator />
              <DomainLabel
                hasPermission
                headerLayout
                multiple
                showDashPlaceholder
                domains={metric.domains}
                entityFqn={metric.fullyQualifiedName}
                entityId={metric.id}
                entityType={EntityType.METRIC}
                onUpdate={onDomainUpdate}
              />
            </div>
          </div>
        </div>
      </div>

      <ModalOverlay
        isDismissable
        isOpen={Boolean(editingField)}
        onOpenChange={(open) => {
          if (!open) {
            handleEditCancel();
          }
        }}>
        <Modal>
          <Dialog
            showCloseButton
            className="metric-ai-modal"
            title={t('label.edit-entity', { entity: textFieldLabel })}
            width={480}
            onClose={handleEditCancel}>
            <Dialog.Content>
              {editingField === 'description' ? (
                <TextArea
                  data-testid="metric-ai-description-input"
                  rows={5}
                  value={editValue}
                  onChange={(value) => setEditValue(value)}
                />
              ) : (
                <Input
                  data-testid="metric-ai-display-name-input"
                  value={editValue}
                  onChange={(value) => setEditValue(value)}
                />
              )}
            </Dialog.Content>
            <Dialog.Footer>
              <div className="tw:col-span-2 tw:flex tw:items-center tw:justify-end tw:gap-2">
                <Button
                  color="secondary"
                  size="sm"
                  type="button"
                  onClick={handleEditCancel}>
                  {t('label.cancel')}
                </Button>
                <Button
                  color="primary"
                  isLoading={saving}
                  size="sm"
                  type="button"
                  onClick={handleSave}>
                  {t('label.save')}
                </Button>
              </div>
            </Dialog.Footer>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </>
  );
};
