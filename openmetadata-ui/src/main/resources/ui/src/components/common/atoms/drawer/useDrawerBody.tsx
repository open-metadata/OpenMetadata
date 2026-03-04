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

import { Box, CircularProgress } from '@mui/material';
import { ReactNode, useMemo } from 'react';

export interface DrawerBodyConfig {
  children?: ReactNode;
  loading?: boolean;
  loadingMessage?: string;
  padding?: number | string;
  className?: string;
  sx?: any;
}

/**
 * Drawer body atom for content area with loading state
 *
 * @description
 * Provides a scrollable content area for drawer with optional loading state.
 * Automatically handles overflow and flex layout.
 *
 * @param config.children - Content to render in body
 * @param config.loading - Whether to show loading state
 * @param config.loadingMessage - Optional message to show with loader
 * @param config.padding - Padding for body content (default: 3)
 * @param config.sx - Custom styles to apply to body container
 *
 * @example
 * ```typescript
 * const { drawerBody } = useDrawerBody({
 *   children: <MyForm />,
 *   loading: isSubmitting,
 *   loadingMessage: 'Saving...'
 * });
 *
 * return (
 *   <Drawer open={open}>
 *     {drawerHeader}
 *     {drawerBody}
 *     {drawerFooter}
 *   </Drawer>
 * );
 * ```
 */
export const useDrawerBody = (config: DrawerBodyConfig = {}) => {
  const {
    children,
    loading,
    loadingMessage,
    padding = 6,
    className,
    sx = {},
  } = config;

  const drawerBody = useMemo(
    () => (
      <Box
        sx={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          ...sx,
        }}>
        {loading && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              zIndex: 1000,
            }}>
            <CircularProgress />
            {loadingMessage && (
              <Box sx={{ mt: 2, color: 'text.secondary' }}>
                {loadingMessage}
              </Box>
            )}
          </Box>
        )}
        <Box
          className={className}
          sx={{
            overflow: 'auto',
            height: '100%',
            p: padding,
          }}>
          {children}
        </Box>
      </Box>
    ),
    [children, loading, loadingMessage, padding, className, sx]
  );

  return {
    drawerBody,
  };
};
