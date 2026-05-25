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
  Dialog,
  Input,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { OIDC_SSO_DEFAULTS } from '../../../constants/SSO.constant';
import { AuthProvider } from '../../../generated/settings/settings';
import {
  SecurityConfiguration,
  validateSecurityConfiguration,
} from '../../../rest/securityConfigAPI';
import { prepareOidcSubmitPayload } from '../../../utils/SSOUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  buildOidcPopupFields,
  buildSamlPopupFields,
  CLOSE_WATCH_INTERVAL_MS,
  openCenteredPopup,
  POPUP_TIMEOUT_MS,
  submitFormToPopup,
  TEST_LOGIN_RESULT_KEY,
} from './popupLifecycle';
import {
  isTestLoginPopupPayload,
  TestLoginButtonProps,
  TestLoginPopupPayload,
} from './TestLogin.interface';

export type { TestLoginButtonHandle } from './TestLogin.interface';

interface LdapModalState {
  open: boolean;
  loading: boolean;
  email: string;
  password: string;
}

const INITIAL_LDAP_MODAL_STATE: LdapModalState = {
  open: false,
  loading: false,
  email: '',
  password: '',
};

const TestLoginButton = ({
  formData,
  securityConfig,
  hasExistingConfig = false,
  isDisabled = false,
  onSuccess,
  triggerRef,
}: TestLoginButtonProps) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [ldapModal, setLdapModal] = useState<LdapModalState>(
    INITIAL_LDAP_MODAL_STATE
  );
  const popupRef = useRef<Window | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeWatchRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultReceivedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearCloseWatch = useCallback(() => {
    if (closeWatchRef.current) {
      clearInterval(closeWatchRef.current);
      closeWatchRef.current = null;
    }
  }, []);

  const processResultPayload = useCallback(
    (raw: string) => {
      resultReceivedRef.current = true;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        showErrorToast(t('server.test-login-failed'));
        setIsLoading(false);

        return;
      }

      if (!isTestLoginPopupPayload(parsed)) {
        return;
      }

      const payload: TestLoginPopupPayload = parsed;

      clearTimer();
      clearCloseWatch();
      setIsLoading(false);

      if (payload.success) {
        onSuccess({
          claims: payload.claims ?? {},
          suggestedEmailClaim: payload.suggestedEmailClaim ?? null,
          derivedPrincipalDomain: payload.derivedPrincipalDomain ?? null,
          suggestedAdminPrincipal: payload.suggestedAdminPrincipal ?? null,
          hasRefreshToken: Boolean(payload.hasRefreshToken),
        });
      } else {
        showErrorToast(payload.error ?? t('server.test-login-failed'));
      }

      localStorage.removeItem(TEST_LOGIN_RESULT_KEY);
    },
    [onSuccess, t, clearTimer, clearCloseWatch]
  );

  const failPopupBlocked = useCallback(() => {
    setIsLoading(false);
    showErrorToast(t('message.popup-blocked'));
  }, [t]);

  const failTimeout = useCallback(() => {
    clearCloseWatch();
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
    }
    setIsLoading(false);
    showErrorToast(t('server.test-login-timeout'));
  }, [clearCloseWatch, t]);

  const failPopupClosed = useCallback(() => {
    clearTimer();
    clearCloseWatch();
    setIsLoading(false);
    showErrorToast(t('server.test-login-popup-closed'));
  }, [clearCloseWatch, clearTimer, t]);

  const startCloseWatch = useCallback(() => {
    clearCloseWatch();
    closeWatchRef.current = setInterval(() => {
      if (!popupRef.current?.closed) {
        return;
      }
      if (resultReceivedRef.current) {
        clearCloseWatch();

        return;
      }
      const stored = localStorage.getItem(TEST_LOGIN_RESULT_KEY);
      if (stored) {
        clearCloseWatch();
        processResultPayload(stored);

        return;
      }
      failPopupClosed();
    }, CLOSE_WATCH_INTERVAL_MS);
  }, [clearCloseWatch, failPopupClosed, processResultPayload]);

  const launchPopupFlow = useCallback(
    (action: string, fields: Record<string, string>) => {
      resultReceivedRef.current = false;
      localStorage.removeItem(TEST_LOGIN_RESULT_KEY);

      const popup = openCenteredPopup();
      if (!popup) {
        failPopupBlocked();

        return;
      }
      popupRef.current = popup;
      startCloseWatch();
      submitFormToPopup(action, fields);
      timerRef.current = setTimeout(failTimeout, POPUP_TIMEOUT_MS);
    },
    [failPopupBlocked, failTimeout, startCloseWatch]
  );

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === TEST_LOGIN_RESULT_KEY && event.newValue) {
        processResultPayload(event.newValue);
      }
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
      clearTimer();
      clearCloseWatch();
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
      popupRef.current = null;
    };
  }, [processResultPayload, clearTimer, clearCloseWatch]);

  const startSamlTestLogin = useCallback(() => {
    const fields = buildSamlPopupFields(formData, hasExistingConfig);
    if (!fields) {
      setIsLoading(false);
      showErrorToast(t('message.saml-idp-fields-required'));

      return;
    }
    launchPopupFlow(
      `${window.location.origin}/api/v1/system/config/auth/test-login/saml-initiate`,
      fields
    );
  }, [formData, hasExistingConfig, launchPopupFlow, t]);

  const startOidcTestLogin = useCallback(async () => {
    const discoveryUri =
      formData?.oidcConfiguration?.discoveryUri || formData?.discoveryUri || '';
    const clientId =
      formData?.oidcConfiguration?.id || formData?.clientId || '';
    const clientSecret = formData?.oidcConfiguration?.secret ?? '';
    const defaultScope =
      formData?.provider === AuthProvider.Azure
        ? OIDC_SSO_DEFAULTS.azureScope
        : OIDC_SSO_DEFAULTS.scope;
    const scope = formData?.oidcConfiguration?.scope ?? defaultScope;

    if (!discoveryUri || !clientId) {
      setIsLoading(false);
      showErrorToast(
        !discoveryUri
          ? t('message.discovery-uri-required')
          : t('message.client-id-required')
      );

      return;
    }

    if (discoveryUri.includes('{') || discoveryUri.includes('}')) {
      setIsLoading(false);
      showErrorToast(t('message.replace-discovery-uri-placeholders'));

      return;
    }

    if (securityConfig) {
      try {
        // Reshape OIDC payload to derive clientType from secret presence so
        // the validator sees the same shape the save endpoint will receive.
        const reshapedConfig: SecurityConfiguration =
          prepareOidcSubmitPayload(securityConfig) ?? securityConfig;
        const response = await validateSecurityConfiguration(
          reshapedConfig,
          'testLogin'
        );
        const validationResult = response.data;

        if (
          validationResult &&
          'errors' in validationResult &&
          Array.isArray(validationResult.errors) &&
          validationResult.errors.length > 0
        ) {
          const errors = validationResult.errors as Array<{
            field: string;
            error: string;
          }>;
          const message = errors
            .map((error) => `${error.field}: ${error.error}`)
            .join(', ');
          setIsLoading(false);
          showErrorToast(message);

          return;
        }
      } catch {
        setIsLoading(false);
        showErrorToast(t('server.test-login-failed'));

        return;
      }
    }

    const fields = buildOidcPopupFields({
      formData,
      hasExistingConfig,
      discoveryUri,
      clientId,
      clientSecret,
      scope,
    });
    launchPopupFlow(
      `${window.location.origin}/api/v1/system/config/auth/test-login/initiate`,
      fields
    );
  }, [formData, hasExistingConfig, securityConfig, t, launchPopupFlow]);

  const submitLdapTestLogin = useCallback(async () => {
    if (!ldapModal.email || !ldapModal.password) {
      showErrorToast(t('message.ldap-credentials-required'));

      return;
    }

    setLdapModal((s) => ({ ...s, loading: true }));
    try {
      const response = await fetch(
        `${window.location.origin}/api/v1/system/config/auth/test-login/ldap-initiate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            mode: hasExistingConfig ? 'existing' : 'new',
            ldapConfiguration: formData?.ldapConfiguration,
            email: ldapModal.email,
            password: ldapModal.password,
          }),
        }
      );
      const data = await response.json();

      if (data?.success) {
        setLdapModal(INITIAL_LDAP_MODAL_STATE);
        setIsLoading(false);
        onSuccess({
          claims: {},
          suggestedEmailClaim: null,
          derivedPrincipalDomain:
            (data.derivedPrincipalDomain as string | null) ?? null,
          suggestedAdminPrincipal:
            (data.suggestedAdminPrincipal as string | null) ?? null,
          hasRefreshToken: false,
        });
      } else {
        showErrorToast(
          (data?.error as string | undefined) ?? t('server.test-login-failed')
        );
      }
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : t('server.test-login-failed')
      );
    } finally {
      setLdapModal((s) => ({ ...s, loading: false }));
    }
  }, [
    formData,
    hasExistingConfig,
    ldapModal.email,
    ldapModal.password,
    onSuccess,
    t,
  ]);

  const handleTestLogin = useCallback(() => {
    setIsLoading(true);

    if (formData?.provider === 'saml') {
      startSamlTestLogin();

      return;
    }

    if (formData?.provider === 'ldap') {
      setIsLoading(false);
      setLdapModal({ open: true, loading: false, email: '', password: '' });

      return;
    }

    void startOidcTestLogin();
  }, [formData?.provider, startSamlTestLogin, startOidcTestLogin]);

  useImperativeHandle(
    triggerRef,
    () => ({
      triggerTestLogin: handleTestLogin,
    }),
    [handleTestLogin]
  );

  const closeLdapModal = useCallback(() => {
    setLdapModal((s) => ({ ...s, open: false, password: '' }));
  }, []);

  return (
    <>
      <Button
        color="secondary"
        data-testid="test-login-button"
        isDisabled={isDisabled || isLoading}
        isLoading={isLoading}
        size="md"
        onPress={handleTestLogin}>
        {t('label.test-login')}
      </Button>
      <ModalOverlay
        isDismissable
        isOpen={ldapModal.open}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            closeLdapModal();
          }
        }}>
        <Modal>
          <Dialog
            showCloseButton
            data-testid="ldap-test-login-modal"
            title={t('label.test-login')}
            onClose={closeLdapModal}>
            <Dialog.Content>
              <Typography as="p" className="tw:text-tertiary" size="text-sm">
                {t('message.ldap-test-login-description')}
              </Typography>
              <Input
                autoFocus
                isRequired
                data-testid="ldap-test-login-email"
                label={t('label.email-or-username')}
                placeholder="user@example.com"
                value={ldapModal.email}
                onChange={(email) => setLdapModal((s) => ({ ...s, email }))}
              />
              <Input
                isRequired
                data-testid="ldap-test-login-password"
                label={t('label.password')}
                placeholder=""
                type="password"
                value={ldapModal.password}
                onChange={(password) =>
                  setLdapModal((s) => ({ ...s, password }))
                }
              />
            </Dialog.Content>
            <Dialog.Footer>
              <Button
                color="secondary"
                isDisabled={ldapModal.loading}
                size="md"
                onPress={closeLdapModal}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
                data-testid="ldap-test-login-submit"
                isDisabled={
                  !ldapModal.email || !ldapModal.password || ldapModal.loading
                }
                isLoading={ldapModal.loading}
                size="md"
                onPress={submitLdapTestLogin}>
                {t('label.test')}
              </Button>
            </Dialog.Footer>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </>
  );
};

export default TestLoginButton;
