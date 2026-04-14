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
import { showErrorToast } from '../../../utils/ToastUtils';
import { TestLoginResult } from './TestLogin.interface';

interface TestLoginButtonProps {
  onSuccess: (result: TestLoginResult) => void;
  disabled?: boolean;
}

const TestLoginButton: React.FC<TestLoginButtonProps> = ({
  onSuccess,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const popupRef = useRef<Window | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      const data = event.data;

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
    },
    [onSuccess, t]
  );

  useEffect(() => {
    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [handleMessage]);

  const handleTestLogin = useCallback(() => {
    setIsLoading(true);
    setStatus('idle');
    setErrorMessage('');

    const initiateUrl = `${window.location.origin}/api/v1/system/config/auth/test-login/initiate`;

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

        setTimeout(() => {
          if (isLoading) {
            setIsLoading(false);

            if (status === 'idle') {
              setStatus('error');
              setErrorMessage(t('message.test-login-not-completed'));
            }
          }
        }, 1000);
      }
    }, 500);
  }, [isLoading, status, t]);

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
