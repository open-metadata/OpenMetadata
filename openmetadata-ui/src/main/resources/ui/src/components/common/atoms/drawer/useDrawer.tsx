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

import { Drawer } from '@mui/material';
import { ReactNode, useCallback, useMemo, useState } from 'react';

export interface DrawerConfig {
  anchor?: 'left' | 'right' | 'top' | 'bottom';
  width?: number | string;
  height?: number | string;
  onClose?: () => void;
  onOpen?: () => void;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  children?: ReactNode;
  defaultOpen?: boolean;
  zIndex?: number;
  testId?: string;
}

/**
 * Base drawer hook with state management and configuration
 *
 * @description
 * Provides drawer state management and returns a configured MUI Drawer.
 * Can be used standalone or composed with other drawer atoms.
 *
 * @param config.anchor - Drawer position ('left' | 'right' | 'top' | 'bottom')
 * @param config.width - Drawer width (number or string)
 * @param config.height - Drawer height (for top/bottom anchors)
 * @param config.onClose - Callback when drawer closes
 * @param config.onOpen - Callback when drawer opens
 * @param config.closeOnEscape - Whether ESC key closes drawer (default: true)
 * @param config.closeOnBackdrop - Whether clicking backdrop closes drawer (default: true)
 * @param config.children - Content to render in drawer
 * @param config.defaultOpen - Initial open state
 * @param config.zIndex - Custom z-index for drawer (default: 1000)
 *
 * @example
 * ```typescript
 * const { drawer, openDrawer, closeDrawer, open } = useDrawer({
 *   anchor: 'right',
 *   width: 500,
 *   children: <MyContent />
 * });
 *
 * return (
 *   <>
 *     <Button onClick={openDrawer}>Open</Button>
 *     {drawer}
 *   </>
 * );
 * ```
 */
export const useDrawer = (config: DrawerConfig = {}) => {
  const [open, setOpen] = useState(config.defaultOpen || false);

  const openDrawer = useCallback(() => {
    setOpen(true);
    config.onOpen?.();
  }, [config.onOpen]);

  const closeDrawer = useCallback(() => {
    setOpen(false);
    config.onClose?.();
  }, [config.onClose]);

  const toggleDrawer = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const handleClose = useCallback(
    (
      _event: React.SyntheticEvent,
      reason: 'backdropClick' | 'escapeKeyDown'
    ) => {
      if (reason === 'backdropClick' && config.closeOnBackdrop === false) {
        return;
      }
      if (reason === 'escapeKeyDown' && config.closeOnEscape === false) {
        return;
      }
      closeDrawer();
    },
    [closeDrawer, config.closeOnBackdrop, config.closeOnEscape]
  );

  const getDrawerSx = useMemo(() => {
    const sx: any = {
      zIndex: config.zIndex || 1000, // Set default z-index to 1000
    };

    if (
      config.anchor === 'left' ||
      config.anchor === 'right' ||
      !config.anchor
    ) {
      sx['& .MuiDrawer-paper'] = {
        width: config.width || '40vw',
      };
    }

    if (config.anchor === 'top' || config.anchor === 'bottom') {
      sx['& .MuiDrawer-paper'] = { height: config.height || 300 };
    }

    return sx;
  }, [config.anchor, config.width, config.height, config.zIndex]);

  const drawer = useMemo(
    () => (
      <Drawer
        anchor={config.anchor || 'right'}
        data-testid={config.testId}
        open={open}
        sx={getDrawerSx}
        onClose={handleClose}>
        {config.children}
      </Drawer>
    ),
    [
      open,
      config.anchor,
      config.children,
      config.testId,
      getDrawerSx,
      handleClose,
    ]
  );

  return {
    // State
    open,
    isOpen: open,

    // Actions
    openDrawer,
    closeDrawer,
    toggleDrawer,
    setOpen,

    // UI
    drawer,
  };
};
