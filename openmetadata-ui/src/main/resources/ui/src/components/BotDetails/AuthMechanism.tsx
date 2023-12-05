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

import { Button, Divider, Input, Space, Typography } from 'antd';
import { t } from 'i18next';
import React, { FC, useMemo } from 'react';
import { PersonalAccessToken } from '../../generated/auth/personalAccessToken';
import { AuthenticationMechanism } from '../../generated/entity/teams/user';
import { getTokenExpiry } from '../../utils/BotsUtils';
import SVGIcons from '../../utils/SvgUtils';
import CopyToClipboardButton from '../CopyToClipboardButton/CopyToClipboardButton';
import './auth-mechanism.less';

interface Props {
  authenticationMechanism: AuthenticationMechanism | PersonalAccessToken;
  hasPermission: boolean;
  onEdit?: () => void;
  onTokenRevoke?: () => void;
  isBot: boolean;
}

const AuthMechanism: FC<Props> = ({
  authenticationMechanism,
  hasPermission,
  onEdit,
  onTokenRevoke,
  isBot,
}: Props) => {
  const { JWTToken, JWTTokenExpiresAt } = useMemo(() => {
    let data: {
      JWTToken?: string;
      JWTTokenExpiresAt: number;
    } = {
      JWTToken: '',
      JWTTokenExpiresAt: 0,
    };
    if (isBot) {
      const botData = authenticationMechanism as AuthenticationMechanism;

      data = {
        JWTToken: botData?.config?.JWTToken,
        JWTTokenExpiresAt: botData?.config?.JWTTokenExpiresAt ?? 0,
      };
    } else {
      const personalAccessData = authenticationMechanism as PersonalAccessToken;

      data = {
        JWTToken: personalAccessData?.jwtToken,
        JWTTokenExpiresAt: personalAccessData?.expiryDate ?? 0,
      };
    }

    return data;
  }, [isBot, authenticationMechanism]);

  const { tokenExpiryDate, isTokenExpired } = getTokenExpiry(JWTTokenExpiresAt);

  return (
    <>
      <Space className="w-full justify-between">
        <Typography.Text className="text-base">
          {t('label.om-jwt-token')}
        </Typography.Text>
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
              disabled={!hasPermission}
              size="small"
              type="primary"
              onClick={onEdit}>
              {t('label.generate-new-token')}
            </Button>
          )}
        </Space>
      </Space>
      <Divider style={{ margin: '8px 0px' }} />
      <Typography.Paragraph>{t('message.jwt-token')}</Typography.Paragraph>

      {JWTToken ? (
        <>
          <Space className="w-full justify-between ant-space-authMechanism">
            <Input.Password
              readOnly
              autoComplete="off"
              data-testid="token"
              placeholder="Generate new token..."
              value={JWTToken}
            />
            <CopyToClipboardButton copyText={JWTToken} />
          </Space>
          <p className="text-grey-muted" data-testid="token-expiry">
            {JWTTokenExpiresAt ? (
              isTokenExpired ? (
                `Expired on ${tokenExpiryDate}.`
              ) : (
                `Expires on ${tokenExpiryDate}.`
              )
            ) : (
              <>
                <SVGIcons alt="warning" icon="error" />
                <span className="align-middle">
                  {t('message.token-has-no-expiry')}
                </span>
              </>
            )}
          </p>
        </>
      ) : (
        <div className="text-grey-muted text-sm" data-testid="no-token">
          {t('message.no-token-available')}
        </div>
      )}
    </>
  );
};

export default AuthMechanism;
