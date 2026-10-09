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
  Box,
  Button,
  Dialog,
  FieldDocPopover,
  FieldDocProvider,
  FileUpload,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { Lightbulb05 } from '@openmetadata/ui-core-components/icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthProvider } from '../../../../../../generated/settings/settings';
import type { SecurityConfiguration } from '../../../../../../rest/securityConfigAPI';
import FormBuilderV1 from '../../../../../common/FormBuilderV1/FormBuilderV1';
import RichTextEditorPreviewerV1 from '../../../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import { PROVIDER_FILE_MAP } from '../../../../../SettingsSso/SSODocPanel/SSODocPanel.constants';
import SsoTestLoginModal from '../../../../../SettingsSso/SsoTestLogin/SsoTestLoginModal';
import { useSsoConfiguration } from '../../../../../SettingsSso/useSsoConfiguration';
import { SettingsSkeleton } from '../platform-settings/SettingsFormLayout';
import { useFormFieldDocs } from '../platform-settings/useFormFieldDocs';
import { getFieldDocsByName, toCoreUiSchema } from './SsoConfigureForm.utils';

const FORM_BODY_TEST_ID = 'sso-configure-form-body';

// Each configuration section (authentication, authorizer, provider details)
// renders as a bordered card; FormBuilderV1's flat layout draws no panel.
const FORM_CLASS_NAME = [
  'tw:w-full tw:max-w-[50%]',
  'tw:[&_.core-object-field-template-non-root]:rounded-[10px]',
  'tw:[&_.core-object-field-template-non-root]:border',
  'tw:[&_.core-object-field-template-non-root]:border-secondary',
  'tw:[&_.core-object-field-template-non-root]:p-5',
].join(' ');

// Actions live in the sticky footer; RJSF's own submit button is never shown.
const SUBMIT_BUTTON_OPTIONS = { norender: true, submitText: '' };

export interface SsoConfigureFormProps {
  /** Saved configuration to edit; omit when setting up `selectedProvider`. */
  securityConfig?: SecurityConfiguration;
  /** Provider for a new configuration. */
  selectedProvider?: string;
  showHint: boolean;
  /** Leaves a new setup (cancel/discard) — back to the provider grid. */
  onChangeProvider: () => void;
}

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
}

const UnsavedChangesDialog = ({
  isOpen,
  isSaving,
  onCancel,
  onDiscard,
  onSave,
}: UnsavedChangesDialogProps) => {
  const { t } = useTranslation();

  return (
    <ModalOverlay
      isDismissable={!isSaving}
      isOpen={isOpen}
      onOpenChange={(open) => !open && !isSaving && onCancel()}>
      <Modal>
        <Dialog
          data-testid="sso-unsaved-changes-dialog"
          dividers="scroll"
          showCloseButton={!isSaving}
          title={t('message.unsaved-changes')}
          width={480}
          onClose={onCancel}>
          <Dialog.Content>
            <Typography className="tw:text-tertiary" size="text-sm">
              {t('message.unsaved-changes-description')}
            </Typography>
          </Dialog.Content>
          <Dialog.Footer>
            <div className="tw:col-span-2 tw:flex tw:justify-end tw:gap-3">
              <Button
                color="secondary"
                data-testid="sso-unsaved-changes-discard"
                isDisabled={isSaving}
                size="sm"
                onPress={onDiscard}>
                {t('label.discard')}
              </Button>
              <Button
                color="primary"
                data-testid="sso-unsaved-changes-save"
                isLoading={isSaving}
                size="sm"
                onPress={onSave}>
                {t('label.save-changes')}
              </Button>
            </div>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

interface SsoSaveAlertsProps {
  isNewConfig: boolean;
  isGated: boolean;
  isSaving: boolean;
  gateMessage: string;
  onSaveAnyway: () => void;
}

/** The lock-out warnings shown above the footer, as on the classic page. */
const SsoSaveAlerts = ({
  isNewConfig,
  isGated,
  isSaving,
  gateMessage,
  onSaveAnyway,
}: SsoSaveAlertsProps) => {
  const { t } = useTranslation();

  return (
    <>
      {isNewConfig && (
        <Alert
          data-testid="sso-new-config-warning"
          title={t('label.warning')}
          variant="warning">
          {t('message.sso-new-config-save-warning')}
        </Alert>
      )}
      {isGated && (
        <Alert
          data-testid="sso-test-login-required"
          rightContent={
            <Button
              color="secondary"
              data-testid="save-anyway-sso-configuration"
              isDisabled={isSaving}
              size="sm"
              onPress={onSaveAnyway}>
              {t('label.save-anyway')}
            </Button>
          }
          title={t('label.test-login')}
          variant="warning">
          {gateMessage}
        </Alert>
      )}
    </>
  );
};

const renderFieldDoc = (markdown: string) => (
  <div className="form-hint-doc">
    <RichTextEditorPreviewerV1
      enableSeeMoreVariant={false}
      markdown={markdown}
    />
  </div>
);

/**
 * The SSO configuration form for the profile settings modal: core-ui RJSF
 * (FormBuilderV1) over the same schema, save flow and Test Login gate as the
 * classic settings page (`useSsoConfiguration`).
 */
const SsoConfigureForm = ({
  securityConfig,
  selectedProvider,
  showHint,
  onChangeProvider,
}: SsoConfigureFormProps) => {
  const { t } = useTranslation();
  const {
    isLoading,
    isInitializing,
    internalData,
    currentProvider,
    hasExistingConfig,
    showCancelModal,
    modalSaveLoading,
    errorClearTrigger,
    metadataUploadStatus,
    setMetadataUploadStatus,
    metadataUploadFileName,
    showTestLoginModal,
    isTestingLogin,
    isAwaitingTestLoginCredentials,
    testLoginConfigurationCheck,
    testLoginResult,
    testLoginError,
    submitTestLoginCredentials,
    fieldErrorsRef,
    schema,
    uiSchema,
    customValidate,
    canTestLogin,
    isSaveGatedOnTestLogin,
    testLoginGateMessage,
    handleClearFieldError,
    handleMetadataFileUpload,
    handleOnChange,
    handleTestLogin,
    handleTestLoginModalClose,
    handleSave,
    handleCancelConfirm,
    handleCancelModalClose,
    handleCancelClick,
    handleSaveAndExit,
  } = useSsoConfiguration({
    forceEditMode: true,
    securityConfig,
    selectedProvider,
    onChangeProvider,
    scrollContainer: `[data-testid="${FORM_BODY_TEST_ID}"]`,
    errorSelector: `[data-testid="${FORM_BODY_TEST_ID}"] [aria-invalid="true"]`,
  });

  const docsBySection = useFormFieldDocs(
    PROVIDER_FILE_MAP[currentProvider ?? ''] ?? PROVIDER_FILE_MAP.general,
    'SSO'
  );

  const fieldDocs = useMemo(
    () => getFieldDocsByName(docsBySection),
    [docsBySection]
  );
  const formContext = useMemo(
    () => ({
      clearFieldError: handleClearFieldError,
      currentProvider,
      // Plain sections: no tinted background behind each field group.
      flatPropertyLayout: true,
    }),
    [handleClearFieldError, currentProvider]
  );

  const formUiSchema = useMemo(
    () =>
      toCoreUiSchema(schema, {
        ...uiSchema,
        'ui:submitButtonOptions': SUBMIT_BUTTON_OPTIONS,
      }),
    [schema, uiSchema]
  );

  // IdP metadata XML: a drop zone until a file is parsed, then its result.
  const renderSamlUpload = () =>
    metadataUploadStatus === null ? (
      <FileUpload.DropZone
        accept=".xml,application/xml,text/xml"
        allowsMultiple={false}
        clickToUploadLabel={t('label.click-to-upload')}
        data-testid="sso-saml-metadata-upload"
        hint={t('message.upload-saml-metadata-xml-description')}
        input-data-testid="sso-saml-metadata-input"
        orDragAndDropLabel={t('label.or-drag-and-drop-an-xml-file-here')}
        onDropFiles={handleMetadataFileUpload}
      />
    ) : (
      <Alert
        data-testid="sso-saml-metadata-status"
        rightContent={
          <Button
            color="link-color"
            data-testid="change-metadata-xml-btn"
            size="sm"
            onPress={() => setMetadataUploadStatus(null)}>
            {t('label.change-entity', { entity: t('label.file') })}
          </Button>
        }
        title={t(
          metadataUploadStatus === 'success'
            ? 'message.metadata-xml-file-parsed-success'
            : 'message.metadata-xml-file-parsed-error',
          { fileName: metadataUploadFileName }
        )}
        variant={metadataUploadStatus}
      />
    );

  if (isInitializing) {
    return (
      <div className="tw:px-8">
        <SettingsSkeleton rows={8} />
      </div>
    );
  }

  return (
    <Box
      className="tw:min-h-0 tw:flex-1"
      data-testid="sso-configure-form"
      direction="col">
      <div
        className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:px-8 tw:pb-6"
        data-testid={FORM_BODY_TEST_ID}>
        <Box className={FORM_CLASS_NAME} direction="col" gap={5}>
          {currentProvider === AuthProvider.Saml && renderSamlUpload()}

          <FieldDocProvider enabled={showHint}>
            <FormBuilderV1
              hideFooter
              customValidate={customValidate}
              fieldDocs={fieldDocs}
              formContext={formContext}
              formData={internalData}
              liveValidate={
                Object.keys(fieldErrorsRef.current).length > 0 ||
                errorClearTrigger > 0
              }
              schema={schema}
              uiSchema={formUiSchema}
              onChange={handleOnChange}
            />
            {showHint && (
              <FieldDocPopover
                header={
                  <Box align="center" direction="row" gap={2}>
                    <Lightbulb05 className="tw:size-4 tw:text-secondary" />
                    <Typography
                      className="tw:text-secondary"
                      size="text-sm"
                      weight="medium">
                      {t('label.form-hint')}
                    </Typography>
                  </Box>
                }
                renderDoc={renderFieldDoc}
              />
            )}
          </FieldDocProvider>

          <SsoSaveAlerts
            gateMessage={testLoginGateMessage}
            isGated={isSaveGatedOnTestLogin}
            isNewConfig={!hasExistingConfig}
            isSaving={isLoading}
            onSaveAnyway={handleSave}
          />
        </Box>
      </div>

      <Box
        className="tw:shrink-0 tw:border-t tw:border-secondary tw:bg-primary tw:px-8 tw:py-4"
        data-testid="sso-configure-footer"
        direction="row"
        gap={3}
        justify="end">
        <Button
          color="tertiary"
          data-testid="cancel-sso-configuration"
          isDisabled={isLoading}
          onPress={handleCancelClick}>
          {t('label.cancel')}
        </Button>
        {canTestLogin && (
          <Button
            color="secondary"
            data-testid="test-login-sso-configuration"
            isDisabled={isLoading || isTestingLogin}
            isLoading={isTestingLogin}
            onPress={handleTestLogin}>
            {t('label.test-login')}
          </Button>
        )}
        <Button
          color="primary"
          data-testid="save-sso-configuration"
          isDisabled={isSaveGatedOnTestLogin}
          isLoading={isLoading}
          onPress={handleSave}>
          {t('label.save')}
        </Button>
      </Box>

      <SsoTestLoginModal
        configurationCheck={testLoginConfigurationCheck}
        error={testLoginError}
        isAwaitingCredentials={isAwaitingTestLoginCredentials}
        isTesting={isTestingLogin}
        open={showTestLoginModal}
        result={testLoginResult}
        onClose={handleTestLoginModalClose}
        onSubmitCredentials={submitTestLoginCredentials}
      />
      <UnsavedChangesDialog
        isOpen={showCancelModal}
        isSaving={modalSaveLoading}
        onCancel={handleCancelModalClose}
        onDiscard={handleCancelConfirm}
        onSave={handleSaveAndExit}
      />
    </Box>
  );
};

export default SsoConfigureForm;
