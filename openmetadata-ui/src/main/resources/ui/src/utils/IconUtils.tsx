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
  Bank,
  BarChart01,
  Browser,
  Calendar,
  ChevronRight,
  CloudLightning,
  Code01,
  CreditCard01,
  Cube01,
  Database01,
  Dataflow04,
  File01,
  FileSearch01,
  Folder,
  Globe01,
  GoogleChrome,
  Grid01,
  Home02,
  Image01,
  Laptop01,
  Link01,
  Lock01,
  Mail01,
  Menu01,
  NavigationPointer01,
  Passport,
  Plus,
  Rss01,
  SearchLg,
  Server05,
  Shield01,
  ShoppingBag01,
  Speaker01,
  Tag01,
  Trash01,
  Upload01,
  UserEdit,
  Users01,
  XClose,
} from '@untitledui/icons';
import { ComponentType, FC } from 'react';

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
  Bank: Bank,
  ShoppingBag01: ShoppingBag01,
  Passport: Passport,
  Speaker01: Speaker01,
  Dataflow04: Dataflow04,
  Image01: Image01,
  Server05: Server05,
  CreditCard01: CreditCard01,
  Laptop01: Laptop01,
  Mail01: Mail01,
  Code01: Code01,
  Shield01: Shield01,
  Lock01: Lock01,
  Folder: Folder,
  FileSearch01: FileSearch01,
  GoogleChrome: GoogleChrome,
  Link01: Link01,
  Upload01: Upload01,
  CloudLightning: CloudLightning,
  NavigationPointer01: NavigationPointer01,
  BarChart01: BarChart01,
  File01: File01,
  UserEdit: UserEdit,
  Rss01: Rss01,
  Browser: Browser,
  Calendar: Calendar,
};

/**
 * Creates an icon component with custom stroke width
 * @param IconComponent - The icon component from @untitledui/icons
 * @param strokeWidth - Custom stroke width (default icons use 2)
 * @returns Wrapped icon component with custom stroke width
 */
export const createIconWithStroke = (
  IconComponent: ComponentType<{
    size?: number;
    strokeWidth?: number;
    style?: React.CSSProperties;
  }>,
  strokeWidth: number
) => {
  return (props: { size?: number; style?: React.CSSProperties }) => (
    <IconComponent {...props} strokeWidth={strokeWidth} />
  );
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
export const getDefaultIconForEntityType = (entityType?: string): FC => {
  if (entityType === 'dataProduct') {
    return Cube01;
  }

  return Globe01;
};
