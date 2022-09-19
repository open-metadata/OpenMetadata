import { Button, Col, Input, Row, Typography } from 'antd';
import { isEmpty, isUndefined } from 'lodash';
import React, { useMemo, useState } from 'react';
import { useBasicAuth } from '../../authentication/auth-provider/basic-auth.provider';
import AuthCommonCard from '../../components/common/auth-common-card/auth-common-card.component';
import { validEmailRegEx } from '../../constants/regex.constants';
import './forgot-password.styles.less';

const ForgotPassword = () => {
  const [email, setEmail] = useState<string>('');

  const { isError } = useMemo(() => {
    const isEmailValid = !isEmpty(email)
      ? validEmailRegEx.test(email)
      : undefined;

    return {
      isError: !isUndefined(isEmailValid) && !isEmailValid,
    };
  }, [email]);

  const { isPasswordResetLinkSent, handleForgotPassword } = useBasicAuth();

  const handleSubmit = () => {
    if (!isError) {
      handleForgotPassword && handleForgotPassword(email);
    }
  };

  return (
    <AuthCommonCard classNames="">
      <>
        <Row gutter={[16, 48]}>
          <Col className="flex-center text-center mt-8" span={24}>
            <Typography.Text strong className="text-reset-info">
              Enter your registered email to receive password reset link
            </Typography.Text>
          </Col>

          <Col span={24}>
            <label>Email</label>
            <Input
              className={`w-full ${isError ? 'forgot-email-input' : ''}`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {isError ? (
              <span className="error-text">Email is not Valid</span>
            ) : null}
          </Col>

          <Col span={24}>
            <Button className="w-full" type="primary" onClick={handleSubmit}>
              Submit
            </Button>
          </Col>
        </Row>

        {isPasswordResetLinkSent ? (
          <div className="flex-center text-center mt-8 mb-12">
            <Typography.Text strong>
              Reset link has been sent to your email
            </Typography.Text>
          </div>
        ) : null}
      </>
    </AuthCommonCard>
  );
};

export default ForgotPassword;
