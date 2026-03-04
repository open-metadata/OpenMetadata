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

import { Box, IconButton, SxProps, Typography } from '@mui/material';
import { defaultColors } from '@openmetadata/ui-core-components';
import { XClose } from '@untitledui/icons';
import { ReactNode, useMemo } from 'react';

export interface DrawerHeaderConfig {
  title?: string | ReactNode;
  showCloseButton?: boolean;
  onClose?: () => void;
  actions?: ReactNode;
  sx?: SxProps;
}

/**
 * Drawer header atom with title, close button, and optional actions
 *
 * @description
 * Provides a consistent drawer header with title and close functionality.
 * Can be used standalone or composed with other drawer atoms.
 *
 * @param config.title - Title text or ReactNode to display
 * @param config.showCloseButton - Whether to show close button (default: true)
 * @param config.onClose - Callback when close button is clicked
 * @param config.actions - Optional actions to display in header
 * @param config.sx - Custom styles to apply to header container
 *
 * @example
 * ```typescript
 * const { drawerHeader } = useDrawerHeader({
 *   title: 'Add Domain',
 *   onClose: closeDrawer,
 *   actions: <Button size="small">Help</Button>
 * });
 *
 * return (
 *   <Drawer open={open}>
 *     {drawerHeader}
 *     <Box>Content</Box>
 *   </Drawer>
 * );
 * ```
 */
export const useDrawerHeader = (config: DrawerHeaderConfig = {}) => {
  const { title, showCloseButton = true, onClose, actions, sx = {} } = config;

  const drawerHeader = useMemo(
    () => (
      <Box
        sx={{
          px: 6,
          py: 4,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative',
          '& > *': {
            position: 'relative',
            zIndex: 1,
          },
          ...sx,
        }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
          {typeof title === 'string' ? (
            <Typography data-testid="form-heading" variant="h6">
              {title}
            </Typography>
          ) : (
            title
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {actions}
          {showCloseButton && onClose && (
            <IconButton
              data-testid="drawer-close-icon"
              size="medium"
              sx={{ color: defaultColors.gray[700] }}
              onClick={onClose}>
              <XClose />
            </IconButton>
          )}
        </Box>
      </Box>
    ),
    [title, showCloseButton, onClose, actions, sx]
  );

  return {
    drawerHeader,
  };
};
