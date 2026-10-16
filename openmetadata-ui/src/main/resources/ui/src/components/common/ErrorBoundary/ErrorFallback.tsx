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

  const isChunkLoadError =
    error?.name === 'ChunkLoadError' ||
    error.message?.startsWith('Loading chunk') || // Legacy Webpack
    error.message
      ?.toLowerCase()
      .includes('failed to fetch dynamically imported module') || // Vite
    error.message?.toLowerCase().includes('importing a module script failed'); // Vite (Safari)

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
            {error.message}
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
      className="tw:h-full tw:overflow-y-auto tw:bg-tertiary tw:p-8 tw:dark:bg-secondary"
      data-testid="upgrade-screen"
      justify="center">
      <Box
        align="center"
        className="tw:w-fit tw:min-w-[min(636px,100%)] tw:max-w-full tw:rounded-3xl tw:bg-primary tw:px-9 tw:py-17.5 tw:text-center tw:dark:bg-tertiary"
        direction="col"
        gap={9}>
        <img
          alt={t('message.look-like-upgraded-om')}
          className="tw:w-full tw:max-w-100"
          src={brandClassBase.getUpgradeScreenImg(theme)}
        />
        <Box align="center" direction="col" gap={10}>
          <Box align="center" direction="col" gap={4}>
            <h1 className="tw:m-0 tw:text-display-sm tw:font-bold tw:text-primary tw:lg:whitespace-nowrap">
              {`${t('message.look-like-upgraded-om')} ✨`}
            </h1>
            <Typography
              as="p"
              className="tw:max-w-109 tw:text-tertiary"
              size="text-md">
              {t('message.brand-updated-refresh-page')}
            </Typography>
          </Box>
          <Button
            className="tw:h-12.5 tw:gap-2.5 tw:rounded-md tw:px-5 tw:text-[17px]"
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
