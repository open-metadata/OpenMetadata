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

/* eslint-disable openmetadata-imports/no-lower-layer-page-imports -- shared settings widget reused here */
import {
  Box,
  Button,
  Dialog,
  Dropdown,
  Modal,
  ModalOverlay,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Building01,
  ChevronDown,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CreatePlaceholder from '../../../../../../components/common/EmptyPlaceholder/CreatePlaceholder';
import {
  IntakeForm,
  TargetEntityType,
} from '../../../../../../generated/governance/intakeForm';
import IntakeFormsTable from '../../../../../../pages/IntakeForms/IntakeFormsTable';
import {
  deleteIntakeForm,
  listIntakeForms,
  patchIntakeForm,
} from '../../../../../../rest/intakeFormsAPI';
import { ENTITY_TYPE_LABEL_KEYS } from '../../../../../../utils/IntakeFormUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import { GovernanceView } from './Governance.types';

interface GovernanceIntakeListProps {
  onNavigate: (view: GovernanceView) => void;
  onSetHeaderActions?: (actions: React.ReactNode) => void;
}

const GovernanceIntakeList: FC<GovernanceIntakeListProps> = ({
  onNavigate,
  onSetHeaderActions,
}) => {
  const { t } = useTranslation();
  const [forms, setForms] = useState<IntakeForm[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IntakeForm | null>(null);

  const entityTypeLabel = useCallback(
    (et: TargetEntityType) => t(ENTITY_TYPE_LABEL_KEYS[et]),
    [t]
  );

  const fetchForms = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listIntakeForms({
        fields: 'owners,formFields,requiredFields',
      });
      setForms(response.data ?? []);
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchForms();
  }, [fetchForms]);

  const existingEntityTypes = useMemo(
    () => new Set(forms.map((f) => f.entityType)),
    [forms]
  );

  const allEntityTypesCovered =
    existingEntityTypes.size === Object.values(TargetEntityType).length;

  const addMenuItems = useMemo(
    () =>
      Object.values(TargetEntityType).map((et) => ({
        id: et,
        label: existingEntityTypes.has(et)
          ? `${entityTypeLabel(et)} (${t('label.already-configured')})`
          : entityTypeLabel(et),
        isDisabled: existingEntityTypes.has(et),
      })),
    [existingEntityTypes, entityTypeLabel, t]
  );

  const handleToggleEnabled = useCallback(
    async (form: IntakeForm, enabled: boolean) => {
      try {
        await patchIntakeForm(form.id, [
          { op: 'replace', path: '/enabled', value: enabled },
        ]);
        showSuccessToast(t('message.intake-form-updated-successfully'));
        await fetchForms();
      } catch (err) {
        showErrorToast(err as AxiosError);
      }
    },
    [fetchForms, t]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }
    const form = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteIntakeForm(form.id);
      showSuccessToast(t('message.intake-form-deleted-successfully'));
      await fetchForms();
    } catch (err) {
      showErrorToast(err as AxiosError);
    }
  }, [deleteTarget, fetchForms, t]);

  const renderAddButton = useCallback(() => {
    if (allEntityTypesCovered) {
      return (
        <Tooltip title={t('message.intake-form-all-types-covered')}>
          <Button
            isDisabled
            color="primary"
            data-testid="add-intake-form"
            iconTrailing={ChevronDown}
            size="sm">
            {t('label.add-entity', { entity: t('label.intake-form') })}
          </Button>
        </Tooltip>
      );
    }

    return (
      <Dropdown.Root>
        <Button
          color="primary"
          data-testid="add-intake-form"
          iconTrailing={ChevronDown}
          size="sm">
          {t('label.add-entity', { entity: t('label.intake-form') })}
        </Button>
        <Dropdown.Popover className="tw:w-max">
          <Dropdown.Menu
            disallowEmptySelection={false}
            items={addMenuItems}
            selectionMode="none"
            onAction={(key) =>
              onNavigate({
                type: 'intake-add',
                entityType: String(key) as TargetEntityType,
              })
            }>
            {(item: { id: string; label: string; isDisabled: boolean }) => (
              <Dropdown.Item
                data-testid={`add-${item.id}`}
                id={item.id}
                isDisabled={item.isDisabled}
                label={item.label}
              />
            )}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
    );
  }, [addMenuItems, allEntityTypesCovered, onNavigate, t]);

  // Push the "Add Intake Form" button to the parent header
  useEffect(() => {
    onSetHeaderActions?.(renderAddButton());
  }, [renderAddButton, onSetHeaderActions]);

  return (
    <Box className="tw:p-8 tw:pt-0.25" direction="col" gap={4}>
      {!loading && forms.length === 0 ? (
        <div className="tw:relative tw:min-h-90">
          <CreatePlaceholder
            data-testid="intake-forms-empty"
            description={t('message.no-intake-form-yet-description')}
            icon={<Building01 className="tw:text-fg-brand-primary" />}
            title={t('message.no-intake-form-yet')}
          />
        </div>
      ) : (
        <IntakeFormsTable
          forms={forms}
          loading={loading}
          onDelete={setDeleteTarget}
          onEdit={(form) => onNavigate({ type: 'intake-edit', id: form.id })}
          onToggleEnabled={handleToggleEnabled}
        />
      )}

      <ModalOverlay
        isDismissable
        isOpen={Boolean(deleteTarget)}
        onOpenChange={(isOpen) => !isOpen && setDeleteTarget(null)}>
        <Modal>
          <Dialog
            showCloseButton
            data-testid="intake-form-delete-confirm"
            title={t('label.delete-entity', {
              entity: t('label.entity-intake-form', {
                entity: deleteTarget
                  ? entityTypeLabel(deleteTarget.entityType)
                  : '',
              }),
            })}
            width={480}
            onClose={() => setDeleteTarget(null)}>
            <Dialog.Content>
              <Typography className="tw:text-tertiary" size="text-sm">
                {t('message.delete-intake-form-confirmation')}
              </Typography>
            </Dialog.Content>
            <Dialog.Footer>
              <div className="tw:col-span-2 tw:flex tw:justify-end tw:gap-3">
                <Button
                  color="tertiary"
                  size="sm"
                  onPress={() => setDeleteTarget(null)}>
                  {t('label.cancel')}
                </Button>
                <Button
                  color="primary-destructive"
                  size="sm"
                  onPress={handleDeleteConfirm}>
                  {t('label.delete')}
                </Button>
              </div>
            </Dialog.Footer>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </Box>
  );
};

export default GovernanceIntakeList;
