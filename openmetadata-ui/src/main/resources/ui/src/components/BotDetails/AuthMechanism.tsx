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
import { capitalize } from 'lodash';
import React, { FC } from 'react';
import { AuthType } from '../../generated/api/teams/createUser';
import {
  AuthenticationMechanism,
  User,
} from '../../generated/entity/teams/user';
import { getTokenExpiry } from '../../utils/BotsUtils';
import SVGIcons from '../../utils/SvgUtils';
import CopyToClipboardButton from '../buttons/CopyToClipboardButton/CopyToClipboardButton';
import './AuthMechanism.less';

interface Props {
  botUser: User;
  authenticationMechanism: AuthenticationMechanism;
  hasPermission: boolean;
  onEdit: () => void;
  onTokenRevoke: () => void;
}

const AuthMechanism: FC<Props> = ({
  authenticationMechanism,
  hasPermission,
  onEdit,
  onTokenRevoke,
  botUser,
}: Props) => {
  if (authenticationMechanism.authType === AuthType.Jwt) {
    const JWTToken = authenticationMechanism.config?.JWTToken;
    const JWTTokenExpiresAt =
      authenticationMechanism.config?.JWTTokenExpiresAt ?? 0;

    // get the token expiry date
    const { tokenExpiryDate, isTokenExpired } =
      getTokenExpiry(JWTTokenExpiresAt);

    return (
      <>
        <Space className="w-full tw-justify-between">
          <Typography.Text className="tw-text-base">
            OpenMetadata JWT Token
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
                Revoke token
              </Button>
            ) : (
              <Button
                disabled={!hasPermission}
                size="small"
                type="primary"
                onClick={onEdit}>
                Generate New Token
              </Button>
            )}
          </Space>
        </Space>
        <Divider style={{ margin: '8px 0px' }} />
        <Typography.Paragraph>
          Token you have generated that can be used to access the OpenMetadata
          API.
        </Typography.Paragraph>

        {JWTToken ? (
          <>
            <Space className="w-full tw-justify-between ant-space-authMechanism">
              <Input.Password
                readOnly
                data-testid="token"
                placeholder="Generate new token..."
                value={JWTToken}
              />
              <CopyToClipboardButton copyText={JWTToken} />
            </Space>
            <p
              className="tw-text-grey-muted tw-mt-2 tw-italic"
              data-testid="token-expiry">
              {JWTTokenExpiresAt ? (
                isTokenExpired ? (
                  `Expired on ${tokenExpiryDate}.`
                ) : (
                  `Expires on ${tokenExpiryDate}.`
                )
              ) : (
                <>
                  <SVGIcons alt="warning" icon="error" />
                  <span className="tw-ml-1 tw-align-middle">
                    This token has no expiration date.
                  </span>
                </>
              )}
            </p>
          </>
        ) : (
          <div
            className="tw-no-description tw-text-sm tw-mt-4"
            data-testid="no-token">
            No token available
          </div>
        )}
      </>
    );
  }

  if (authenticationMechanism.authType === AuthType.Sso) {
    const authConfig = authenticationMechanism.config?.authConfig;
    const ssoType = authenticationMechanism.config?.ssoServiceType;

    return (
      <>
        <Space className="w-full tw-justify-between">
          <Typography.Text>{`${capitalize(ssoType)} SSO`}</Typography.Text>
          <Button
            disabled={!hasPermission}
            size="small"
            type="primary"
            onClick={onEdit}>
            Edit
          </Button>
        </Space>
        <Divider style={{ margin: '8px 0px' }} />

        <Space className="w-full" direction="vertical">
          <>
            <Typography.Text>Account Email</Typography.Text>
            <Space className="w-full tw-justify-between ant-space-authMechanism">
              <Input
                readOnly
                data-testid="botUser-email"
                value={botUser.email}
              />
              <CopyToClipboardButton copyText={botUser.email} />
            </Space>
          </>

          {authConfig?.secretKey && (
            <>
              <Typography.Text>SecretKey</Typography.Text>
              <Space className="w-full tw-justify-between ant-space-authMechanism">
                <Input.Password
                  readOnly
                  data-testid="secretKey"
                  value={authConfig?.secretKey}
                />
                <CopyToClipboardButton copyText={authConfig?.secretKey} />
              </Space>
            </>
          )}
          {authConfig?.privateKey && (
            <>
              <Typography.Text>PrivateKey</Typography.Text>
              <Space className="w-full tw-justify-between ant-space-authMechanism">
                <Input.Password
                  readOnly
                  data-testid="privateKey"
                  value={authConfig?.privateKey}
                />
                <CopyToClipboardButton copyText={authConfig?.privateKey} />
              </Space>
            </>
          )}
          {authConfig?.clientSecret && (
            <>
              <Typography.Text>ClientSecret</Typography.Text>
              <Space className="w-full tw-justify-between ant-space-authMechanism">
                <Input.Password
                  readOnly
                  data-testid="clientSecret"
                  value={authConfig?.clientSecret}
                />
                <CopyToClipboardButton copyText={authConfig?.clientSecret} />
              </Space>
            </>
          )}
          {authConfig?.audience && (
            <>
              <Typography.Text>Audience</Typography.Text>
              <Space className="w-full tw-justify-between ant-space-authMechanism">
                <Input
                  readOnly
                  data-testid="audience"
                  value={authConfig?.audience}
                />
                <CopyToClipboardButton copyText={authConfig?.audience} />
              </Space>
            </>
          )}
          {authConfig?.clientId && (
            <>
              <Typography.Text>ClientId</Typography.Text>
              <Space className="w-full tw-justify-between ant-space-authMechanism">
                <Input
                  readOnly
                  data-testid="clientId"
                  value={authConfig?.clientId}
                />
                <CopyToClipboardButton copyText={authConfig?.clientId} />
              </Space>
            </>
          )}
          {authConfig?.email && (
            <>
              <Typography.Text>Email</Typography.Text>
              <Space className="w-full tw-justify-between ant-space-authMechanism">
                <Input readOnly data-testid="email" value={authConfig?.email} />
                <CopyToClipboardButton copyText={authConfig?.email} />
              </Space>
            </>
          )}
          {authConfig?.orgURL && (
            <>
              <Typography.Text>OrgURL</Typography.Text>
              <Space className="w-full tw-justify-between ant-space-authMechanism">
                <Input
                  readOnly
                  data-testid="orgURL"
                  value={authConfig?.orgURL}
                />
                <CopyToClipboardButton copyText={authConfig?.orgURL} />
              </Space>
            </>
          )}
          {authConfig?.scopes && (
            <>
              <Typography.Text>Scopes</Typography.Text>
              <Space className="w-full tw-justify-between ant-space-authMechanism">
                <Input
                  readOnly
                  data-testid="scopes"
                  value={authConfig?.scopes.join(',')}
                />
                <CopyToClipboardButton
                  copyText={authConfig?.scopes.join(',')}
                />
              </Space>
            </>
          )}
          {authConfig?.domain && (
            <>
              <Typography.Text>Domain</Typography.Text>
              <Space className="w-full tw-justify-between ant-space-authMechanism">
                <Input
                  readOnly
                  data-testid="domain"
                  value={authConfig?.domain}
                />
                <CopyToClipboardButton copyText={authConfig?.domain} />
              </Space>
            </>
          )}
          {authConfig?.authority && (
            <>
              <Typography.Text>Authority</Typography.Text>
              <Space className="w-full tw-justify-between ant-space-authMechanism">
                <Input
                  readOnly
                  data-testid="authority"
                  value={authConfig?.authority}
                />
                <CopyToClipboardButton copyText={authConfig?.authority} />
              </Space>
            </>
          )}
          {authConfig?.tokenEndpoint && (
            <>
              <Typography.Text>TokenEndpoint</Typography.Text>
              <Space className="w-full tw-justify-between ant-space-authMechanism">
                <Input
                  readOnly
                  data-testid="tokenEndpoint"
                  value={authConfig?.tokenEndpoint}
                />
                <CopyToClipboardButton copyText={authConfig?.tokenEndpoint} />
              </Space>
            </>
          )}
        </Space>
      </>
    );
  }

  return null;
};

export default AuthMechanism;
