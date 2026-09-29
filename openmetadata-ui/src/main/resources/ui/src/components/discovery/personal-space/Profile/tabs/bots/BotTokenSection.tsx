/*
 *  Copyright 2026 Collate.
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

import {
  Box,
  Button,
  Input,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import { AlertTriangle, Copy01 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  JWTTokenExpiry,
  User,
} from '../../../../../../generated/entity/teams/user';
import {
  generateUserToken,
  revokeUserToken,
} from '../../../../../../rest/userAPI';
import {
  getTokenExpiry,
  getTokenIssuedAtMs,
} from '../../../../../../utils/BotsUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import { TOKEN_EXPIRY_OPTIONS } from './BotToken.constants';

interface BotTokenSectionProps {
  botUserData: User;
  onTokenUpdate: () => Promise<void>;
}

const BotTokenSection: React.FC<BotTokenSectionProps> = ({
  botUserData,
  onTokenUpdate,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedExpiry, setSelectedExpiry] = useState(JWTTokenExpiry.OneHour);

  const authMechanism = botUserData.authenticationMechanism;
  const jwtToken = authMechanism?.config?.JWTToken as string | undefined;
  const jwtTokenExpiresAt = (authMechanism?.config?.JWTTokenExpiresAt ??
    0) as number;
  const { tokenExpiryDate, isTokenExpired } = useMemo(
    () => getTokenExpiry(jwtTokenExpiresAt),
    [jwtTokenExpiresAt]
  );

  // The current token's creation time. The bot user's updatedAt does not change
  // when the token is regenerated, so prefer the JWT `iat` claim and fall back
  // to updatedAt only when the token is opaque.
  const tokenCreatedOn = useMemo(() => {
    const issuedAtMs = getTokenIssuedAtMs(jwtToken);

    if (issuedAtMs) {
      return new Date(issuedAtMs).toLocaleString();
    }

    if (botUserData.updatedAt) {
      return new Date(botUserData.updatedAt).toLocaleString();
    }

    return '';
  }, [jwtToken, botUserData.updatedAt]);

  const tokenExpiryOptions = useMemo(
    () =>
      TOKEN_EXPIRY_OPTIONS.map((opt) => ({
        id: opt.id,
        label: t(opt.labelKey, opt.labelParams),
      })),
    [t]
  );

  const handleCopy = useCallback(() => {
    if (jwtToken) {
      navigator.clipboard.writeText(jwtToken);
      showSuccessToast(t('message.copied-to-clipboard'));
    }
  }, [jwtToken, t]);

  const handleGenerate = useCallback(async () => {
    setIsUpdating(true);

    try {
      await generateUserToken({
        id: botUserData.id,
        JWTTokenExpiry: selectedExpiry,
      });
      await onTokenUpdate();
      setIsEditing(false);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsUpdating(false);
    }
  }, [botUserData.id, selectedExpiry, onTokenUpdate]);

  const handleRevoke = useCallback(async () => {
    setIsUpdating(true);

    try {
      await revokeUserToken(botUserData.id);
      await onTokenUpdate();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsUpdating(false);
    }
  }, [botUserData.id, onTokenUpdate]);

  const expiryMessage = useMemo(() => {
    if (jwtTokenExpiresAt === 0) {
      return t('message.token-has-no-expiry');
    }

    return isTokenExpired
      ? t('message.token-expired-on', { date: tokenExpiryDate })
      : t('message.token-expires-on', { date: tokenExpiryDate });
  }, [jwtTokenExpiresAt, isTokenExpired, tokenExpiryDate, t]);

  return (
    <div
      className="tw:border tw:border-subtle tw:rounded-xl"
      data-testid="token-section">
      {/* Header */}
      <Box
        align="center"
        className="tw:p-4.5 tw:px-6 tw:border-b tw:border-subtle"
        direction="row"
        justify="between">
        <Box direction="col" gap={0.5}>
          <Typography data-testid="center-panel" size="text-sm" weight="medium">
            {t('label.om-jwt-token')}
          </Typography>
          <Typography className="tw:text-tertiary" size="text-xs">
            {t('message.jwt-token')}
          </Typography>
        </Box>
        <Box direction="row" gap={2}>
          {jwtToken ? (
            <Button
              color="secondary-destructive"
              data-testid="revoke-button"
              isLoading={isUpdating}
              size="sm"
              onPress={handleRevoke}>
              {t('label.revoke-token')}
            </Button>
          ) : (
            !isEditing && (
              <Button
                color="primary"
                data-testid="auth-mechanism"
                size="sm"
                onPress={() => setIsEditing(true)}>
                {t('label.generate-new-token')}
              </Button>
            )
          )}
        </Box>
      </Box>

      {/* Body */}
      <div className="tw:p-5 tw:px-6">
        {jwtToken && !isEditing && (
          <Box direction="col" gap={2.5}>
            <Box align="start" direction="row" gap={2}>
              <Input
                readOnly
                className="tw:flex-1"
                data-testid="token"
                type="password"
                value={jwtToken}
              />
              <Button
                color="secondary"
                data-testid="copy-token"
                iconLeading={Copy01}
                size="md"
                onPress={handleCopy}>
                {t('label.copy')}
              </Button>
            </Box>
            <Box direction="col" gap={1.5}>
              <Box
                align="center"
                className="tw:text-fg-warning-primary tw:my-2.5"
                data-testid="token-expiry"
                direction="row"
                gap={2}>
                <AlertTriangle className="tw:size-4 tw:shrink-0" />
                <Typography size="text-xs">{expiryMessage}</Typography>
              </Box>
              {tokenCreatedOn && (
                <Box align="center" direction="row" gap={1}>
                  <Typography className="tw:text-tertiary" size="text-xs">
                    {t('label.created-on')}
                  </Typography>
                  <Typography
                    data-testid="token-created-on"
                    size="text-xs"
                    weight="medium">
                    {tokenCreatedOn}
                  </Typography>
                </Box>
              )}
              <Typography className="tw:text-tertiary" size="text-xs">
                {t('message.token-security-description')}
              </Typography>
            </Box>
          </Box>
        )}

        {!jwtToken && !isEditing && (
          <Typography
            className="tw:text-tertiary"
            data-testid="no-token"
            size="text-sm">
            {t('message.no-token-available')}
          </Typography>
        )}

        {isEditing && (
          <Box direction="col" gap={3}>
            <Box direction="col" gap={1}>
              <Typography size="text-sm" weight="medium">
                {t('label.token-expiration')}
              </Typography>
              <Select
                data-testid="token-expiry"
                items={tokenExpiryOptions}
                selectedKey={selectedExpiry}
                onSelectionChange={(key) =>
                  setSelectedExpiry(key as JWTTokenExpiry)
                }>
                {(item) => (
                  <Select.Item id={item.id} key={item.id}>
                    {item.label}
                  </Select.Item>
                )}
              </Select>
            </Box>
            <Box direction="row" gap={2}>
              <Button
                color="secondary"
                data-testid="cancel-edit"
                size="sm"
                onPress={() => setIsEditing(false)}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
                data-testid="save-edit"
                isLoading={isUpdating}
                size="sm"
                onPress={handleGenerate}>
                {t('label.generate')}
              </Button>
            </Box>
          </Box>
        )}
      </div>
    </div>
  );
};

export default BotTokenSection;
