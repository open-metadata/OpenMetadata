import { Alert, Card, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { confirmRegistration } from '../../axiosAPIs/auth-API';
import { ROUTES } from '../../constants/constants';
import jsonData from '../../jsons/en';
import { showErrorToast } from '../../utils/ToastUtils';

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
      <>
        {isAccountVerified ? (
          <div className="mt-12 w-16">
            <Space align="center" direction="vertical">
              <Alert
                showIcon
                message="User Verified Successfully"
                type="success"
              />
              <div className="mt-12" onClick={handleBackToLogin}>
                <Typography.Link underline>back to login</Typography.Link>
              </div>
            </Space>
          </div>
        ) : (
          <div className="mt-12 w-16">
            <Space align="center" direction="vertical">
              <Alert showIcon message="Token Expired" type="error" />
              <div className="mt-12">
                <Typography.Link underline>
                  Regenerate registration token
                </Typography.Link>
              </div>
            </Space>
          </div>
        )}
      </>
    </Card>
  );
};

export default AccountActivationConfirmation;
