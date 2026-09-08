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

import { AlertTriangle } from '@untitledui/icons';
import { isUndefined } from 'lodash';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AiFormModal } from '../../../components/common/atoms/drawer/AiFormModal';
import Loader from '../../../components/common/Loader/Loader';
import { DEFAULT_READ_TIMEOUT } from '../../../constants/Alerts.constants';
import {
  AlertType,
  ProviderType,
} from '../../../generated/events/eventSubscription';
import {
  ModifiedCreateEventSubscription,
  ModifiedEventSubscription,
} from '../../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import { useObservabilityAlertForm } from '../../../pages/AddObservabilityPage/hooks/useObservabilityAlertForm';
import { getEntityName } from '../../../utils/EntityNameUtils';
import AlertAiForm from './AlertAiForm.component';
import {
  ALERT_AI_DEFAULT_CONNECTION_TIMEOUT,
  ALERT_AI_FORM_MODAL_ID,
} from './AlertAiFormFields.constants';

interface AlertEditModalProps {
  fqn?: string;
  isOpen: boolean;
  mode?: 'add' | 'edit';
  onClose: () => void;
  onSaved: (fqn?: string) => Promise<void> | void;
}

/** Converts fetched alert details into the editable AI modal form shape. */
const getInitialValues = (
  alert?: ModifiedEventSubscription
): ModifiedCreateEventSubscription => ({
  ...(alert as unknown as ModifiedCreateEventSubscription),
  alertType: alert?.alertType ?? AlertType.Observability,
  destinations: alert?.destinations ?? [],
  displayName: getEntityName(alert),
  name: alert?.name ?? '',
  provider: alert?.provider ?? ProviderType.User,
  readTimeout: alert?.readTimeout ?? DEFAULT_READ_TIMEOUT,
  resources: alert?.filteringRules?.resources,
  timeout: alert?.timeout ?? ALERT_AI_DEFAULT_CONNECTION_TIMEOUT,
});

/** Builds the blank create-alert payload used by the add alert modal. */
const getEmptyInitialValues = (): ModifiedCreateEventSubscription => ({
  alertType: AlertType.Observability,
  destinations: [],
  displayName: '',
  input: {
    actions: [],
    filters: [],
  },
  name: '',
  provider: ProviderType.User,
  readTimeout: DEFAULT_READ_TIMEOUT,
  resources: [],
  timeout: ALERT_AI_DEFAULT_CONNECTION_TIMEOUT,
});

/** Renders the shared add/edit alert modal using OSS alert form hooks and AI fields. */
function AlertEditModal({
  fqn,
  isOpen,
  mode = 'edit',
  onClose,
  onSaved,
}: Readonly<AlertEditModalProps>) {
  const { t } = useTranslation();
  const isEditMode = mode === 'edit';
  const [formData, setFormData] = useState<ModifiedCreateEventSubscription>(
    getEmptyInitialValues
  );
  const [showHint, setShowHint] = useState(true);
  const {
    alert,
    containerEntities,
    extraFormButtons,
    filterResources,
    form,
    handleSave,
    inlineAlertDetails,
    isLoading,
    saving,
    shouldShowActionsSection,
    shouldShowFiltersSection,
    supportedFilters,
    supportedTriggers,
    templateResourcePermission,
    templates,
  } = useObservabilityAlertForm({
    afterSaveAction: onSaved,
    fqn,
    onCancel: onClose,
  });

  useEffect(() => {
    if (isEditMode && alert) {
      setFormData(getInitialValues(alert));
    }
  }, [alert, isEditMode]);

  useEffect(() => {
    if (!isEditMode && isOpen) {
      setFormData(getEmptyInitialValues());
    }
  }, [isEditMode, isOpen]);

  // Keep the minimal Ant form mirror in sync for OSS widgets/buttons that still
  // read via Form.useWatch. Syncing the full controlled payload reintroduced
  // ModalOverlay scroll jumps, so only mirror the watched fields.
  useEffect(() => {
    form.setFieldsValue({
      customNotificationTemplateData: formData.customNotificationTemplateData,
      destinations: formData.destinations,
      notificationTemplate: formData.notificationTemplate,
      resources: formData.resources,
    });
  }, [
    form,
    formData.customNotificationTemplateData,
    formData.destinations,
    formData.notificationTemplate,
    formData.resources,
  ]);

  const title = isEditMode
    ? t('label.edit-entity', { entity: t('label.alert') })
    : t('label.add-entity', { entity: t('label.alert') });

  // Block dismissal while a save is in flight. AiFormModal is a controlled
  // modal (open is driven by isOpen), so a no-op close keeps it open.
  const handleClose = () => {
    if (!saving) {
      onClose();
    }
  };

  const extraFooterButtons = Object.entries(extraFormButtons).map(
    ([name, ButtonComponent]) => (
      <ButtonComponent
        alertDetails={alert}
        formRef={form}
        key={name}
        loading={saving}
        templateResourcePermission={templateResourcePermission}
        templates={templates}
      />
    )
  );

  return (
    <AiFormModal
      cancelTestId="cancel-button"
      footerActions={extraFooterButtons}
      hintOpen={showHint}
      icon={AlertTriangle}
      iconColor="warning"
      isSubmitDisabled={saving || isLoading}
      isSubmitting={saving}
      open={isOpen}
      submitFormId={ALERT_AI_FORM_MODAL_ID}
      submitLabel={t('label.save')}
      submitTestId="save-button"
      subtitle={t('message.alerts-description')}
      title={title}
      onClose={handleClose}
      onHintToggle={setShowHint}>
      {isLoading || (isEditMode && isUndefined(alert)) ? (
        <div className="tw:flex tw:min-h-[360px] tw:flex-1 tw:items-center tw:justify-center">
          <Loader />
        </div>
      ) : (
        <AlertAiForm
          alert={alert}
          containerEntities={containerEntities}
          filterResources={filterResources}
          formId={ALERT_AI_FORM_MODAL_ID}
          inlineAlert={inlineAlertDetails}
          mode={mode}
          shouldShowActionsSection={shouldShowActionsSection}
          shouldShowFiltersSection={shouldShowFiltersSection}
          showHint={showHint}
          supportedFilters={supportedFilters}
          supportedTriggers={supportedTriggers}
          templates={templates}
          value={formData}
          onChange={setFormData}
          onSubmit={handleSave}
        />
      )}
    </AiFormModal>
  );
}

export default AlertEditModal;
