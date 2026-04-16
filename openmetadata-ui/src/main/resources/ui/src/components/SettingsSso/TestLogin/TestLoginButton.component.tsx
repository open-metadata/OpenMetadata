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

import { Button, Typography } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { validateSecurityConfiguration } from '../../../rest/securityConfigAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  SecurityConfigForValidation,
  TestLoginFormData,
  TestLoginResult,
} from './TestLogin.interface';

interface TestLoginButtonProps {
  onSuccess: (result: TestLoginResult) => void;
  disabled?: boolean;
  formData?: TestLoginFormData;
  securityConfig?: SecurityConfigForValidation;
}

const TestLoginButton: React.FC<TestLoginButtonProps> = ({
  onSuccess,
  disabled = false,
  formData,
  securityConfig,
}) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const popupRef = useRef<Window | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const processTestLoginResult = useCallback(
    (resultJson: string) => {
      try {
        const data = JSON.parse(resultJson);

        if (data?.type !== 'sso-test-login') {
          return;
        }

        setIsLoading(false);

        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }

        if (data.success) {
          setStatus('success');
          setErrorMessage('');
          onSuccess({
            claims: data.claims ?? {},
            suggestedEmailClaim: data.suggestedEmailClaim ?? null,
            derivedPrincipalDomain: data.derivedPrincipalDomain ?? null,
            suggestedAdminPrincipal: data.suggestedAdminPrincipal ?? null,
            hasRefreshToken: data.hasRefreshToken ?? false,
          });
        } else {
          setStatus('error');
          setErrorMessage(data.error ?? t('message.test-login-failed'));
          showErrorToast(data.error ?? t('message.test-login-failed'));
        }
      } catch {
        setStatus('error');
        setErrorMessage(t('message.test-login-failed'));
      }

      localStorage.removeItem('sso-test-login-result');
    },
    [onSuccess, t]
  );

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'sso-test-login-result' && event.newValue) {
        processTestLoginResult(event.newValue);
      }
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [processTestLoginResult]);

  const openPopup = useCallback((name = 'sso-test-login'): Window | null => {
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    return window.open(
      '',
      name,
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
    );
  }, []);

  const handleSamlTestLogin = useCallback(() => {
    const idp = formData?.samlConfiguration?.idp;
    const sp = formData?.samlConfiguration?.sp;

    const idpEntityId = idp?.entityId ?? '';
    const idpSsoLoginUrl = idp?.ssoLoginUrl ?? '';
    const idpX509Certificate = idp?.idpX509Certificate ?? '';

    if (!idpEntityId || !idpSsoLoginUrl || !idpX509Certificate) {
      setIsLoading(false);
      setStatus('error');
      const msg =
        'IdP Entity ID, SSO Login URL and X.509 Certificate are required for SAML Test Login';
      setErrorMessage(msg);
      showErrorToast(msg);

      return;
    }

    const spAcsUrl = sp?.acs ?? sp?.callback ?? `${window.location.origin}/callback`;
    const spEntityId = sp?.entityId ?? window.location.origin;
    const nameIdFormat =
      idp?.nameId ?? 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress';

    const popup = openPopup();
    if (!popup) {
      setIsLoading(false);
      setStatus('error');
      setErrorMessage(t('message.popup-blocked'));
      showErrorToast(t('message.popup-blocked'));

      return;
    }
    popupRef.current = popup;

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = `${window.location.origin}/api/v1/system/config/auth/test-login/saml-initiate`;
    form.target = 'sso-test-login';
    form.style.display = 'none';

    const fields: Record<string, string> = {
      idpEntityId,
      idpSsoLoginUrl,
      idpX509Certificate,
      spEntityId,
      spAcsUrl,
      nameIdFormat,
    };
    Object.entries(fields).forEach(([k, v]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = k;
      input.value = v;
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);

    timerRef.current = setTimeout(() => {
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
      setIsLoading(false);
      setStatus('error');
      setErrorMessage(t('message.test-login-timeout'));
    }, 300000);
  }, [formData, openPopup, t]);

  const handleTestLogin = useCallback(async () => {
    setIsLoading(true);
    setStatus('idle');
    setErrorMessage('');

    if (formData?.provider === 'saml') {
      handleSamlTestLogin();

      return;
    }

    const discoveryUri =
      formData?.discoveryUri ?? formData?.oidcConfiguration?.discoveryUri ?? '';
    const clientId =
      formData?.clientId ?? formData?.oidcConfiguration?.id ?? '';
    const clientSecret = formData?.oidcConfiguration?.secret ?? '';
    const scope = formData?.oidcConfiguration?.scope ?? 'openid email profile';

    if (!discoveryUri || !clientId) {
      setIsLoading(false);
      setStatus('error');
      const msg = !discoveryUri
        ? 'Discovery URI is required'
        : 'Client ID is required';
      setErrorMessage(msg);
      showErrorToast(msg);

      return;
    }

    if (discoveryUri.includes('{') || discoveryUri.includes('}')) {
      setIsLoading(false);
      setStatus('error');
      const msg =
        'Replace the placeholder values in the Discovery URI (e.g., {tenant-id}, {your-domain}) with your actual values.';
      setErrorMessage(msg);
      showErrorToast(msg);

      return;
    }

    // Validate configuration before opening popup
    if (securityConfig) {
      try {
        const response = await validateSecurityConfiguration(
          securityConfig as never,
          'testLogin'
        );
        const validationResult = response.data ?? response;

        if (
          validationResult.status === 'FAILED' &&
          validationResult.errors?.length
        ) {
          const errorMsg = validationResult.errors
            .map(
              (e: { field: string; error: string }) =>
                `${e.field}: ${e.error}`
            )
            .join(', ');
          setIsLoading(false);
          setStatus('error');
          setErrorMessage(errorMsg);
          showErrorToast(errorMsg);

          return;
        }
      } catch {
        setIsLoading(false);
        setStatus('error');
        setErrorMessage(t('message.test-login-failed'));

        return;
      }
    }

    const callbackUrl =
      formData?.oidcConfiguration?.callbackUrl ??
      `${window.location.origin}/callback`;

    const oidc = formData?.oidcConfiguration;
    const params = new URLSearchParams({
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
    });
    const initiateUrl = `${window.location.origin}/api/v1/system/config/auth/test-login/initiate?${params.toString()}`;

    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      initiateUrl,
      'sso-test-login',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
    );

    if (!popup) {
      setIsLoading(false);
      setStatus('error');
      setErrorMessage(t('message.popup-blocked'));
      showErrorToast(t('message.popup-blocked'));

      return;
    }

    popupRef.current = popup;

    timerRef.current = setTimeout(() => {
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
      setIsLoading(false);
      setStatus('error');
      setErrorMessage(t('message.test-login-timeout'));
    }, 60000);

    const checkClosed = setInterval(() => {
      if (popupRef.current?.closed) {
        clearInterval(checkClosed);

        // Check localStorage for result (popup may have stored it before closing)
        setTimeout(() => {
          const stored = localStorage.getItem('sso-test-login-result');
          if (stored) {
            processTestLoginResult(stored);
          } else if (isLoading) {
            setIsLoading(false);

            if (status === 'idle') {
              setStatus('error');
              setErrorMessage(t('message.test-login-not-completed'));
            }
          }
        }, 500);
      }
    }, 500);
  }, [formData, securityConfig, isLoading, status, t]);

  return (
    <div className="d-flex flex-col gap-2">
      <div className="d-flex items-center gap-3">
        <Button
          disabled={disabled}
          loading={isLoading}
          type="primary"
          onClick={handleTestLogin}>
          {t('label.test-login')}
        </Button>
        {status === 'success' && (
          <Typography.Text type="success">
            {`\u2713 ${t('message.test-login-success')}`}
          </Typography.Text>
        )}
        {status === 'error' && errorMessage && (
          <Typography.Text type="danger">
            {`\u2717 ${errorMessage}`}
          </Typography.Text>
        )}
      </div>
    </div>
  );
};

export default TestLoginButton;
