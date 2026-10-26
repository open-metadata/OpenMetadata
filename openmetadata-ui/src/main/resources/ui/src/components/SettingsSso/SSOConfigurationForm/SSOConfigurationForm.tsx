/*
 *  Copyright 2025 Collate.
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
  Card,
  FileUploadDropZone,
  Typography,
} from '@openmetadata/ui-core-components';
import { Check, XClose } from '@openmetadata/ui-core-components/icons';
import Form from '@rjsf/core';
import { RegistryFieldsType, WidgetProps } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import classNames from 'classnames';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthProvider } from '../../../generated/settings/settings';
import { transformErrors } from '../../../utils/formPureUtils';
import {
  createDOMClickHandler,
  createDOMFocusHandler,
  createFormKeyDownHandler,
  getProviderDisplayName,
  getProviderIcon,
  ProviderIcon,
} from '../../../utils/SSOUtils';
import DescriptionFieldTemplate from '../../common/Form/JSONSchema/JSONSchemaTemplate/DescriptionFieldTemplate';
import { FieldErrorTemplate } from '../../common/Form/JSONSchema/JSONSchemaTemplate/FieldErrorTemplate/FieldErrorTemplate';
import LdapRoleMappingWidget from '../../common/Form/JSONSchema/JsonSchemaWidgets/LdapRoleMappingWidget/LdapRoleMappingWidget';
import CoreSelectWidget from '../../common/FormBuilderV1/widgets/CoreSelectWidget';
import InlineAlert from '../../common/InlineAlert/InlineAlert';
import Loader from '../../common/Loader/Loader';
import ResizablePanels from '../../common/ResizablePanels/ResizablePanels';
import { UnsavedChangesModal } from '../../Modals/UnsavedChangesModal/UnsavedChangesModal.component';
import ProviderSelector from '../ProviderSelector/ProviderSelector';
import SSODocPanel from '../SSODocPanel/SSODocPanel';
import { SSOFieldTemplate } from '../SSOFieldTemplate/SSOFieldTemplate';
import { SSOGroupedFieldTemplate } from '../SSOGroupedFieldTemplate/SSOGroupedFieldTemplate';
import SsoProviderIcon from '../SsoProviderIcon/SsoProviderIcon';
import SsoTestLoginModal from '../SsoTestLogin/SsoTestLoginModal';
import { useSsoConfiguration } from '../useSsoConfiguration';
import './sso-configuration-form.less';
import { SSOConfigurationFormProps } from './SSOConfigurationForm.interface';
import SsoConfigurationFormArrayFieldTemplate from './SsoConfigurationFormArrayFieldTemplate';
import SsoRolesSelectField from './SsoRolesSelectField';

interface MetadataUploadStatusCardProps {
  status: 'success' | 'error';
  fileName: string;
  onChangeFile: () => void;
}

const MetadataUploadStatusCard = ({
  status,
  fileName,
  onChangeFile,
}: MetadataUploadStatusCardProps) => {
  const { t } = useTranslation();
  const isSuccess = status === 'success';

  return (
    <div className="flex items-center justify-between p-xs metadata-upload-status-container">
      <div className="flex items-center gap-2">
        <div
          className={classNames(
            'flex-shrink flex items-center justify-center rounded-full w-6 h-6',
            {
              'tw:bg-success-solid': isSuccess,
              'tw:bg-error-solid': !isSuccess,
            }
          )}>
          {isSuccess ? (
            <Check className="tw:text-fg-white tw:shrink-0" size={16} />
          ) : (
            <XClose className="tw:text-fg-white tw:shrink-0" size={16} />
          )}
        </div>
        <Typography className="text-grey-body text-sm font-medium">
          {t(
            isSuccess
              ? 'message.metadata-xml-file-parsed-success'
              : 'message.metadata-xml-file-parsed-error',
            { fileName }
          )}
        </Typography>
      </div>
      <Button
        color="link-color"
        data-testid="change-metadata-xml-btn"
        size="xs"
        onClick={onChangeFile}>
        {t('label.change-entity', { entity: t('label.file') })}
      </Button>
    </div>
  );
};

// SSOFieldTemplate draws the label, description and errors around the widget,
// so the select renders only its control.
const SsoSelectWidget = (props: WidgetProps) => (
  <CoreSelectWidget
    {...props}
    hideLabel
    options={{ ...props.options, help: undefined }}
    rawErrors={undefined}
    schema={{ ...props.schema, description: undefined }}
  />
);

const widgets = {
  SelectWidget: SsoSelectWidget,
  LdapRoleMappingWidget: LdapRoleMappingWidget,
};

const SSOConfigurationFormRJSF = ({
  forceEditMode = false,
  onChangeProvider,
  onProviderSelect,
  selectedProvider,
  hideBorder = false,
  securityConfig,
  managedPaths,
  isReadOnly = false,
}: SSOConfigurationFormProps) => {
  const { t } = useTranslation();
  const [activeField, setActiveField] = useState<string>('');
  const {
    isEditMode,
    isLoading,
    isInitializing,
    internalData,
    currentProvider,
    showProviderSelector,
    hasExistingConfig,
    showForm,
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
    canChangeProvider,
    canUploadSamlMetadata,
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
    handleProviderSelect,
  } = useSsoConfiguration({
    forceEditMode,
    onChangeProvider,
    onProviderSelect,
    selectedProvider,
    securityConfig,
    managedPaths,
    isReadOnly,
  });

  const customFields: RegistryFieldsType = {
    ArrayField: SsoConfigurationFormArrayFieldTemplate,
    RolesSelectField: SsoRolesSelectField,
  };

  // Add DOM event listeners for field focus tracking
  useEffect(() => {
    const handleDOMFocus = createDOMFocusHandler(setActiveField);
    const handleDOMClick = createDOMClickHandler(setActiveField);
    const handleKeyDown = createFormKeyDownHandler();

    // Add event listeners when form is shown
    if (showForm) {
      document.addEventListener('focusin', handleDOMFocus);
      document.addEventListener('click', handleDOMClick, true);
      document.addEventListener('keydown', handleKeyDown, true);
    }

    return () => {
      document.removeEventListener('focusin', handleDOMFocus);
      document.removeEventListener('click', handleDOMClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [showForm]);

  const renderConfigAlerts = () =>
    !hasExistingConfig || isSaveGatedOnTestLogin ? (
      <div className="tw:mt-4 tw:flex tw:flex-col tw:gap-4">
        {!hasExistingConfig && (
          <InlineAlert
            alertClassName="sso-save-warning"
            description={t('message.sso-new-config-save-warning')}
            heading={t('label.warning')}
            type="warning"
          />
        )}
        {isSaveGatedOnTestLogin && (
          <InlineAlert
            alertClassName="sso-test-login-required"
            description={testLoginGateMessage}
            heading={t('label.test-login')}
            subDescription={
              <Button
                color="secondary"
                data-testid="save-anyway-sso-configuration"
                isDisabled={isLoading}
                size="sm"
                onClick={handleSave}>
                {t('label.save-anyway')}
              </Button>
            }
            type="warning"
          />
        )}
      </div>
    ) : null;

  const renderFormActions = () =>
    isEditMode && !isReadOnly ? (
      <>
        {renderConfigAlerts()}
        <div className="form-actions-bottom">
          <Button
            color="secondary"
            data-testid="cancel-sso-configuration"
            onClick={handleCancelClick}>
            {t('label.cancel')}
          </Button>
          {canTestLogin && (
            <Button
              color="secondary"
              data-testid="test-login-sso-configuration"
              isDisabled={isLoading || isTestingLogin || !currentProvider}
              isLoading={isTestingLogin}
              onClick={handleTestLogin}>
              {t('label.test-login')}
            </Button>
          )}
          <Button
            color="primary"
            data-testid="save-sso-configuration"
            isDisabled={isLoading || isSaveGatedOnTestLogin}
            isLoading={isLoading}
            onClick={handleSave}>
            {t('label.save')}
          </Button>
        </div>
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
      </>
    ) : null;

  if (isInitializing) {
    return <Loader data-testid="loader" />;
  }

  // If we have an onChangeProvider callback, don't show internal provider selector
  // The parent component (SettingsSso) will handle provider selection
  if (showProviderSelector && !onChangeProvider) {
    return (
      <Card
        className="sso-provider-selection flex-col"
        data-testid="sso-configuration-form-card">
        <ProviderSelector
          selectedProvider={currentProvider as AuthProvider}
          onProviderSelect={handleProviderSelect}
        />
      </Card>
    );
  }

  const isSamlProvider = currentProvider === AuthProvider.Saml;
  const showSamlUpload =
    isEditMode && showForm && isSamlProvider && canUploadSamlMetadata;

  const renderSamlUpload = () =>
    showSamlUpload ? (
      <div className="m-b-md">
        {metadataUploadStatus === null && (
          <FileUploadDropZone
            accept=".xml,application/xml,text/xml"
            allowsMultiple={false}
            clickToUploadLabel={t('label.upload-lowercase')}
            data-testid="file-uploader"
            hint={t('message.upload-saml-metadata-xml-description')}
            input-data-testid="file-upload-input"
            orDragAndDropLabel={t('label.or-drag-and-drop-an-xml-file-here')}
            onDropFiles={handleMetadataFileUpload}
            onDropUnacceptedFiles={handleMetadataFileUpload}
          />
        )}
        {metadataUploadStatus !== null && (
          <MetadataUploadStatusCard
            fileName={metadataUploadFileName}
            status={metadataUploadStatus}
            onChangeFile={() => setMetadataUploadStatus(null)}
          />
        )}
      </div>
    ) : null;

  const renderSsoForm = () =>
    isEditMode && showForm ? (
      <Form
        focusOnFirstError
        noHtml5Validate
        className="rjsf no-header"
        customValidate={customValidate}
        disabled={isReadOnly}
        fields={customFields}
        formContext={{
          clearFieldError: handleClearFieldError,
          currentProvider,
        }}
        formData={internalData}
        idSeparator="/"
        liveValidate={
          Object.keys(fieldErrorsRef.current).length > 0 ||
          errorClearTrigger > 0
        }
        schema={schema}
        showErrorList={false}
        templates={{
          DescriptionFieldTemplate: DescriptionFieldTemplate,
          FieldErrorTemplate: FieldErrorTemplate,
          FieldTemplate: SSOFieldTemplate,
          ObjectFieldTemplate: SSOGroupedFieldTemplate,
        }}
        transformErrors={transformErrors}
        uiSchema={{
          ...uiSchema,
          'ui:submitButtonOptions': {
            submitText: '',
            norender: true,
          },
        }}
        validator={validator}
        widgets={widgets}
        onChange={handleOnChange}
      />
    ) : null;

  const formContent = (
    <>
      {renderSamlUpload()}
      {renderSsoForm()}
    </>
  );

  // If hideBorder is true, render form with ResizablePanels but without Card wrapper and header
  if (hideBorder) {
    return (
      <>
        <UnsavedChangesModal
          discardText={t('label.discard')}
          loading={modalSaveLoading}
          open={showCancelModal}
          saveText={t('label.save-changes')}
          title={t('message.unsaved-changes')}
          onCancel={handleCancelModalClose}
          onDiscard={handleCancelConfirm}
          onSave={handleSaveAndExit}
        />

        <ResizablePanels
          className="content-height-with-resizable-panel sso-configured"
          data-testid="resizable-panels"
          firstPanel={{
            children: (
              <>
                {formContent}
                {renderFormActions()}
              </>
            ),
            minWidth: 400,
            flex: 0.5,
            className: 'content-resizable-panel-container sso-configured m-t-2',
          }}
          secondPanel={{
            children: (
              <SSODocPanel
                activeField={activeField}
                serviceName={currentProvider || 'general'}
              />
            ),
            minWidth: 400,
            flex: 0.5,
            className:
              'service-doc-panel content-resizable-panel-container m-t-xs',
          }}
        />
      </>
    );
  }

  const renderProviderHeader = () =>
    currentProvider ? (
      <div className="sso-provider-form-header flex items-center justify-between">
        <div className="flex align-items-center gap-2 flex items-center">
          <div className="provider-icon-container">
            {getProviderIcon(currentProvider) && (
              <SsoProviderIcon
                alt={getProviderDisplayName(currentProvider)}
                icon={getProviderIcon(currentProvider) as ProviderIcon}
                size={22}
              />
            )}
          </div>
          <Typography as="h1" className="sso-provider-title m-0 text-md">
            {getProviderDisplayName(currentProvider)} {t('label.set-up')}
          </Typography>
        </div>
        {hasExistingConfig && onChangeProvider && canChangeProvider && (
          <Button
            color="link-color"
            data-testid="change-provider-button"
            onClick={onChangeProvider}>
            {t('label.change-provider')}
          </Button>
        )}
      </div>
    ) : null;

  const wrappedFormContent = (
    <Card
      className="sso-configuration-form-card flex-col p-0"
      data-testid="sso-configuration-form-card">
      {/* SSO Provider Header */}
      {renderProviderHeader()}
      {formContent}
    </Card>
  );

  return (
    <>
      <UnsavedChangesModal
        discardText={t('label.discard')}
        loading={modalSaveLoading}
        open={showCancelModal}
        saveText={t('label.save-changes')}
        title={t('message.unsaved-changes')}
        onCancel={handleCancelModalClose}
        onDiscard={handleCancelConfirm}
        onSave={handleSaveAndExit}
      />

      <ResizablePanels
        className="content-height-with-resizable-panel"
        data-testid="resizable-panels"
        firstPanel={{
          children: (
            <>
              <div className="sso-form-sticky-header" />
              {wrappedFormContent}
              {renderFormActions()}
            </>
          ),
          minWidth: 700,
          flex: 0.7,
          className: 'content-resizable-panel-container',
        }}
        secondPanel={{
          children: (
            <SSODocPanel
              activeField={activeField}
              serviceName={currentProvider || 'general'}
            />
          ),
          minWidth: 400,
          className: 'service-doc-panel content-resizable-panel-container',
        }}
      />
    </>
  );
};

export default SSOConfigurationFormRJSF;
