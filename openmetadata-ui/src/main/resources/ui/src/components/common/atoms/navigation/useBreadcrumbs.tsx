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
import { useCallback, useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';

/**
 * Represents a single breadcrumb item in the navigation hierarchy
 */
export interface BreadcrumbItem {
  /** Display name for the breadcrumb */
  name: string;
  /** Navigation URL for the breadcrumb (use url OR onClick, not both) */
  url?: string;
  /** Click handler for the breadcrumb (use url OR onClick, not both) */
  onClick?: () => void;
  /** Optional: Mark as active/current item (renders as Typography instead of Link) */
  isActive?: boolean;
}

/**
 * Configuration for home icon breadcrumb
 */
export interface HomeBreadcrumbConfig {
  /** URL for home navigation */
  url?: string;
  /** Click handler for home icon */
  onClick?: () => void;
  /** If false, home icon will not be displayed */
  show?: boolean;
}

/**
 * Configuration for breadcrumb navigation
 */
interface BreadcrumbsConfig {
  /** Breadcrumb items to display after home icon */
  items: BreadcrumbItem[];
  /** Optional: Home icon configuration (default: { url: '/', show: true }) */
  home?: HomeBreadcrumbConfig;
}

// Style constants
const BREADCRUMB_STYLES = {
  container: { px: 0, py: 0, mb: 3 },
  link: {
    fontSize: '14px',
    lineHeight: '20px',
    textDecoration: 'none',
  },
  buttonBase: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
} as const;

export const useBreadcrumbs = (config: BreadcrumbsConfig) => {
  const theme = useTheme();

  // Default home config
  const homeConfig = useMemo(
    () => ({
      url: '/',
      show: true,
      ...config.home,
    }),
    [config.home]
  );

  const renderHomeIcon = useCallback(() => {
    if (!homeConfig.show) {
      return null;
    }

    const iconElement = (
      <Home02
        className="h-5 w-5"
        strokeWidth="1px"
        style={{ color: theme.palette.allShades?.gray?.[600] }}
      />
    );

    const linkSx = {
      alignItems: 'center',
      display: 'flex',
      ...(homeConfig.onClick && {
        ...BREADCRUMB_STYLES.buttonBase,
        padding: 0,
      }),
    };

    return homeConfig.onClick ? (
      <Link
        component="button"
        data-testid="breadcrumb-link"
        sx={linkSx}
        onClick={homeConfig.onClick}>
        {iconElement}
      </Link>
    ) : (
      <Link
        component={RouterLink}
        data-testid="breadcrumb-link"
        sx={linkSx}
        to={homeConfig.url || '/'}>
        {iconElement}
      </Link>
    );
  }, [homeConfig, theme]);

  const renderBreadcrumbItem = useCallback(
    (crumb: BreadcrumbItem, index: number) => {
      const isLastItem = index === config.items.length - 1;
      const shouldBeActive =
        crumb.isActive !== undefined ? crumb.isActive : isLastItem;
      const key = crumb.url || `breadcrumb-${index}`;

      const linkSx = {
        color: theme.palette.allShades?.brand?.[700],
        ...BREADCRUMB_STYLES.link,
        ...(crumb.onClick && BREADCRUMB_STYLES.buttonBase),
      };

      if (shouldBeActive) {
        return (
          <Typography data-testid="breadcrumb-link" key={key} sx={linkSx}>
            {crumb.name}
          </Typography>
        );
      }

      if (crumb.onClick) {
        return (
          <Link
            component="button"
            data-testid="breadcrumb-link"
            key={key}
            sx={linkSx}
            onClick={crumb.onClick}>
            {crumb.name}
          </Link>
        );
      }

      return (
        <Link
          component={RouterLink}
          data-testid="breadcrumb-link"
          key={key}
          sx={linkSx}
          to={crumb.url || '/'}>
          {crumb.name}
        </Link>
      );
    },
    [config.items.length, theme]
  );

  const breadcrumbs = useMemo(
    () => (
      <Box data-testid="breadcrumb" sx={BREADCRUMB_STYLES.container}>
        <Breadcrumbs separator={<ChevronRight className="h-3 w-3" />}>
          {renderHomeIcon()}
          {config.items.map(renderBreadcrumbItem)}
        </Breadcrumbs>
      </Box>
    ),
    [config.items, renderHomeIcon, renderBreadcrumbItem]
  );

  return { breadcrumbs };
};
