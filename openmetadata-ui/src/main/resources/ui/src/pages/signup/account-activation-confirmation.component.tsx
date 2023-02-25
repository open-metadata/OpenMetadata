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
import { t } from 'i18next';
import { isEmpty } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { confirmRegistration } from 'rest/auth-API';
import { ROUTES } from '../../constants/constants';
import jsonData from '../../jsons/en';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

const AccountActivationConfirmation = () => {
  const [isAccountVerified, setIsAccountVerified] = useState(false);
  const location = useLocation();
  const history = useHistory();

  const searchParam = new URLSearchParams(location.search);

  const confirmUserRegistration = async () => {
    try {
      const res = await confirmRegistration(searchParam.get('token') as string);
      if (!isEmpty(res)) {
        setIsAccountVerified(true);
        showSuccessToast(
          jsonData['api-success-messages']['account-verify-success']
        );
        history.push(ROUTES.SIGNIN);
      }
    } catch (err) {
      showErrorToast(
        err as AxiosError,
        jsonData['api-error-messages']['unexpected-server-response']
      );
    }
  };

  const handleBackToLogin = () => history.push(ROUTES.SIGNIN);

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
