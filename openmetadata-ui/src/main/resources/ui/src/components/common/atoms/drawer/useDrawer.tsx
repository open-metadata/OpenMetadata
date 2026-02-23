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

import { SlideoutMenu } from '@openmetadata/ui-core-components';
import { ReactNode, useCallback, useMemo, useState } from 'react';

export interface DrawerConfig {
  anchor?: 'left' | 'right' | 'top' | 'bottom';
  width?: number | string;
  onClose?: () => void;
  onOpen?: () => void;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  children?: ReactNode;
  defaultOpen?: boolean;
  testId?: string;
}

const getWidthClassName = (width?: number | string): string | undefined => {
  if (!width) {
    return undefined;
  }
  const value = typeof width === 'number' ? `${width}px` : width;

  return `tw:max-w-[${value}] tw:w-[${value}]`;
};

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

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        openDrawer();
      } else {
        closeDrawer();
      }
    },
    [openDrawer, closeDrawer]
  );

  const widthClassName = useMemo(
    () => getWidthClassName(config.width),
    [config.width]
  );

  const drawer = useMemo(
    () => (
      <SlideoutMenu
        {...({ className: widthClassName } as Record<string, unknown>)}
        data-testid={config.testId}
        isDismissable={config.closeOnBackdrop !== false}
        isKeyboardDismissDisabled={config.closeOnEscape === false}
        isOpen={open}
        onOpenChange={handleOpenChange}>
        {config.children}
      </SlideoutMenu>
    ),
    [
      open,
      config.children,
      config.testId,
      config.closeOnBackdrop,
      config.closeOnEscape,
      widthClassName,
      handleOpenChange,
    ]
  );

  return {
    open,
    isOpen: open,

    openDrawer,
    closeDrawer,
    toggleDrawer,
    setOpen,

    drawer,
  };
};
