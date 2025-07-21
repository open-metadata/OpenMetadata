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

import { Alert, Card, Space, Typography } from 'antd';
import { AxiosError } from 'axios';

import { isEmpty } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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

  const confirmUserRegistration = async () => {
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
  };

  const handleBackToLogin = () => navigate(ROUTES.SIGNIN);

  useEffect(() => {
    confirmUserRegistration();
  }, []);

  return (
    <Card>
      {isAccountVerified ? (
        <div className="mt-12 w-16">
          <Space align="center" direction="vertical">
            <Alert
              showIcon
              message={t('label.user-verified-successfully')}
              type="success"
            />
            <div className="mt-12" onClick={handleBackToLogin}>
              <Typography.Link underline>
                {t('label.back-to-login-lowercase')}
              </Typography.Link>
            </div>
          </Space>
        </div>
      ) : (
        <div className="mt-12 w-16">
          <Space align="center" direction="vertical">
            <Alert showIcon message={t('label.token-expired')} type="error" />
            <div className="mt-12">
              <Typography.Link underline>
                {t('label.regenerate-registration-token')}
              </Typography.Link>
            </div>
          </Space>
        </div>
      )}
    </Card>
  );
};

export default AccountActivationConfirmation;
