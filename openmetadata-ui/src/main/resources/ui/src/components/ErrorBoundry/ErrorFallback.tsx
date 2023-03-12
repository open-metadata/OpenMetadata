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

import { Button, Result } from 'antd';
import { t } from 'i18next';
import React from 'react';
import { FallbackProps } from 'react-error-boundary';
import { ERROR500 } from '../../constants/constants';

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
          {t('label.home')}
        </Button>
      }
      status="404"
      subTitle={error.message}
      title={ERROR500}
    />
  );
};

export default ErrorFallback;
