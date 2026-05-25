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

import { Button, SlideoutMenu } from '@openmetadata/ui-core-components';
import { ReactNode, useMemo } from 'react';

type ButtonColor =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'primary-destructive'
  | 'secondary-destructive'
  | 'tertiary-destructive';

export interface DrawerFooterButton {
  label: string;
  onClick: () => void;
  color?: ButtonColor;
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
}

const ALIGN_MAP = {
  left: 'tw:justify-start',
  center: 'tw:justify-center',
  right: 'tw:justify-end',
  'space-between': 'tw:justify-between',
} as const;

export const useDrawerFooter = (config: DrawerFooterConfig = {}) => {
  const {
    buttons,
    primaryButton,
    secondaryButton,
    customContent,
    align = 'right',
  } = config;

  const drawerFooter = useMemo(() => {
    if (customContent) {
      return <SlideoutMenu.Footer>{customContent}</SlideoutMenu.Footer>;
    }

    const buttonsToRender = buttons || [];
    if (!buttons && (primaryButton || secondaryButton)) {
      if (secondaryButton) {
        buttonsToRender.push({
          ...secondaryButton,
          color: secondaryButton.color || 'secondary',
        });
      }
      if (primaryButton) {
        buttonsToRender.push({
          ...primaryButton,
          color: primaryButton.color || 'primary',
        });
      }
    }

    if (buttonsToRender.length === 0) {
      return null;
    }

    return (
      <SlideoutMenu.Footer className={`tw:flex tw:gap-2 ${ALIGN_MAP[align]}`}>
        {buttonsToRender.map((button) => (
          <Button
            color={button.color || 'primary'}
            data-testid={button.testId}
            isDisabled={button.disabled || button.loading}
            isLoading={button.loading}
            key={button.label}
            size="sm"
            onClick={button.onClick}>
            {button.label}
          </Button>
        ))}
      </SlideoutMenu.Footer>
    );
  }, [buttons, primaryButton, secondaryButton, customContent, align]);

  return {
    drawerFooter,
  };
};
