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
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Cube01,
  Database01,
  Globe01,
  Grid01,
  Home02,
  Menu01,
  Plus,
  SearchLg,
  Tag01,
  Trash01,
  Users01,
  XClose,
} from '@untitledui/icons';
import { ComponentType } from 'react';

// Map of icon names to their components
export const ICON_MAP: Record<
  string,
  ComponentType<{ size?: number; style?: React.CSSProperties }>
> = {
  Cube01: Cube01,
  Home02: Home02,
  Database01: Database01,
  Globe01: Globe01,
  Users01: Users01,
  Tag01: Tag01,
  SearchLg: SearchLg,
  Grid01: Grid01,
  Menu01: Menu01,
  Plus: Plus,
  Trash01: Trash01,
  ChevronRight: ChevronRight,
  ArrowLeft: ArrowLeft,
  ArrowRight: ArrowRight,
  XClose: XClose,
};

interface RenderIconOptions {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
}

/**
 * Utility function to render an icon from either a URL or an icon name
 * @param iconValue - Either a URL string or an icon name from ICON_MAP
 * @param options - Options for rendering the icon
 * @returns React element of the icon or image
 */
export const renderIcon = (
  iconValue: string | undefined,
  options: RenderIconOptions = {}
) => {
  const { size = 24, className = '', style = {}, strokeWidth = 1.5 } = options;

  if (!iconValue) {
    return null;
  }

  // Check if it's a URL (starts with http, https, or /)
  if (iconValue.startsWith('http') || iconValue.startsWith('/')) {
    return (
      <img
        alt="icon"
        className={className}
        src={iconValue}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          ...style,
        }}
      />
    );
  }

  // Check if it's a known icon name
  const IconComponent = ICON_MAP[iconValue];
  if (IconComponent) {
    // Return the icon component directly without wrapper
    return <IconComponent size={size} style={{ strokeWidth, ...style }} />;
  }

  // If not a URL and not a known icon, return null
  return null;
};

/**
 * Get the default icon for an entity type
 * @param entityType - The type of entity
 * @returns The icon component
 */
export const getDefaultIconForEntityType = (entityType?: string) => {
  if (entityType === 'dataProduct') {
    return Cube01;
  }

  return Globe01;
};
