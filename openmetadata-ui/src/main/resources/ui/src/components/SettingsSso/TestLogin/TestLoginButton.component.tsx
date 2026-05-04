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
} from '@openmetadata/ui-core-components';
import {
  RefObject,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { validateSecurityConfiguration } from '../../../rest/securityConfigAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  SecurityConfigForValidation,
  TestLoginFormData,
  TestLoginResult,
} from './TestLogin.interface';

const TEST_LOGIN_RESULT_KEY = 'sso-test-login-result';
const POPUP_NAME = 'sso-test-login';
const POPUP_TIMEOUT_MS = 60_000;

export interface TestLoginButtonHandle {
  triggerTestLogin: () => void;
}

interface TestLoginButtonProps {
  formData?: TestLoginFormData;
  securityConfig?: SecurityConfigForValidation;
  isDisabled?: boolean;
  onSuccess: (result: TestLoginResult) => void;
  triggerRef?: RefObject<TestLoginButtonHandle | null>;
}

const openCenteredPopup = (): Window | null => {
  const width = 500;
  const height = 600;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;

  return window.open(
    '',
    POPUP_NAME,
    `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
  );
};

const submitFormToPopup = (action: string, fields: Record<string, string>) => {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = action;
  form.target = POPUP_NAME;
  form.style.display = 'none';

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
};

const TestLoginButton = ({
  formData,
  securityConfig,
  isDisabled = false,
  onSuccess,
  triggerRef,
}: TestLoginButtonProps) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeWatchRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [ldapModalOpen, setLdapModalOpen] = useState(false);
  const [ldapModalLoading, setLdapModalLoading] = useState(false);
  const [ldapEmail, setLdapEmail] = useState('');
  const [ldapPassword, setLdapPassword] = useState('');

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
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(raw);
      } catch {
        showErrorToast(t('message.test-login-failed'));
        setIsLoading(false);

        return;
      }

      if (data?.type !== 'sso-test-login') {
        return;
      }

      clearTimer();
      clearCloseWatch();
      setIsLoading(false);

      if (data.success) {
        onSuccess({
          claims: (data.claims as TestLoginResult['claims']) ?? {},
          suggestedEmailClaim:
            (data.suggestedEmailClaim as string | null) ?? null,
          derivedPrincipalDomain:
            (data.derivedPrincipalDomain as string | null) ?? null,
          suggestedAdminPrincipal:
            (data.suggestedAdminPrincipal as string | null) ?? null,
          hasRefreshToken: Boolean(data.hasRefreshToken),
        });
      } else {
        const message =
          (data.error as string | undefined) ?? t('message.test-login-failed');
        showErrorToast(message);
      }

      localStorage.removeItem(TEST_LOGIN_RESULT_KEY);
    },
    [onSuccess, t, clearTimer, clearCloseWatch]
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
    };
  }, [processResultPayload, clearTimer, clearCloseWatch]);

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
    showErrorToast(t('message.test-login-timeout'));
  }, [clearCloseWatch, t]);

  const failPopupClosed = useCallback(() => {
    clearTimer();
    clearCloseWatch();
    setIsLoading(false);
    showErrorToast(t('message.test-login-popup-closed'));
  }, [clearCloseWatch, clearTimer, t]);

  const startCloseWatch = useCallback(() => {
    clearCloseWatch();
    closeWatchRef.current = setInterval(() => {
      if (
        popupRef.current?.closed &&
        !localStorage.getItem(TEST_LOGIN_RESULT_KEY)
      ) {
        failPopupClosed();
      }
    }, 500);
  }, [clearCloseWatch, failPopupClosed]);

  const startSamlTestLogin = useCallback(() => {
    const idp = formData?.samlConfiguration?.idp;
    const sp = formData?.samlConfiguration?.sp;

    const idpEntityId = idp?.entityId ?? '';
    const idpSsoLoginUrl = idp?.ssoLoginUrl ?? '';
    const idpX509Certificate = idp?.idpX509Certificate ?? '';

    if (!idpEntityId || !idpSsoLoginUrl || !idpX509Certificate) {
      setIsLoading(false);
      showErrorToast(t('message.saml-idp-fields-required'));

      return;
    }

    localStorage.removeItem(TEST_LOGIN_RESULT_KEY);

    const popup = openCenteredPopup();
    if (!popup) {
      failPopupBlocked();

      return;
    }
    popupRef.current = popup;
    startCloseWatch();

    submitFormToPopup(
      `${window.location.origin}/api/v1/system/config/auth/test-login/saml-initiate`,
      {
        idpEntityId,
        idpSsoLoginUrl,
        idpX509Certificate,
        spEntityId: sp?.entityId ?? window.location.origin,
        spAcsUrl:
          sp?.acs ?? sp?.callback ?? `${window.location.origin}/callback`,
        nameIdFormat:
          idp?.nameId ??
          'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      }
    );

    timerRef.current = setTimeout(failTimeout, POPUP_TIMEOUT_MS);
  }, [formData, t, failPopupBlocked, failTimeout, startCloseWatch]);

  const startOidcTestLogin = useCallback(async () => {
    const discoveryUri =
      formData?.discoveryUri ?? formData?.oidcConfiguration?.discoveryUri ?? '';
    const clientId =
      formData?.clientId ?? formData?.oidcConfiguration?.id ?? '';
    const clientSecret = formData?.oidcConfiguration?.secret ?? '';
    const scope = formData?.oidcConfiguration?.scope ?? 'openid email profile';

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
        const response = await validateSecurityConfiguration(
          securityConfig as never,
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
        showErrorToast(t('message.test-login-failed'));

        return;
      }
    }

    const oidc = formData?.oidcConfiguration;
    const callbackUrl =
      oidc?.callbackUrl ?? `${window.location.origin}/callback`;

    localStorage.removeItem(TEST_LOGIN_RESULT_KEY);

    const popup = openCenteredPopup();
    if (!popup) {
      failPopupBlocked();

      return;
    }
    popupRef.current = popup;
    startCloseWatch();

    submitFormToPopup(
      `${window.location.origin}/api/v1/system/config/auth/test-login/initiate`,
      {
        discoveryUri,
        clientId,
        clientSecret,
        scope,
        callbackUrl,
        prompt: oidc?.prompt ?? '',
        maxAge: oidc?.maxAge ?? '',
        clientAuthenticationMethod: oidc?.clientAuthenticationMethod ?? '',
        disablePkce: String(oidc?.disablePkce ?? false),
        useNonce: String(oidc?.useNonce ?? true),
        customParams: JSON.stringify(oidc?.customParams ?? {}),
      }
    );

    timerRef.current = setTimeout(failTimeout, POPUP_TIMEOUT_MS);
  }, [formData, securityConfig, t, failPopupBlocked, failTimeout, startCloseWatch]);

  const submitLdapTestLogin = useCallback(async () => {
    if (!ldapEmail || !ldapPassword) {
      showErrorToast(t('message.ldap-credentials-required'));

      return;
    }

    setLdapModalLoading(true);
    try {
      const response = await fetch(
        `${window.location.origin}/api/v1/system/config/auth/test-login/ldap-initiate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            ldapConfiguration: formData?.ldapConfiguration,
            email: ldapEmail,
            password: ldapPassword,
          }),
        }
      );
      const data = await response.json();

      if (data?.success) {
        setLdapModalOpen(false);
        setLdapPassword('');
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
          (data?.error as string | undefined) ?? t('message.test-login-failed')
        );
      }
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : t('message.test-login-failed')
      );
    } finally {
      setLdapModalLoading(false);
    }
  }, [formData, ldapEmail, ldapPassword, onSuccess, t]);

  const handleTestLogin = useCallback(() => {
    setIsLoading(true);

    if (formData?.provider === 'saml') {
      startSamlTestLogin();

      return;
    }

    if (formData?.provider === 'ldap') {
      setIsLoading(false);
      setLdapEmail('');
      setLdapPassword('');
      setLdapModalOpen(true);

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
    setLdapModalOpen(false);
    setLdapPassword('');
  }, []);

  return (
    <>
      <Button
        className="test-login-sso-configuration"
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
        isOpen={ldapModalOpen}
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
              <p className="tw:text-sm tw:text-tertiary">
                {t('message.ldap-test-login-description')}
              </p>
              <Input
                autoFocus
                isRequired
                data-testid="ldap-test-login-email"
                label={t('label.email-or-username')}
                placeholder="user@example.com"
                value={ldapEmail}
                onChange={setLdapEmail}
              />
              <Input
                isRequired
                data-testid="ldap-test-login-password"
                label={t('label.password')}
                placeholder=""
                type="password"
                value={ldapPassword}
                onChange={setLdapPassword}
              />
            </Dialog.Content>
            <Dialog.Footer>
              <Button
                color="secondary"
                isDisabled={ldapModalLoading}
                size="md"
                onPress={closeLdapModal}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
                data-testid="ldap-test-login-submit"
                isDisabled={!ldapEmail || !ldapPassword || ldapModalLoading}
                isLoading={ldapModalLoading}
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
