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

import {
  Box,
  FeaturedIcon,
  SlideoutMenu,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { FC, ReactNode, useMemo } from 'react';

export interface DrawerHeaderConfig {
  title?: string | ReactNode;
  /** Secondary line under the title. */
  subtitle?: ReactNode;
  /** Glyph shown in a featured icon before the title. */
  icon?: FC<{ className?: string }>;
  showCloseButton?: boolean;
  onClose?: () => void;
  actions?: ReactNode;
  className?: string;
}

export const useDrawerHeader = (config: DrawerHeaderConfig = {}) => {
  const {
    title,
    subtitle,
    icon,
    showCloseButton = true,
    onClose,
    actions,
    className,
  } = config;

  const drawerHeader = useMemo(() => {
    const titleNode =
      typeof title === 'string' ? (
        <Typography
          as="h4"
          data-testid="form-heading"
          size="text-md"
          weight="medium">
          {title}
        </Typography>
      ) : (
        title
      );

    return (
      // Flex row keeps actions beside the title; the top margin (not padding)
      // centres the close button on it. A caller's className overrides these.
      <SlideoutMenu.Header
        className={classNames(
          'tw:flex tw:items-center tw:gap-4 tw:mt-6 tw:pt-0',
          className
        )}
        onClose={showCloseButton ? onClose : undefined}>
        <div
          className={
            icon
              ? 'tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:gap-3'
              : 'tw:flex tw:items-center tw:gap-2 tw:flex-1'
          }>
          {icon && (
            <FeaturedIcon
              color="gray"
              icon={icon}
              radius="md"
              shape="square"
              size="md"
              theme="light"
            />
          )}
          {subtitle ? (
            <Box className="tw:min-w-0" direction="col">
              {titleNode}
              <Typography className="tw:text-tertiary" size="text-sm">
                {subtitle}
              </Typography>
            </Box>
          ) : (
            titleNode
          )}
        </div>
        {actions && (
          <div className="tw:flex tw:items-center tw:gap-1">{actions}</div>
        )}
      </SlideoutMenu.Header>
    );
  }, [title, subtitle, icon, showCloseButton, onClose, actions, className]);

  return {
    drawerHeader,
  };
};
