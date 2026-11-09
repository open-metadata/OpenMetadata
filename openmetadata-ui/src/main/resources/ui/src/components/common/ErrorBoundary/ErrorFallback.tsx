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
import { Box, Button, Typography } from '@openmetadata/ui-core-components';
import { RefreshCw01 } from '@openmetadata/ui-core-components/icons';
import React from 'react';
import { FallbackProps } from 'react-error-boundary';
import { useNavigate } from 'react-router-dom';
import { ERROR500 } from '../../../constants/constants';
import brandClassBase from '../../../utils/BrandData/BrandClassBase';
import { t } from '../../../utils/i18next/LocalUtil';

const getErrorMessage = (error: unknown) =>
  typeof error === 'object' && error !== null && 'message' in error
    ? String(error.message ?? '')
    : String(error ?? '');

const ErrorFallback: React.FC<FallbackProps> = ({
  error,
  resetErrorBoundary,
}) => {
  const navigate = useNavigate();
  // This boundary wraps App, so it sits outside the ThemeProvider; read the
  // theme off the class the provider left on the root element instead.
  const theme = document.documentElement.classList.contains('dark-mode')
    ? 'dark'
    : 'light';

  const errorMessage = getErrorMessage(error);
  const errorName =
    typeof error === 'object' && error !== null && 'name' in error
      ? error.name
      : undefined;

  const isChunkLoadError =
    errorName === 'ChunkLoadError' ||
    errorMessage.startsWith('Loading chunk') || // Legacy Webpack
    errorMessage
      .toLowerCase()
      .includes('failed to fetch dynamically imported module') || // Vite
    errorMessage.toLowerCase().includes('importing a module script failed'); // Vite (Safari)

  if (!isChunkLoadError) {
    return (
      <Box
        align="center"
        className="tw:h-full tw:px-8 tw:py-12 tw:text-center"
        direction="col"
        gap={6}
        justify="center">
        <Box align="center" direction="col" gap={2}>
          <Typography size="display-xs" weight="semibold">
            {ERROR500}
          </Typography>
          <Typography as="p" color="secondary" size="text-sm">
            {errorMessage}
          </Typography>
        </Box>
        <Button color="primary" onPress={resetErrorBoundary}>
          {t('label.home')}
        </Button>
      </Box>
    );
  }

  // Figma 15445:5396 / 15445:5451.
  return (
    <Box
      align="center"
      className="tw:h-full tw:overflow-y-auto tw:bg-secondary tw:p-8"
      data-testid="upgrade-screen"
      justify="center">
      <Box
        align="center"
        className="tw:w-full tw:max-w-full tw:text-center tw:md:w-fit"
        direction="col"
        gap={9}>
        <img
          alt={t('message.look-like-upgraded-om')}
          className="tw:w-full tw:max-w-100"
          src={brandClassBase.getUpgradeScreenImg(theme)}
        />
        <Box align="center" direction="col" gap={10}>
          <Box align="center" direction="col" gap={4}>
            {/* not-prose: .prose h1 rules would override the size and weight. */}
            <Typography
              as="h1"
              className="not-prose tw:m-0 tw:text-primary tw:lg:whitespace-nowrap"
              size="display-xs"
              weight="bold">
              {`${t('message.look-like-upgraded-om')} ✨`}
            </Typography>
            <Typography
              as="p"
              className="tw:max-w-109 tw:text-tertiary"
              size="text-md">
              {t('message.brand-updated-refresh-page')}
            </Typography>
          </Box>
          <Button
            className="tw:h-12.5 tw:gap-2.5 tw:rounded-md tw:px-5 tw:text-lg"
            color="primary"
            data-testid="refresh-page-btn"
            iconLeading={RefreshCw01}
            size="xl"
            onPress={() => navigate(0)}>
            {t('label.refresh-page')}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default ErrorFallback;
