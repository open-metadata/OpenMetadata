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
  ChevronDown,
  FileCheck02,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CreatePlaceholder from '../../components/common/EmptyPlaceholder/CreatePlaceholder';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { CreateIntakeForm } from '../../generated/api/governance/createIntakeForm';
import {
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
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import { ENTITY_TYPE_LABEL_KEYS } from '../../utils/IntakeFormUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import IntakeFormDesignerModal from './IntakeFormDesignerModal';
import IntakeFormsTable from './IntakeFormsTable';

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
  const [deleteTarget, setDeleteTarget] = useState<IntakeForm | null>(null);

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
    fetchForms();
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

  const handleDeleteConfirm = async () => {
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
    // The designer modal is responsible for carrying forward server-managed
    // fields like `owners` on edit (see IntakeFormDesignerModal#handleOk) —
    // we just hand the payload to the API verbatim.
    try {
      if (modalState.initialValue) {
        await createOrUpdateIntakeForm(payload);
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

  const closeModal = () =>
    setModalState({
      open: false,
      entityType: TargetEntityType.DataProduct,
      initialValue: null,
    });

  const breadcrumbs = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.GOVERNANCE,
        t('label.intake-form-plural')
      ),
    [t]
  );

  const renderAddButton = () => {
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
            onAction={(key) => handleCreate(String(key) as TargetEntityType)}>
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
  };

  const headerBar = (
    <Box align="center" justify="between">
      <PageHeader
        data={{
          header: t('label.intake-form-plural'),
          subHeader: t('message.intake-form-plural-description'),
        }}
      />
      {renderAddButton()}
    </Box>
  );

  return (
    <PageLayoutV1 pageTitle={t('label.intake-form-plural')}>
      <Box direction="col" gap={4}>
        <TitleBreadcrumb titleLinks={breadcrumbs} />
        {headerBar}

        {!loading && forms.length === 0 ? (
          <div className="tw:relative tw:min-h-90">
            <CreatePlaceholder
              data-testid="intake-forms-empty"
              description={t('message.no-intake-form-yet-description')}
              icon={<FileCheck02 className="tw:text-fg-brand-primary" />}
              title={t('message.no-intake-form-yet')}
            />
          </div>
        ) : (
          <IntakeFormsTable
            forms={forms}
            loading={loading}
            onDelete={setDeleteTarget}
            onEdit={handleEdit}
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

        {modalState.open && (
          <IntakeFormDesignerModal
            entityType={modalState.entityType}
            initialValue={modalState.initialValue}
            open={modalState.open}
            onCancel={closeModal}
            onSubmit={handleSubmit}
          />
        )}
      </Box>
    </PageLayoutV1>
  );
};

export default IntakeFormsPage;
