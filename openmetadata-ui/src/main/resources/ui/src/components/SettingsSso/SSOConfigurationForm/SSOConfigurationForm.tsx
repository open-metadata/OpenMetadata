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
  Button as CoreButton,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Check,
  UploadCloud02,
  X,
} from '@openmetadata/ui-core-components/icons';
import Form from '@rjsf/core';
import { RegistryFieldsType, WidgetProps } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { Button, Card, Upload } from 'antd';
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
              'metadata-upload-status-icon-success': isSuccess,
              'metadata-upload-status-icon-error': !isSuccess,
            }
          )}>
          {isSuccess ? (
            <Check className="text-white" size={16} />
          ) : (
            <X className="text-white" size={16} />
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
        data-testid="change-metadata-xml-btn"
        size="small"
        type="link"
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
              <CoreButton
                color="secondary"
                data-testid="save-anyway-sso-configuration"
                isDisabled={isLoading}
                size="sm"
                onClick={handleSave}>
                {t('label.save-anyway')}
              </CoreButton>
            }
            type="warning"
          />
        )}
      </div>
    ) : null;

  const renderFormActions = () =>
    isEditMode ? (
      <>
        {renderConfigAlerts()}
        <div className="form-actions-bottom">
          <Button
            className="cancel-sso-configuration text-md"
            data-testid="cancel-sso-configuration"
            type="link"
            onClick={handleCancelClick}>
            {t('label.cancel')}
          </Button>
          {canTestLogin && (
            <Button
              className="test-login-sso-configuration text-md"
              data-testid="test-login-sso-configuration"
              disabled={isLoading || isTestingLogin || !currentProvider}
              loading={isTestingLogin}
              onClick={handleTestLogin}>
              {t('label.test-login')}
            </Button>
          )}
          <Button
            className="save-sso-configuration text-md"
            data-testid="save-sso-configuration"
            disabled={isLoading || isSaveGatedOnTestLogin}
            loading={isLoading}
            type="primary"
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

  const renderSamlUpload = () =>
    isEditMode && showForm && isSamlProvider ? (
      <div className="m-b-md">
        {metadataUploadStatus === null && (
          <Upload.Dragger
            accept=".xml,application/xml,text/xml"
            beforeUpload={(file) => {
              const dataTransfer = new DataTransfer();
              dataTransfer.items.add(file);
              handleMetadataFileUpload(dataTransfer.files);

              return false;
            }}
            className="saml-metadata-upload-drop-zone"
            data-testid="file-uploader"
            multiple={false}
            showUploadList={false}>
            <div
              className="flex flex-center flex-column gap-1"
              data-testid="file-upload-drop-zone">
              <div
                className="flex flex-shrink items-center justify-center bg-white border border-radius-xs"
                style={{ width: '40px', height: '40px' }}>
                <UploadCloud02 className="text-grey-600" size={20} />
              </div>
              <div
                className="flex align-center flex-wrap gap-4 justify-center"
                style={{ maxWidth: '220px' }}>
                <Typography className="font-medium">
                  {t('label.click-to')}{' '}
                  <Button
                    className="h-auto p-0 font-semibold"
                    size="small"
                    type="link">
                    {t('label.upload-lowercase')}
                  </Button>{' '}
                  {t('label.or-drag-and-drop-an-xml-file-here')}
                </Typography>
              </div>
              <Typography className="text-xs" color="secondary">
                {t('message.upload-saml-metadata-xml-description')}
              </Typography>
            </div>
          </Upload.Dragger>
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
              <img
                alt={getProviderDisplayName(currentProvider)}
                height={22}
                src={getProviderIcon(currentProvider) as string}
                width={22}
              />
            )}
          </div>
          <Typography as="h1" className="sso-provider-title m-0 text-md">
            {getProviderDisplayName(currentProvider)} {t('label.set-up')}
          </Typography>
        </div>
        {hasExistingConfig && onChangeProvider && (
          <Button
            data-testid="change-provider-button"
            type="link"
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
