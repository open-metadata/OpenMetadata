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

import { removeSession } from '@analytics/session-utils';
import Form, { IChangeEvent } from '@rjsf/core';
import {
  CustomValidator,
  ErrorSchema,
  FormValidation,
  RegistryFieldsType,
  RJSFSchema,
} from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { Button, Card, Typography } from 'antd';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { compare } from 'fast-json-patch';
import {
  AuthenticationConfiguration,
  AuthorizerConfiguration,
  getSSOUISchema,
  GOOGLE_SSO_DEFAULTS,
  NON_OIDC_SPECIFIC_FIELDS,
  OIDC_SPECIFIC_FIELDS,
  VALIDATION_STATUS,
} from '../../../constants/SSO.constant';
import { User } from '../../../generated/entity/teams/user';
import { AuthProvider, ClientType } from '../../../generated/settings/settings';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import authenticationConfigSchema from '../../../jsons/configuration/authenticationConfiguration.json';
import authorizerConfigSchema from '../../../jsons/configuration/authorizerConfiguration.json';
import {
  applySecurityConfiguration,
  getSecurityConfiguration,
  patchSecurityConfiguration,
  SecurityConfiguration,
  SecurityValidationResponse,
  validateSecurityConfiguration,
} from '../../../rest/securityConfigAPI';
import {
  createScrollToErrorHandler,
  transformErrors,
} from '../../../utils/formUtils';
import {
  applySamlConfiguration,
  cleanupProviderSpecificFields,
  clearFieldError,
  createDOMClickHandler,
  createDOMFocusHandler,
  createFreshFormData,
  findChangedFields,
  getProviderDisplayName,
  getProviderIcon,
  handleClientTypeChange,
  hasFieldValidationErrors,
  isValidNonBasicProvider,
  parseValidationErrors,
  removeRequiredFields,
  removeSchemaFields,
  updateLoadingState,
} from '../../../utils/SSOUtils';
import {
  setOidcToken,
  setRefreshToken,
} from '../../../utils/SwTokenStorageUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import DescriptionFieldTemplate from '../../common/Form/JSONSchema/JSONSchemaTemplate/DescriptionFieldTemplate';
import { FieldErrorTemplate } from '../../common/Form/JSONSchema/JSONSchemaTemplate/FieldErrorTemplate/FieldErrorTemplate';
import LdapRoleMappingWidget from '../../common/Form/JSONSchema/JsonSchemaWidgets/LdapRoleMappingWidget/LdapRoleMappingWidget';
import SelectWidget from '../../common/Form/JSONSchema/JsonSchemaWidgets/SelectWidget';
import Loader from '../../common/Loader/Loader';
import ResizablePanels from '../../common/ResizablePanels/ResizablePanels';
import { UnsavedChangesModal } from '../../Modals/UnsavedChangesModal/UnsavedChangesModal.component';
import ProviderSelector from '../ProviderSelector/ProviderSelector';
import SSODocPanel from '../SSODocPanel/SSODocPanel';
import { SSOGroupedFieldTemplate } from '../SSOGroupedFieldTemplate/SSOGroupedFieldTemplate';
import './sso-configuration-form.less';
import {
  FormData,
  SSOConfigurationFormProps,
  UISchemaObject,
} from './SSOConfigurationForm.interface';
import SsoConfigurationFormArrayFieldTemplate from './SsoConfigurationFormArrayFieldTemplate';

const widgets = {
  SelectWidget: SelectWidget,
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
  const { setIsAuthenticated, setCurrentUser } = useApplicationStore();

  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [internalData, setInternalData] = useState<FormData | undefined>();
  const [savedData, setSavedData] = useState<FormData | undefined>();
  const [currentProvider, setCurrentProvider] = useState<string | undefined>();
  const [showProviderSelector, setShowProviderSelector] =
    useState<boolean>(false);
  const [hasExistingConfig, setHasExistingConfig] = useState<boolean>(false);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [activeField, setActiveField] = useState<string>('');
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [modalSaveLoading, setModalSaveLoading] = useState<boolean>(false);
  const [isModalSave, setIsModalSave] = useState<boolean>(false);
  const [errorClearTrigger, setErrorClearTrigger] = useState<number>(0);
  const fieldErrorsRef = useRef<ErrorSchema>({});

  // Helper function to setup configuration state - extracted to avoid redundancy
  const setupConfigurationState = useCallback(
    (config: SecurityConfiguration) => {
      if (!isValidNonBasicProvider(config)) {
        setShowProviderSelector(true);

        return;
      }

      setHasExistingConfig(true);
      setCurrentProvider(config.authenticationConfiguration.provider);

      const configData = {
        authenticationConfiguration: config.authenticationConfiguration,
        authorizerConfiguration: config.authorizerConfiguration,
      };

      if (config.authenticationConfiguration.provider === AuthProvider.Saml) {
        applySamlConfiguration(configData);
      }

      setSavedData(configData);
      setInternalData(configData);
      setShowForm(true);

      if (forceEditMode) {
        setIsEditMode(true);
        setShowForm(true);
      }
    },
    [forceEditMode]
  );

  // Fetch existing configuration on mount (only if no selectedProvider is passed and no securityConfig provided)
  useEffect(() => {
    const fetchExistingConfig = async () => {
      try {
        if (selectedProvider) {
          setIsInitializing(false);

          return;
        }

        // Only fetch if no securityConfig is provided
        if (!securityConfig) {
          const response = await getSecurityConfiguration();
          const config = response.data;
          setupConfigurationState(config);
        }
      } catch {
        // No existing configuration, show provider selector
        setShowProviderSelector(true);
      } finally {
        setIsInitializing(false);
      }
    };

    // Only run if no securityConfig is provided by parent
    if (securityConfig) {
      setIsInitializing(false);
    } else {
      fetchExistingConfig();
    }
  }, [selectedProvider, setupConfigurationState, securityConfig]);

  // Separate effect to handle securityConfig changes
  useEffect(() => {
    if (securityConfig && !selectedProvider) {
      setupConfigurationState(securityConfig);
    }
  }, [securityConfig, selectedProvider, setupConfigurationState]);

  // Handle selectedProvider prop - initialize fresh form when provider is selected
  useEffect(() => {
    if (!selectedProvider) {
      return;
    }

    // If provider is Basic, show provider selector instead
    if (selectedProvider === AuthProvider.Basic) {
      setShowProviderSelector(true);
      setShowForm(false);
      setIsEditMode(false);
      setIsInitializing(false);

      return;
    }

    // Clear all existing state first
    setHasExistingConfig(false);
    setSavedData(undefined);

    // Initialize fresh form data for the selected provider
    setCurrentProvider(selectedProvider);
    setIsEditMode(true);
    setShowForm(true);
    setShowProviderSelector(false);
    setIsInitializing(false);

    // Create fresh form data using utility function
    const freshFormData = createFreshFormData(selectedProvider as AuthProvider);
    setInternalData(freshFormData);
  }, [selectedProvider]);

  const scrollToFirstError = useCallback(
    createScrollToErrorHandler({
      scrollContainer: '.ant-card',
      errorSelector: '.field-error.has-error, .ant-form-item-explain-error',
      offsetTop: 100,
      delay: 100,
      behavior: 'smooth',
    }),
    []
  );

  // Wrapper for clearFieldError to work with useCallback and ref
  const handleClearFieldError = useCallback((fieldPath: string) => {
    clearFieldError(fieldErrorsRef, fieldPath);
  }, []);

  const handleValidationErrors = useCallback(
    (
      validationResult:
        | SecurityValidationResponse
        | { status: string; errors: Array<{ field: string; error: string }> }
    ) => {
      if (
        'errors' in validationResult &&
        Array.isArray(validationResult.errors)
      ) {
        // Separate field errors from general errors
        const fieldErrors = validationResult.errors.filter(
          (e) => e.field && e.field.trim() !== ''
        );
        const generalErrors = validationResult.errors.filter(
          (e) => !e.field || e.field.trim() === ''
        );

        // Parse field-level errors
        if (fieldErrors.length > 0) {
          const errorSchema = parseValidationErrors(fieldErrors);

          // Store in ref immediately - this is what customValidate will use
          fieldErrorsRef.current = errorSchema;

          // Scroll to the first error field
          scrollToFirstError();
        }

        // Show toast only for general errors (no field specified)
        if (generalErrors.length > 0) {
          for (const error of generalErrors) {
            showErrorToast(error.error);
          }
        }
      }
    },
    [parseValidationErrors]
  );

  const getProviderSpecificSchema = (
    provider: string | undefined,
    isConfigured = false
  ) => {
    const createSchemaWithAuth = (authSchema: Record<string, unknown>) => ({
      properties: {
        authenticationConfiguration: authSchema,
        authorizerConfiguration: authorizerConfigSchema,
      },
    });

    if (!provider) {
      return createSchemaWithAuth(authenticationConfigSchema) as RJSFSchema;
    }

    // Deep clone the schema to avoid mutating the original
    const authSchema = structuredClone(authenticationConfigSchema);

    // For configured SSO, remove providerName from required fields
    if (isConfigured) {
      removeRequiredFields(authSchema, ['providerName']);
    }

    // Provider-specific schema modifications
    if (provider === AuthProvider.Saml) {
      removeSchemaFields(authSchema, OIDC_SPECIFIC_FIELDS);
      removeRequiredFields(authSchema, OIDC_SPECIFIC_FIELDS);
    } else if (provider === AuthProvider.LDAP) {
      removeSchemaFields(authSchema, OIDC_SPECIFIC_FIELDS);
      removeRequiredFields(authSchema, OIDC_SPECIFIC_FIELDS);
    } else if (provider === AuthProvider.CustomOidc) {
      removeSchemaFields(authSchema, NON_OIDC_SPECIFIC_FIELDS);
      removeRequiredFields(authSchema, NON_OIDC_SPECIFIC_FIELDS);
    }

    return createSchemaWithAuth(authSchema) as RJSFSchema;
  };

  const customFields: RegistryFieldsType = {
    ArrayField: SsoConfigurationFormArrayFieldTemplate,
  };

  const schema = useMemo(() => {
    return getProviderSpecificSchema(currentProvider, hasExistingConfig);
  }, [currentProvider, hasExistingConfig]);

  // Dynamic UI schema using the optimized constants
  // Custom validate function to inject our validation errors
  const customValidate: CustomValidator<FormData> = useCallback(
    (_formData: FormData | undefined, errors: FormValidation<FormData>) => {
      if (
        !fieldErrorsRef.current ||
        Object.keys(fieldErrorsRef.current).length === 0
      ) {
        return errors;
      }

      // Helper to add error messages to form validation object
      const addErrorMessages = (
        errorMessages: string[],
        formErrorObj: FormValidation<unknown>
      ): void => {
        if (typeof formErrorObj.addError === 'function') {
          for (const msg of errorMessages) {
            formErrorObj.addError(msg);
          }
        } else {
          formErrorObj.__errors ??= [];

          formErrorObj.__errors.push(...errorMessages);
        }
      };

      // Helper to recursively add errors from error schema to form errors
      const applyErrorsRecursively = (
        errorSchema: ErrorSchema,
        formErrors: FormValidation<unknown>
      ): void => {
        for (const [key, value] of Object.entries(errorSchema)) {
          if (key === '__errors' && Array.isArray(value)) {
            addErrorMessages(value, formErrors);
          } else if (value && typeof value === 'object') {
            const formErrorsRecord = formErrors as unknown as Record<
              string,
              FormValidation<unknown>
            >;
            formErrorsRecord[key] ??= {} as FormValidation<unknown>;
            applyErrorsRecursively(value as ErrorSchema, formErrorsRecord[key]);
          }
        }
      };

      // Helper to apply errors for a specific configuration section
      const applyConfigurationErrors = <T,>(
        configKey: 'authenticationConfiguration' | 'authorizerConfiguration'
      ): void => {
        const fieldErrors = fieldErrorsRef.current?.[configKey];
        if (!fieldErrors) {
          return;
        }

        errors[configKey] ??= {} as FormValidation<T>;

        applyErrorsRecursively(
          fieldErrors,
          errors[configKey] as FormValidation<unknown>
        );
      };

      applyConfigurationErrors<AuthenticationConfiguration>(
        'authenticationConfiguration'
      );
      applyConfigurationErrors<AuthorizerConfiguration>(
        'authorizerConfiguration'
      );

      return errors;
    },
    []
  );

  const uiSchema = useMemo(() => {
    if (!currentProvider) {
      return {};
    }
    const baseSchema = getSSOUISchema(currentProvider, hasExistingConfig);

    const currentClientType =
      internalData?.authenticationConfiguration?.clientType;

    const authConfig = baseSchema.authenticationConfiguration as UISchemaObject;

    // Always hide provider field since we have separate provider selection screen
    authConfig.provider = {
      'ui:widget': 'hidden',
      'ui:hideError': true,
    };

    // Make clientType non-editable for existing SSO configurations
    // Hide clientType for SAML/LDAP since they're always public
    if (
      (hasExistingConfig && savedData) ||
      currentProvider === AuthProvider.Saml ||
      currentProvider === AuthProvider.LDAP
    ) {
      authConfig.clientType = {
        'ui:widget': 'hidden',
        'ui:hideError': true,
      };
    }

    // Show oidcConfiguration for confidential clients, hide for public clients
    if (currentClientType === ClientType.Public) {
      authConfig.oidcConfiguration = {
        'ui:widget': 'hidden',
        'ui:hideError': true,
      };
      // Ensure callback URL is visible for public clients
      authConfig.callbackUrl = {
        'ui:title': 'Callback URL',
        'ui:placeholder': 'e.g. https://myapp.com/auth/callback',
      } as UISchemaObject;
      // Ensure publicKeyUrls is visible for public clients (not auto-populated)
      authConfig.publicKeyUrls = {
        'ui:title': 'Public Key URLs',
        'ui:placeholder':
          'Enter value (e.g. https://www.googleapis.com/oauth2/v3/certs) and press ENTER',
      } as UISchemaObject;
      // Ensure authority is visible for public clients
      authConfig.authority = {
        'ui:title': 'Authority',
        'ui:placeholder': 'e.g. https://accounts.google.com',
      } as UISchemaObject;
    } else if (currentClientType === ClientType.Confidential) {
      // The schema will be shown with OIDC prefixed labels from the constants
      authConfig['oidcConfiguration'] ??= {
        'ui:title': 'OIDC Configuration',
      };
      // Hide root-level clientId and callbackUrl for confidential clients since we have OIDC equivalents
      authConfig.clientId = {
        'ui:widget': 'hidden',
        'ui:hideError': true,
      };
      authConfig.callbackUrl = {
        'ui:widget': 'hidden',
        'ui:hideError': true,
      };

      // For Google, show authority even in Confidential mode
      const isGoogle = currentProvider === AuthProvider.Google;
      if (isGoogle) {
        authConfig.authority = {
          'ui:title': 'Authority',
          'ui:placeholder': GOOGLE_SSO_DEFAULTS.authority,
        } as UISchemaObject;
      }
    }

    const finalSchema = {
      ...baseSchema,
      authenticationConfiguration: {
        ...baseSchema.authenticationConfiguration,
        ...authConfig,
        'ui:classNames': 'hide-section-title',
      },
      authorizerConfiguration: {
        ...baseSchema.authorizerConfiguration,
        'ui:classNames': 'hide-section-title',
      },
    };

    return finalSchema;
  }, [
    currentProvider,
    internalData?.authenticationConfiguration?.clientType,
    hasExistingConfig,
    savedData,
    hideBorder,
  ]);

  // Handle form data changes
  const handleOnChange = (e: IChangeEvent<FormData>) => {
    if (e.formData) {
      const newFormData = { ...e.formData };
      const authConfig = newFormData.authenticationConfiguration;

      // Clear field-specific errors for changed fields
      if (
        fieldErrorsRef.current &&
        Object.keys(fieldErrorsRef.current).length > 0
      ) {
        const changedFields = findChangedFields(internalData, newFormData);
        if (changedFields.length > 0) {
          for (const fieldPath of changedFields) {
            handleClearFieldError(fieldPath);
          }
          // Force form to re-render and re-validate with cleared errors
          setErrorClearTrigger((prev) => prev + 1);
        }
      }

      // Handle client type changes (Confidential ↔ Public transitions)
      const previousClientType =
        internalData?.authenticationConfiguration?.clientType;
      const newClientType = authConfig?.clientType;

      handleClientTypeChange(authConfig, previousClientType, newClientType);

      setInternalData(newFormData);

      // Check if provider changed
      const newProvider = newFormData?.authenticationConfiguration?.provider;
      if (newProvider && newProvider !== currentProvider) {
        setCurrentProvider(newProvider);
        // Notify parent component about provider change
        if (onProviderSelect) {
          onProviderSelect(newProvider as AuthProvider);
        }
      }
    }
  };

  // Add DOM event listeners for field focus tracking
  useEffect(() => {
    const handleDOMFocus = createDOMFocusHandler(setActiveField);
    const handleDOMClick = createDOMClickHandler(setActiveField);

    // Add event listeners when form is shown
    if (showForm) {
      document.addEventListener('focusin', handleDOMFocus);
      document.addEventListener('click', handleDOMClick);
    }

    return () => {
      document.removeEventListener('focusin', handleDOMFocus);
      document.removeEventListener('click', handleDOMClick);
    };
  }, [showForm]);

  // Helper: Process validation error and update loading state
  const handleValidationError = useCallback(
    (
      validationResult:
        | SecurityValidationResponse
        | { status: string; errors: Array<{ field: string; error: string }> }
    ) => {
      handleValidationErrors(validationResult);
      updateLoadingState(isModalSave, setIsLoading, false);
    },
    [isModalSave, handleValidationErrors]
  );

  // Helper: Process API error response
  const handleApiError = useCallback(
    (error: unknown) => {
      if (hasFieldValidationErrors(error)) {
        handleValidationErrors(error.response.data);
      } else {
        showErrorToast(error as AxiosError);
      }
      updateLoadingState(isModalSave, setIsLoading, false);
    },
    [isModalSave, handleValidationErrors]
  );

  // Helper: Validate new SSO configuration
  const validateConfiguration = useCallback(
    async (payload: SecurityConfiguration): Promise<boolean> => {
      try {
        const validationResponse: {
          data:
            | SecurityValidationResponse
            | {
                status: string;
                errors: Array<{ field: string; error: string }>;
              };
        } = await validateSecurityConfiguration(payload);
        const validationResult = validationResponse.data;

        // Check for field-level errors (new format)
        if (
          'errors' in validationResult &&
          Array.isArray(validationResult.errors) &&
          validationResult.errors.length > 0
        ) {
          handleValidationError(validationResult);

          return false;
        }

        // Check for status-based errors (old format)
        if (
          validationResult.status === 'failed' ||
          validationResult.status !== VALIDATION_STATUS.SUCCESS
        ) {
          handleValidationError(validationResult);

          return false;
        }

        return true;
      } catch (error) {
        handleApiError(error);

        return false;
      }
    },
    [handleValidationError, handleApiError]
  );

  // Helper: Save existing configuration using PATCH
  const saveExistingConfiguration = useCallback(
    async (cleanedFormData: FormData): Promise<boolean> => {
      if (!savedData) {
        return false;
      }

      const allPatches = compare(savedData, cleanedFormData);
      if (allPatches.length > 0) {
        await patchSecurityConfiguration(allPatches);
      }

      return true;
    },
    [savedData]
  );

  // Helper: Save new configuration with validation
  const saveNewConfiguration = useCallback(
    async (payload: SecurityConfiguration): Promise<boolean> => {
      const isValid = await validateConfiguration(payload);
      if (!isValid) {
        return false;
      }

      await applySecurityConfiguration(payload);

      return true;
    },
    [validateConfiguration]
  );

  // Helper: Handle post-save actions (logout or success toast)
  const handlePostSaveActions = useCallback(
    async (cleanedFormData: FormData) => {
      if (hasExistingConfig) {
        // For existing configs, update saved data and show success
        setSavedData(cleanedFormData);
        updateLoadingState(isModalSave, setIsLoading, false);
        showSuccessToast(t('message.configuration-save-success'));
      } else {
        // For new configs, clear session and redirect to signin
        try {
          sessionStorage.clear();
          localStorage.clear();
          await setOidcToken('');
          await setRefreshToken('');
          setIsAuthenticated(false);
          setCurrentUser({} as User);
          removeSession();
        } catch {
          // Silent fail for storage operations
        }
        globalThis.location.replace('/signin');
      }
    },
    [hasExistingConfig, isModalSave, t, setIsAuthenticated, setCurrentUser]
  );

  const handleSave = async () => {
    updateLoadingState(isModalSave, setIsLoading, true);
    fieldErrorsRef.current = {};
    setErrorClearTrigger(0);

    try {
      // Prepare payload
      const cleanedFormData = cleanupProviderSpecificFields(
        internalData,
        internalData?.authenticationConfiguration?.provider as string
      );

      if (!cleanedFormData) {
        updateLoadingState(isModalSave, setIsLoading, false);

        return;
      }

      const payload: SecurityConfiguration = {
        authenticationConfiguration:
          cleanedFormData.authenticationConfiguration,
        authorizerConfiguration: cleanedFormData.authorizerConfiguration,
      };

      // Save configuration (PATCH for existing, PUT with validation for new)
      try {
        const success =
          hasExistingConfig && savedData
            ? await saveExistingConfiguration(cleanedFormData)
            : await saveNewConfiguration(payload);

        if (!success) {
          return;
        }
      } catch (error) {
        handleApiError(error);

        return;
      }

      // Handle post-save actions
      await handlePostSaveActions(cleanedFormData);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('message.configuration-save-failed');
      showErrorToast(errorMessage);
      updateLoadingState(isModalSave, setIsLoading, false);
    } finally {
      updateLoadingState(isModalSave, setIsLoading, false);
    }
  };

  const handleCancelConfirm = () => {
    setShowCancelModal(false);
    fieldErrorsRef.current = {};
    setErrorClearTrigger(0);

    // For existing/configured SSO, discard changes and stay on the same page
    if (hasExistingConfig && savedData) {
      setInternalData(savedData);

      return;
    }

    // For new SSO setup, reset to provider selection
    setShowProviderSelector(true);
    setShowForm(false);
    setIsEditMode(false);
    setCurrentProvider(undefined);
    setInternalData(undefined);
    setSavedData(undefined);
    setHasExistingConfig(false);

    // Notify parent component about change
    if (onChangeProvider) {
      onChangeProvider();
    }
  };

  const handleCancelModalClose = () => {
    setShowCancelModal(false);
  };

  // Handle cancel button click
  const handleCancelClick = () => {
    // Always show the modal - let the user decide what they want to do
    setShowCancelModal(true);
  };

  const handleSaveAndExit = async () => {
    setModalSaveLoading(true);
    setIsModalSave(true);

    try {
      if (internalData) {
        await handleSave();
      }

      setShowCancelModal(false);
      setModalSaveLoading(false);
      setIsModalSave(false);

      // If existing config is present, just save and do nothing (stay on form)
      if (hasExistingConfig) {
        // For existing config, just close modal and stay on form - no logout process
        return;
      }

      // If fresh/new form, proceed with logout process and redirect
      // This will trigger the logout and sign-in redirect process
      handleCancelConfirm();
    } catch {
      setShowCancelModal(false);
      setModalSaveLoading(false);
      setIsModalSave(false);
    }
  };

  const handleProviderSelect = (provider: AuthProvider) => {
    // If selecting a new provider when one already exists, don't overwrite the saved data
    setCurrentProvider(provider);
    setShowProviderSelector(false);
    setShowForm(true);
    setIsEditMode(true);

    if (onProviderSelect) {
      onProviderSelect(provider);
    }

    // Create fresh form data using utility function
    const freshFormData = createFreshFormData(provider);
    setInternalData(freshFormData);
  };

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

  const formContent = (
    <>
      {isEditMode && showForm && (
        <Form
          focusOnFirstError
          noHtml5Validate
          className="rjsf no-header"
          customValidate={customValidate}
          fields={customFields}
          formContext={{
            clearFieldError: handleClearFieldError,
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
      )}
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
                {isEditMode && (
                  <div className="form-actions-bottom">
                    <Button
                      className="cancel-sso-configuration text-md"
                      data-testid="cancel-sso-configuration"
                      type="link"
                      onClick={handleCancelClick}>
                      {t('label.cancel')}
                    </Button>
                    <Button
                      className="save-sso-configuration text-md"
                      data-testid="save-sso-configuration"
                      disabled={isLoading}
                      loading={isLoading}
                      type="primary"
                      onClick={handleSave}>
                      {t('label.save')}
                    </Button>
                  </div>
                )}
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
            className: 'm-t-xs',
          }}
        />
      </>
    );
  }

  const wrappedFormContent = (
    <Card
      className="sso-configuration-form-card flex-col p-0"
      data-testid="sso-configuration-form-card">
      {/* SSO Provider Header */}
      {currentProvider && (
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
            <Typography.Title className="m-0 text-md">
              {getProviderDisplayName(currentProvider)} {t('label.set-up')}
            </Typography.Title>
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
      )}
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
              {isEditMode && (
                <div className="form-actions-bottom">
                  <Button
                    className="cancel-sso-configuration text-md"
                    data-testid="cancel-sso-configuration"
                    type="link"
                    onClick={handleCancelClick}>
                    {t('label.cancel')}
                  </Button>
                  <Button
                    className="save-sso-configuration text-md"
                    data-testid="save-sso-configuration"
                    disabled={isLoading}
                    loading={isLoading}
                    type="primary"
                    onClick={handleSave}>
                    {t('label.save')}
                  </Button>
                </div>
              )}
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
        }}
      />
    </>
  );
};

export default SSOConfigurationFormRJSF;
