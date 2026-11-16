/*
 *  Copyright 2022 Collate.
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

import { Alert, Button, Card } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import DocumentTitle from '../../components/common/DocumentTitle/DocumentTitle';
import { ROUTES } from '../../constants/constants';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import { confirmRegistration } from '../../rest/auth-API';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

const AccountActivationConfirmation = () => {
  const [isAccountVerified, setIsAccountVerified] = useState(false);
  const location = useCustomLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const searchParam = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );

  const confirmUserRegistration = useCallback(async () => {
    try {
      const res = await confirmRegistration(searchParam.get('token') as string);
      if (!isEmpty(res)) {
        setIsAccountVerified(true);
        showSuccessToast(t('server.account-verify-success'));
        navigate(ROUTES.SIGNIN);
      }
    } catch (err) {
      showErrorToast(err as AxiosError, t('server.unexpected-response'));
    }
  }, [navigate, searchParam, t]);

  const handleBackToLogin = () => navigate(ROUTES.SIGNIN);

  useEffect(() => {
    confirmUserRegistration();
  }, [confirmUserRegistration]);

  return (
    <div
      className="tw:flex tw:min-h-screen tw:w-full tw:items-center tw:justify-center tw:bg-primary tw:p-6"
      data-testid="account-activation-container">
      <DocumentTitle title={t('label.sign-up')} />
      <Card
        className="tw:w-full tw:max-w-[480px] tw:shadow-xl"
        variant="elevated">
        <Card.Content className="tw:flex tw:flex-col tw:items-center tw:gap-6 tw:p-8">
          {isAccountVerified ? (
            <>
              <Alert
                title={t('message.user-verified-successfully')}
                variant="success"
              />
              <Button
                color="link-color"
                data-testid="back-to-login"
                size="sm"
                onPress={handleBackToLogin}>
                {t('label.back-to-login-lowercase')}
              </Button>
            </>
          ) : (
            <>
              <Alert title={t('label.token-expired')} variant="error" />
              <Button
                color="link-color"
                data-testid="regenerate-token"
                size="sm"
                onPress={handleBackToLogin}>
                {t('label.regenerate-registration-token')}
              </Button>
            </>
          )}
        </Card.Content>
      </Card>
    </div>
  );
};

export default AccountActivationConfirmation;
