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

import Icon from '@ant-design/icons/lib/components/Icon';
import { Button, Divider, Input, Space, Typography } from 'antd';
import classNames from 'classnames';
import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CopyIcon } from '../../../../assets/svg/copy-right-squared.svg';
import { ReactComponent as IconError } from '../../../../assets/svg/error.svg';
import { PersonalAccessToken } from '../../../../generated/auth/personalAccessToken';
import { Bot } from '../../../../generated/entity/bot';
import { AuthenticationMechanism } from '../../../../generated/entity/teams/user';
import { getTokenExpiry } from '../../../../utils/BotsUtils';
import CopyToClipboardButton from '../../../common/CopyToClipboardButton/CopyToClipboardButton';
import UserPopOverCard from '../../../common/PopOverCard/UserPopOverCard';
import './auth-mechanism.less';

interface Props {
  authenticationMechanism: AuthenticationMechanism | PersonalAccessToken;
  hasPermission: boolean;
  onEdit?: () => void;
  onTokenRevoke?: () => void;
  isBot: boolean;
  isSCIMBot?: boolean;
  botData?: Bot;
}

const AuthMechanism: FC<Props> = ({
  authenticationMechanism,
  hasPermission,
  onEdit,
  onTokenRevoke,
  isBot,
  isSCIMBot,
  botData,
}: Props) => {
  const { t } = useTranslation();
  const { JWTToken, JWTTokenExpiresAt } = useMemo(() => {
    if (isBot) {
      const botData = authenticationMechanism as AuthenticationMechanism;

      return {
        JWTToken: botData?.config?.JWTToken,
        JWTTokenExpiresAt: botData?.config?.JWTTokenExpiresAt ?? 0,
      };
    }
    const personalAccessData = authenticationMechanism as PersonalAccessToken;

    return {
      JWTToken: personalAccessData?.jwtToken,
      JWTTokenExpiresAt: personalAccessData?.expiryDate ?? 0,
    };
  }, [isBot, authenticationMechanism]);

  const { tokenExpiryDate, isTokenExpired } = getTokenExpiry(JWTTokenExpiresAt);

  return (
    <>
      <Space className="w-full justify-between">
        {isSCIMBot ? (
          <div className="flex flex-col gap-2">
            <Typography.Text className="card-title m-t-0 m-b-2 text-md">
              {t('message.automate-provisioning-with-scim')}
            </Typography.Text>
            <Typography.Paragraph className="m-b-0 card-description">
              {t(
                'message.scim-allows-automatic-user-and-group-management-directly-from-your-sso-provider'
              )}
              <Typography.Link
                // href="https://docs.open-metadata.org/connectors/sso/scim"
                className="read-docs-link"
                target="_blank">
                {t('message.read-setup-docs')}
              </Typography.Link>
            </Typography.Paragraph>
          </div>
        ) : (
          <Typography.Text className="text-base">
            {isBot
              ? t('label.om-jwt-token')
              : t('message.personal-access-token')}
          </Typography.Text>
        )}

        <Space>
          {JWTToken ? (
            <Button
              danger
              data-testid="revoke-button"
              disabled={!hasPermission}
              size="small"
              type="default"
              onClick={onTokenRevoke}>
              {t('label.revoke-token')}
            </Button>
          ) : (
            <Button
              className="text-sm"
              data-testid="auth-mechanism"
              disabled={!hasPermission}
              size="small"
              type="primary"
              onClick={onEdit}>
              {t('label.generate-new-token')}
            </Button>
          )}
        </Space>
      </Space>
      <Divider
        className={isSCIMBot ? 'scim-divider' : ''}
        style={
          isSCIMBot
            ? { margin: '16px 24px 16px -24px', width: 'calc(100% + 48px)' }
            : { margin: '8px 0px' }
        }
      />

      {!isSCIMBot && (
        <Typography.Paragraph>{t('message.jwt-token')}</Typography.Paragraph>
      )}
      {isSCIMBot && (
        <Typography.Text className="token-label">
          {t('label.scim-token')}
        </Typography.Text>
      )}

      {JWTToken ? (
        <>
          <Space
            className={classNames(
              'w-full justify-between ant-space-authMechanism',
              isSCIMBot && 'm-t-xs'
            )}>
            <Input.Password
              readOnly
              autoComplete="off"
              data-testid="token"
              placeholder="Generate new token..."
              value={JWTToken}
            />
            {!isSCIMBot ? (
              <CopyToClipboardButton copyText={JWTToken} />
            ) : (
              <CopyIcon
                className="m-t-xs cursor-pointer"
                onClick={() => navigator.clipboard.writeText(JWTToken)}
              />
            )}
          </Space>
          {!isSCIMBot && (
            <p className="text-grey-muted" data-testid="token-expiry">
              {JWTTokenExpiresAt ? (
                isTokenExpired ? (
                  `Expired on ${tokenExpiryDate}.`
                ) : (
                  `Expires on ${tokenExpiryDate}.`
                )
              ) : (
                <>
                  <Icon
                    alt="warning"
                    className="align-middle"
                    component={IconError}
                    style={{ fontSize: '16px' }}
                  />
                  <span className="align-middle">
                    {t('message.token-has-no-expiry')}
                  </span>
                </>
              )}
            </p>
          )}
        </>
      ) : (
        <div className="text-grey-muted text-sm" data-testid="no-token">
          {t('message.no-token-available')}
        </div>
      )}
      {isSCIMBot && (
        <div className="flex justify-between mt-4">
          <div className="flex  gap-8">
            <div className="flex flex-col gap-2">
              <Typography.Text className="created-by-label">
                {t('label.created-by')}
              </Typography.Text>
              <div className="flex items-center gap-2 mt-1">
                <UserPopOverCard
                  showUserName
                  key={botData?.updatedBy}
                  profileWidth={20}
                  userName={botData?.updatedBy ?? ''}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Typography.Text className="created-on-label">
                {t('label.created-on')}
              </Typography.Text>

              <Typography.Text className="created-on-value">
                {new Date(botData?.updatedAt ?? '').toLocaleString()}
              </Typography.Text>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AuthMechanism;
