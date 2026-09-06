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

import {
  BadgeWithDot,
  Box,
  Button,
  FeaturedIcon,
  Select,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Copy01,
  Eye,
  EyeOff,
  Key01,
  Plus,
  RefreshCcw02,
  Trash02,
} from '@untitledui/icons';
import { AxiosError } from 'axios';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Key } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { PersonalAccessToken } from '../../../../../generated/auth/personalAccessToken';
import { JWTTokenExpiry } from '../../../../../generated/entity/teams/user';
import APIClient from '../../../../../rest/index';
import {
  getUserAccessToken,
  updateUserAccessToken,
} from '../../../../../rest/userAPI';
import { getTokenExpiry } from '../../../../../utils/BotsUtils';
import { formatDateTimeLong } from '../../../../../utils/date-time/DateTimeUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../utils/ToastUtils';

const AI_PROFILE_TOKEN_NAME = 'ai-profile-token';

const AccessTokenRow: React.FC = () => {
  const { t } = useTranslation();
  const [token, setToken] = useState<PersonalAccessToken | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [reveal, setReveal] = useState(false);
  const [expiry, setExpiry] = useState<JWTTokenExpiry>(JWTTokenExpiry.OneHour);

  const expiryOptions = useMemo(
    () => [
      { id: JWTTokenExpiry.OneHour, label: `1 ${t('label.hour')}` },
      { id: JWTTokenExpiry.The1, label: `1 ${t('label.day')}` },
      { id: JWTTokenExpiry.The7, label: `7 ${t('label.day-plural')}` },
      { id: JWTTokenExpiry.The30, label: `30 ${t('label.day-plural')}` },
      { id: JWTTokenExpiry.The60, label: `60 ${t('label.day-plural')}` },
      { id: JWTTokenExpiry.The90, label: `90 ${t('label.day-plural')}` },
    ],
    [t]
  );

  const fetchToken = useCallback(async () => {
    setIsFetching(true);
    try {
      const res = await getUserAccessToken();
      setToken(
        res?.find(
          (pat: PersonalAccessToken) => pat.tokenName === AI_PROFILE_TOKEN_NAME
        )
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  const generateToken = async () => {
    const res = await updateUserAccessToken({
      JWTTokenExpiry: expiry,
      tokenName: AI_PROFILE_TOKEN_NAME,
    });
    setToken(res);
  };

  // Revoke by id only — never removeAll (would wipe every PAT the user owns).
  const revokeToken = async (tokenId: string) =>
    APIClient.put('/users/security/token/revoke', { tokenIds: [tokenId] });

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      await generateToken();
      showSuccessToast(t('label.token-generated-successfully'));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!token?.token) {
      return;
    }
    setIsLoading(true);
    try {
      // The endpoint returns the existing token for a name that still has one,
      // so revoke first, then issue the replacement.
      await revokeToken(token.token);
      await generateToken();
      showSuccessToast(t('label.token-generated-successfully'));
    } catch (error) {
      // The old token may already be revoked; clear it so the user gets the
      // generate form to retry instead of a dead token.
      setToken(undefined);
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!token?.token) {
      return;
    }
    setIsLoading(true);
    try {
      await revokeToken(token.token);
      setToken(undefined);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!token?.jwtToken) {
      return;
    }
    if (!navigator.clipboard?.writeText) {
      showErrorToast(t('message.clipboard-not-available') as string);

      return;
    }
    try {
      await navigator.clipboard.writeText(token.jwtToken);
      showSuccessToast(t('label.copied'));
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  if (isFetching) {
    return (
      <Box
        className="ai-profile-page__edit-card tw:w-full tw:rounded-[10px] tw:border tw:border-secondary tw:bg-primary tw:px-5 tw:py-4"
        data-testid="access-token-row"
        direction="col"
        gap={3}>
        <Skeleton height={16} variant="text" width="60%" />
        <Skeleton height={44} variant="rounded" width="100%" />
        <Box justify="end">
          <Skeleton height={36} variant="rounded" width={120} />
        </Box>
      </Box>
    );
  }

  if (!token) {
    return (
      <Box
        align="center"
        className="ai-profile-page__edit-card tw:w-full tw:items-center tw:rounded-[10px] tw:border tw:border-secondary tw:bg-primary tw:px-6 tw:py-10 tw:text-center"
        data-testid="access-token-row"
        direction="col"
        gap={3}
        justify="center">
        <FeaturedIcon color="brand" icon={Key01} size="lg" theme="light" />
        <Typography className="tw:text-primary-900" weight="semibold">
          {t('message.no-access-token-title')}
        </Typography>
        <Typography
          className="tw:max-w-md tw:text-tertiary"
          size="text-sm"
          weight="regular">
          {t('message.no-access-token-subtitle')}
        </Typography>
        <Box align="center" className="tw:mt-3" direction="row" gap={3}>
          <Box align="center" direction="row" gap={2}>
            <Typography
              className="tw:whitespace-nowrap tw:text-tertiary"
              size="text-sm"
              weight="regular">
              {`${t('label.expires-in')}:`}
            </Typography>
            <Select
              aria-label={t('label.token-expiration')}
              className="tw:min-w-28"
              data-testid="token-expiry-select"
              items={expiryOptions}
              selectedKey={expiry}
              size="sm"
              onSelectionChange={(key: Key | null) =>
                key && setExpiry(key as JWTTokenExpiry)
              }>
              {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
            </Select>
          </Box>
          <Button
            color="primary"
            data-testid="generate-token"
            icon={Plus}
            isLoading={isLoading}
            size="sm"
            onClick={handleGenerate}>
            {t('label.generate-token')}
          </Button>
        </Box>
      </Box>
    );
  }

  const isTokenExpired = token.expiryDate
    ? getTokenExpiry(token.expiryDate).isTokenExpired
    : false;
  const statusLabel = isTokenExpired ? t('label.expired') : t('label.active');
  const canReveal = Boolean(token.jwtToken);

  const expiryDate =
    token.expiryDate &&
    formatDateTimeLong(token.expiryDate, 'MMM dd, yyyy, hh:mm a');

  return (
    <Box
      className="ai-profile-page__edit-card tw:w-full tw:overflow-hidden tw:rounded-[10px] tw:border tw:border-secondary tw:bg-primary"
      data-testid="access-token-row"
      direction="col">
      <Box
        align="center"
        className="tw:justify-between tw:border-b tw:border-secondary tw:px-4 tw:py-3.5"
        gap={3}>
        <Box align="center" gap={2}>
          <FeaturedIcon color="brand" icon={Key01} size="md" theme="light" />
          <Box direction="col">
            <Typography className="tw:text-primary-900" weight="semibold">
              {t('label.collate-api-token')}
            </Typography>
            <Typography className="tw:text-tertiary" size="text-xs">
              {statusLabel}
            </Typography>
          </Box>
        </Box>
        <BadgeWithDot
          color={isTokenExpired ? 'error' : 'success'}
          data-testid="token-status"
          size="sm"
          type="pill-color">
          {statusLabel}
        </BadgeWithDot>
      </Box>
      <Box className="tw:px-4 tw:py-4" direction="col" gap={3}>
        <Box direction="col" gap={1}>
          <Typography
            className="tw:text-tertiary"
            size="text-xs"
            weight="medium">
            {t('label.token')}
          </Typography>
          <Box align="center" gap={2}>
            <Box
              align="center"
              className="tw:h-9 tw:min-w-0 tw:flex-1 tw:rounded-lg tw:border tw:border-secondary tw:bg-utility-gray-50 tw:px-3.5">
              <span
                className="tw:min-w-0 tw:flex-1 tw:truncate tw:text-text-secondary tw:bg-utility-gray-50"
                data-testid="token-value">
                {reveal && token.jwtToken
                  ? token.jwtToken
                  : '************************************************************'}
              </span>
            </Box>
            <Button
              noTextPadding
              aria-label={t('label.show')}
              color="secondary"
              data-testid="reveal-token"
              iconLeading={reveal ? Eye : EyeOff}
              isDisabled={!canReveal}
              size="sm"
              onClick={() => setReveal(!reveal)}
            />
            <Button
              color="secondary"
              data-testid="copy-token"
              iconLeading={Copy01}
              isDisabled={!canReveal}
              size="sm"
              onClick={handleCopy}>
              {t('label.copy')}
            </Button>
          </Box>
        </Box>

        {expiryDate && (
          <Typography
            className="tw:text-tertiary"
            data-testid="token-expiry"
            size="text-sm">
            {isTokenExpired
              ? t('message.token-expired-on', { date: expiryDate })
              : t('message.token-expires-on', { date: expiryDate })}
          </Typography>
        )}
      </Box>
      <Box
        align="center"
        className="tw:border-t tw:border-secondary tw:px-4 tw:py-3"
        gap={2}>
        <Button
          color="secondary"
          data-testid="regenerate-token"
          iconLeading={<RefreshCcw02 height={12} width={12} />}
          isLoading={isLoading}
          size="sm"
          onClick={handleRegenerate}>
          {t('label.regenerate')}
        </Button>
        <Button
          color="secondary-destructive"
          data-testid="revoke-token"
          iconLeading={<Trash02 height={12} width={12} />}
          isLoading={isLoading}
          size="sm"
          onClick={handleRevoke}>
          {t('label.revoke')}
        </Button>
      </Box>
    </Box>
  );
};

export default AccessTokenRow;
