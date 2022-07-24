import { Button, Result } from 'antd';
import React from 'react';
import { FallbackProps } from 'react-error-boundary';
import { ERROR500 } from '../constants/constants';

const ErrorFallback: React.FC<FallbackProps> = ({
  error,
  resetErrorBoundary,
}) => {
  return (
    <Result
      extra={
        <Button
          className="ant-btn-primary-custom"
          type="primary"
          onClick={resetErrorBoundary}>
          Home
        </Button>
      }
      status="404"
      subTitle={error.message}
      title={ERROR500}
    />
  );
};

export default ErrorFallback;
