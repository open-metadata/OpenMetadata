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

import { Avatar, AvatarProps, useTheme } from '@mui/material';
import { FC } from 'react';
import {
  getDefaultIconForEntityType,
  ICON_MAP,
} from '../../../utils/IconUtils';

export interface EntityAvatarProps extends AvatarProps {
  entity: {
    name?: string;
    displayName?: string;
    entityType?: string;
    style?: {
      color?: string;
      iconURL?: string;
    };
    parent?: {
      type?: string;
    };
  };
  size?: number;
}

/**
 * A reusable component for rendering entity avatars with custom icons
 * Supports URL-based icons, icon names from ICON_MAP, and default icons
 */
export const EntityAvatar: FC<EntityAvatarProps> = ({
  entity,
  size = 40,
  className = 'entity-avatar',
  sx: customSx,
  alt,
  ...avatarProps
}) => {
  const theme = useTheme();
  const bgColor = entity.style?.color || theme.palette.allShades.brand[600];
  const avatarAlt = alt ?? entity.name ?? entity.displayName;

  // Check if it's a URL (for Avatar src prop)
  const isUrl =
    entity.style?.iconURL &&
    (entity.style.iconURL.startsWith('http') ||
      entity.style.iconURL.startsWith('/'));

  if (isUrl) {
    // For URLs, use Avatar's src prop
    return (
      <Avatar
        alt={avatarAlt}
        className={className}
        src={entity.style?.iconURL}
        sx={[
          {
            width: size,
            height: size,
            backgroundColor: bgColor,
            color: theme.palette.allShades.white,
            '& .MuiAvatar-img': {
              width: size * 0.6,
              height: size * 0.6,
            },
          },
          customSx,
        ]}
        {...avatarProps}
      />
    );
  }

  // For icon names, render the icon component
  const IconComponent = entity.style?.iconURL
    ? ICON_MAP[entity.style.iconURL]
    : null;

  if (IconComponent) {
    return (
      <Avatar
        alt={avatarAlt}
        className={className}
        sx={[
          {
            width: size,
            height: size,
            backgroundColor: bgColor,
            color: theme.palette.allShades.white,
          },
          customSx,
        ]}
        {...avatarProps}>
        <IconComponent size={size * 0.6} style={{ strokeWidth: 1.5 }} />
      </Avatar>
    );
  }

  // Default icons when no iconURL is provided
  const DefaultIcon = getDefaultIconForEntityType(entity.entityType);

  return (
    <Avatar
      alt={avatarAlt}
      className={className}
      sx={[
        {
          width: size,
          height: size,
          backgroundColor: bgColor,
          color: theme.palette.allShades.white,
        },
        customSx,
      ]}
      {...avatarProps}>
      <DefaultIcon size={size * 0.6} style={{ strokeWidth: 1.5 }} />
    </Avatar>
  );
};
