/*
 *  Copyright 2024 Collate.
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

import { Box, Chip, Typography } from '@mui/material';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface TitleAndCountConfig {
  titleKey: string;
  count: number;
  loading: boolean;
}

export const useTitleAndCount = (config: TitleAndCountConfig) => {
  const { t } = useTranslation();

  const displayTitle = t(config.titleKey);
  const displayCount = config.loading ? '...' : config.count;

  const titleAndCount = useMemo(
    () => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography
          sx={{
            fontWeight: 600,
            fontSize: '1.125rem',
            color: 'text.primary',
          }}
          variant="h6">
          {displayTitle}
        </Typography>
        <Chip
          color="primary"
          label={displayCount}
          size="small"
          sx={{ border: 'none' }}
        />
      </Box>
    ),
    [displayTitle, displayCount]
  );

  return {
    titleAndCount,
    title: displayTitle,
    count: config.count,
  };
};
