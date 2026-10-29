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
  FeaturedIcon,
  SlideoutMenu,
  Typography,
} from '@openmetadata/ui-core-components';
import { AlertTriangle } from '@openmetadata/ui-core-components/icons';
import { isUndefined } from 'lodash';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShowHintToggle } from '../../../components/common/atoms/drawer/ShowHintToggle';
import Loader from '../../../components/common/Loader/Loader';
import { DEFAULT_READ_TIMEOUT } from '../../../constants/Alerts.constants';
import {
  FORM_DRAWER_WIDTH_WITHOUT_HINT,
  FORM_DRAWER_WIDTH_WITH_HINT,
} from '../../../constants/common/formHint.constants';
import {
  AlertType,
  ProviderType,
} from '../../../generated/events/eventSubscription';
import {
  ModifiedCreateEventSubscription,
  ModifiedEventSubscription,
} from '../../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import { useAlertFormData } from '../../../pages/AddObservabilityPage/hooks/useAlertFormData';
import { getEntityName } from '../../../utils/EntityNameUtils';
import AlertAiForm from './AlertAiForm.component';
import {
  ALERT_AI_DEFAULT_CONNECTION_TIMEOUT,
  ALERT_AI_FORM_MODAL_ID,
} from './AlertAiFormFields.constants';
import { AlertKind, OBSERVABILITY_ALERT_KIND } from './alertKinds';

interface AlertEditModalProps {
  /** Which alerts this drawer edits; defaults to Observability. */
  kind?: AlertKind;
  fqn?: string;
  isOpen: boolean;
  mode?: 'add' | 'edit';
  onClose: () => void;
  onSaved: (fqn?: string) => Promise<void> | void;
}

/** Converts fetched alert details into the editable AI form shape. */
const getInitialValues = (
  alertType: AlertType,
  alert?: ModifiedEventSubscription
): ModifiedCreateEventSubscription => ({
  ...(alert as unknown as ModifiedCreateEventSubscription),
  alertType: alert?.alertType ?? alertType,
  destinations: alert?.destinations ?? [],
  displayName: getEntityName(alert),
  name: alert?.name ?? '',
  provider: alert?.provider ?? ProviderType.User,
  readTimeout: alert?.readTimeout ?? DEFAULT_READ_TIMEOUT,
  resources: alert?.filteringRules?.resources,
  timeout: alert?.timeout ?? ALERT_AI_DEFAULT_CONNECTION_TIMEOUT,
});

/** Builds the blank create-alert payload used by the add alert drawer. */
const getEmptyInitialValues = (
  alertType: AlertType
): ModifiedCreateEventSubscription => ({
  alertType,
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

/** Renders the shared add/edit alert drawer using OSS alert form hooks and AI fields. */
function AlertEditModal({
  kind = OBSERVABILITY_ALERT_KIND,
  fqn,
  isOpen,
  mode = 'edit',
  onClose,
  onSaved,
}: Readonly<AlertEditModalProps>) {
  const { t } = useTranslation();
  const { alertType } = kind;
  const isEditMode = mode === 'edit';
  const [formData, setFormData] = useState<ModifiedCreateEventSubscription>(
    () => getEmptyInitialValues(alertType)
  );
  const [showHint, setShowHint] = useState(true);
  const {
    alert,
    extraFormButtons,
    handleSave,
    inlineAlertDetails,
    isLoading,
    loadingState,
    saving,
    selection,
    shouldShowActionsSection,
    shouldShowFiltersSection,
    templateResourcePermission,
    templates,
  } = useAlertFormData({
    afterSaveAction: onSaved,
    alertType,
    fqn,
    onCancel: onClose,
    sources: formData.resources,
    // So the server can warn about a chosen source the filters and triggers never match.
    input: formData.input,
  });

  useEffect(() => {
    if (isEditMode && alert) {
      setFormData(getInitialValues(alertType, alert));
    }
  }, [alert, alertType, isEditMode]);

  useEffect(() => {
    if (!isEditMode && isOpen) {
      setFormData(getEmptyInitialValues(alertType));
    }
  }, [alertType, isEditMode, isOpen]);

  const title = isEditMode
    ? t('label.edit-entity', { entity: t('label.alert') })
    : t('label.add-entity', { entity: t('label.alert') });

  // Block dismissal while a save is in flight. The drawer is controlled
  // (open is driven by isOpen), so a no-op close keeps it open.
  const handleClose = () => {
    if (!saving) {
      onClose();
    }
  };

  const extraFooterButtons = Object.entries(extraFormButtons).map(
    ([name, ButtonComponent]) => (
      <ButtonComponent
        alertDetails={alert}
        key={name}
        loading={saving}
        templateResourcePermission={templateResourcePermission}
        templates={templates}
        values={formData}
      />
    )
  );

  return (
    <SlideoutMenu
      isDismissable
      aria-label={title}
      // The width follows the Form Hint column, which collapses over 240ms, so
      // the drawer animates with it. Not while sliding in or out: `duration-*`
      // also sets the slide animation's duration.
      className={({ isEntering, isExiting }) =>
        isEntering || isExiting
          ? ''
          : 'tw:transition-[max-width] tw:duration-[240ms] tw:ease-in-out'
      }
      dialogClassName="tw:gap-0"
      isOpen={isOpen}
      width={
        showHint ? FORM_DRAWER_WIDTH_WITH_HINT : FORM_DRAWER_WIDTH_WITHOUT_HINT
      }
      onOpenChange={(open) => !open && handleClose()}>
      <SlideoutMenu.Header
        className="tw:border-b tw:border-secondary tw:pb-4"
        onClose={handleClose}>
        {/* pr-10 keeps the Show Hint toggle clear of the header's close button. */}
        <Box align="center" className="tw:pr-10" gap={3} justify="between">
          <Box align="center" className="tw:min-w-0" gap={3}>
            <FeaturedIcon
              color="gray"
              icon={AlertTriangle}
              radius="md"
              shape="square"
              size="md"
              theme="light"
            />
            <Box direction="col">
              <Typography size="text-md" weight="medium">
                {title}
              </Typography>
              <Typography className="tw:text-tertiary" size="text-sm">
                {t('message.alerts-description')}
              </Typography>
            </Box>
          </Box>
          <ShowHintToggle isSelected={showHint} onChange={setShowHint} />
        </Box>
      </SlideoutMenu.Header>
      {/* The form and the Form Hint column each scroll on their own and run to
          the drawer's edges, so the content row carries no padding. */}
      <SlideoutMenu.Content className="tw:flex-row tw:gap-0 tw:px-0 tw:md:px-0">
        {isLoading || (isEditMode && isUndefined(alert)) ? (
          <div className="tw:flex tw:flex-1 tw:items-center tw:justify-center">
            <Loader />
          </div>
        ) : (
          <AlertAiForm
            alert={alert}
            formId={ALERT_AI_FORM_MODAL_ID}
            inlineAlert={inlineAlertDetails}
            mode={mode}
            selection={selection}
            shouldShowActionsSection={shouldShowActionsSection}
            shouldShowFiltersSection={shouldShowFiltersSection}
            showHint={showHint}
            templateResourcePermission={templateResourcePermission}
            templates={templates}
            templatesLoading={loadingState.templates}
            value={formData}
            onChange={setFormData}
            onSubmit={handleSave}
          />
        )}
      </SlideoutMenu.Content>
      <SlideoutMenu.Footer>
        <Box gap={3} justify="end">
          <Button
            color="secondary"
            data-testid="cancel-button"
            onClick={handleClose}>
            {t('label.cancel')}
          </Button>
          {extraFooterButtons}
          {/* The form lives in the drawer body; `form` submits it natively. */}
          <Button
            color="primary"
            data-testid="save-button"
            form={ALERT_AI_FORM_MODAL_ID}
            isDisabled={saving || isLoading}
            isLoading={saving}
            type="submit">
            {t('label.save')}
          </Button>
        </Box>
      </SlideoutMenu.Footer>
    </SlideoutMenu>
  );
}

export default AlertEditModal;
