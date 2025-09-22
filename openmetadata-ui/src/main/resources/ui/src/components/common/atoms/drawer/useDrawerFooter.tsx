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

import { Box, Button, CircularProgress } from '@mui/material';
import { ReactNode, useMemo } from 'react';

export interface DrawerFooterButton {
  label: string;
  onClick: () => void;
  variant?: 'text' | 'outlined' | 'contained';
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  disabled?: boolean;
  loading?: boolean;
  testId?: string;
}

export interface DrawerFooterConfig {
  buttons?: DrawerFooterButton[];
  primaryButton?: DrawerFooterButton;
  secondaryButton?: DrawerFooterButton;
  customContent?: ReactNode;
  align?: 'left' | 'center' | 'right' | 'space-between';
  sx?: any;
}

/**
 * Drawer footer atom with action buttons
 *
 * @description
 * Provides a footer area with configurable buttons or custom content.
 * Supports primary/secondary button pattern or custom button array.
 *
 * @param config.buttons - Array of button configurations
 * @param config.primaryButton - Primary action button (alternative to buttons array)
 * @param config.secondaryButton - Secondary action button (alternative to buttons array)
 * @param config.customContent - Custom content to render instead of buttons
 * @param config.align - Button alignment (default: 'right')
 * @param config.sx - Custom styles to apply to footer container
 *
 * @example
 * ```typescript
 * const { drawerFooter } = useDrawerFooter({
 *   primaryButton: {
 *     label: 'Save',
 *     onClick: handleSave,
 *     loading: isSaving
 *   },
 *   secondaryButton: {
 *     label: 'Cancel',
 *     onClick: handleCancel
 *   }
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
export const useDrawerFooter = (config: DrawerFooterConfig = {}) => {
  const {
    buttons,
    primaryButton,
    secondaryButton,
    customContent,
    align = 'right',
    sx = {},
  } = config;

  const getJustifyContent = () => {
    switch (align) {
      case 'left':
        return 'flex-start';
      case 'center':
        return 'center';
      case 'space-between':
        return 'space-between';
      case 'right':
      default:
        return 'flex-end';
    }
  };

  const renderButton = (button: DrawerFooterButton) => (
    <Button
      color={button.color || 'primary'}
      data-testid={button.testId}
      disabled={button.disabled || button.loading}
      key={button.label}
      startIcon={button.loading ? <CircularProgress size={16} /> : null}
      variant={button.variant || 'text'}
      onClick={button.onClick}>
      {button.label}
    </Button>
  );

  const drawerFooter = useMemo(() => {
    if (customContent) {
      return (
        <Box
          sx={{
            px: 6,
            py: 4,
            borderTop: 1,
            borderColor: 'divider',
            boxShadow:
              '0px -4px 6px -2px #0A0D1208, 0px -13px 16px -4px #0A0D1214',
            ...sx,
          }}>
          {customContent}
        </Box>
      );
    }

    const buttonsToRender = buttons || [];
    if (!buttons && (primaryButton || secondaryButton)) {
      if (secondaryButton) {
        buttonsToRender.push(secondaryButton);
      }
      if (primaryButton) {
        buttonsToRender.push({
          ...primaryButton,
          variant: primaryButton.variant || 'contained',
        });
      }
    }

    if (buttonsToRender.length === 0) {
      return null;
    }

    return (
      <Box
        sx={{
          px: 6,
          py: 4,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          justifyContent: getJustifyContent(),
          gap: 2,
          boxShadow:
            '0px -4px 6px -2px #0A0D1208, 0px -13px 16px -4px #0A0D1214',
          ...sx,
        }}>
        {buttonsToRender.map(renderButton)}
      </Box>
    );
  }, [buttons, primaryButton, secondaryButton, customContent, align, sx]);

  return {
    drawerFooter,
  };
};
