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
import { Modal, Space, Typography } from 'antd';
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import InlineAlert from '../../common/InlineAlert/InlineAlert';
import Loader from '../../common/Loader/Loader';
import { SsoTestLoginModalProps } from './SsoTestLogin.interface';

const SsoTestLoginModal = ({
  open,
  isTesting,
  result,
  error,
  onClose,
}: Readonly<SsoTestLoginModalProps>) => {
  const { t } = useTranslation();

  const resultDetails = useMemo(() => {
    if (!result) {
      return null;
    }

    return (
      <div
        className="sso-test-login-details"
        data-testid="sso-test-login-details">
        {result.resolvedPrincipal && (
          <Typography.Paragraph className="m-b-0">
            <strong>{t('label.user')}:</strong> {result.resolvedPrincipal}
          </Typography.Paragraph>
        )}
        {result.resolvedEmail && (
          <Typography.Paragraph className="m-b-0">
            <strong>{t('label.email')}:</strong> {result.resolvedEmail}
          </Typography.Paragraph>
        )}
        {!isEmpty(result.mappedRoles) && (
          <Typography.Paragraph className="m-b-0">
            <strong>{t('label.role-plural')}:</strong>{' '}
            {result.mappedRoles?.join(', ')}
          </Typography.Paragraph>
        )}
        {!isEmpty(result.mappedTeams) && (
          <Typography.Paragraph className="m-b-0">
            <strong>{t('label.team-plural')}:</strong>{' '}
            {result.mappedTeams?.join(', ')}
          </Typography.Paragraph>
        )}
        {result.domainCheck?.enforced && (
          <Typography.Paragraph className="m-b-0">
            <strong>{t('label.domain')}:</strong>{' '}
            {result.domainCheck.resolvedDomain}{' '}
            {result.domainCheck.passed
              ? `(${t('label.success')})`
              : `(${t('label.failed')})`}
          </Typography.Paragraph>
        )}
      </div>
    );
  }, [result, t]);

  const body = useMemo(() => {
    let content = null;
    if (isTesting) {
      content = (
        <div
          className="d-flex flex-col items-center gap-3 p-md"
          data-testid="sso-test-login-loading">
          <Loader size="small" />
          <Typography.Text>
            {t('message.sso-test-login-waiting')}
          </Typography.Text>
        </div>
      );
    } else if (error) {
      content = (
        <InlineAlert
          alertClassName="sso-test-login-error"
          description={error}
          heading={t('label.failed')}
          type="error"
        />
      );
    } else if (result) {
      const isSuccess = result.status === 'success';
      const description = isSuccess
        ? t('message.sso-test-login-success', {
            email: result.resolvedEmail ?? '',
          })
        : !isEmpty(result.errors)
        ? (result.errors ?? []).join(' ')
        : t('message.sso-test-login-failed');
      content = (
        <Space className="w-full" direction="vertical" size={12}>
          <InlineAlert
            alertClassName={
              isSuccess ? 'sso-test-login-success' : 'sso-test-login-failed'
            }
            description={description}
            heading={isSuccess ? t('label.success') : t('label.failed')}
            type={isSuccess ? 'success' : 'error'}
          />
          {resultDetails}
        </Space>
      );
    }

    return content;
  }, [isTesting, error, result, resultDetails, t]);

  return (
    <Modal
      destroyOnClose
      footer={null}
      open={open}
      title={t('label.test-login')}
      onCancel={onClose}>
      <Typography.Paragraph className="text-grey-muted">
        {t('message.sso-test-login-description')}
      </Typography.Paragraph>
      {body}
    </Modal>
  );
};

export default SsoTestLoginModal;
