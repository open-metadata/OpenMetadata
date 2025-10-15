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

import { Box, Breadcrumbs, Link, Typography, useTheme } from '@mui/material';
import { ChevronRight, Home02 } from '@untitledui/icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface BreadcrumbsConfig {
  entityLabelKey: string;
  basePath?: string;
  currentEntityName?: string;
}

export const useBreadcrumbs = (config: BreadcrumbsConfig) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();

  const navigateHome = () => navigate('/');
  const navigateToListing = () =>
    navigate(config.basePath || `/${config.entityLabelKey}`);

  const displayLabel = t(config.entityLabelKey);

  // Inline implementation copying exact EntityBreadcrumbs styling
  const breadcrumbs = useMemo(
    () => (
      <Box sx={{ px: 0, py: 0, mb: 5 }}>
        <Breadcrumbs separator={<ChevronRight className="h-3 w-3" />}>
          <Link href="/" sx={{ display: 'flex', alignItems: 'center' }}>
            <Home02
              className="h-5 w-5"
              strokeWidth="1px"
              style={{ color: theme.palette.allShades?.gray?.[600] }}
            />
          </Link>
          <Typography
            sx={{
              color: theme.palette.allShades?.brand?.[700],
              fontSize: '14px',
              lineHeight: '20px',
            }}>
            {displayLabel}
          </Typography>
        </Breadcrumbs>
      </Box>
    ),
    [displayLabel, theme]
  );

  return {
    breadcrumbs,
    navigateHome,
    navigateToListing,
  };
};
