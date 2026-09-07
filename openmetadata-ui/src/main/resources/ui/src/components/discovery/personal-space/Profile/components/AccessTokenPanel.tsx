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

import { Box, Typography } from '@openmetadata/ui-core-components';
import React from 'react';
import { useTranslation } from 'react-i18next';
import AccessTokenRow from './AccessTokenRow';

/**
 * The Access Token nav page: a "Personal access token" heading + description
 * stacked above the full-width token card.
 */
const AccessTokenPanel: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Box className="tw:max-w-[800px]" direction="col" gap={4}>
      <Box direction="col">
        <Typography
          className="tw:text-primary-900 tw:uppercase"
          size="text-xs"
          weight="medium">
          {t('message.personal-access-token')}
        </Typography>
        <Typography
          className="tw:text-text-secondary"
          size="text-xs"
          weight="regular">
          {t('message.access-token-description')}
        </Typography>
      </Box>
      <AccessTokenRow />
    </Box>
  );
};

export default AccessTokenPanel;
