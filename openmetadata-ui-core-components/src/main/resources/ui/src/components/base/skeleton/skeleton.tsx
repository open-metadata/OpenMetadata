/*
 *  Copyright 2025 Collate.
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
import { CSSProperties, ReactNode } from 'react';
import { cx } from '@/utils/cx';

export type SkeletonVariant = 'text' | 'rectangular' | 'rounded' | 'circular';
export type SkeletonAnimation = 'pulse' | 'wave' | false;

export interface SkeletonProps {
  /**
   * The shape of the skeleton.
   * - `text`: Inline text line with slight rounding. Height defaults to `1.2em`.
   * - `rectangular`: Sharp corners, suitable for card/image placeholders.
   * - `rounded`: Rounded corners, suitable for button/chip placeholders.
   * - `circular`: Fully round, suitable for avatar placeholders.
   * @default "text"
   */
  variant?: SkeletonVariant;
  /**
   * The animation effect applied to the skeleton.
   * - `pulse`: Fades opacity in and out.
   * - `wave`: Horizontal shimmer sweep.
   * - `false`: No animation.
   * @default "pulse"
   */
  animation?: SkeletonAnimation;
  /** Width of the skeleton. Numbers are treated as pixels. */
  width?: number | string;
  /** Height of the skeleton. Numbers are treated as pixels. */
  height?: number | string;
  /** Additional CSS class names. */
  className?: string;
  /** Inline styles merged with computed size styles. */
  style?: CSSProperties;
  /**
   * Optional children whose dimensions are inferred to size the skeleton.
   * Children are rendered invisibly so the skeleton matches their layout.
   */
  children?: ReactNode;
}

const VARIANT_CLASSES: Record<SkeletonVariant, string> = {
  text: 'tw:rounded',
  rectangular: '',
  rounded: 'tw:rounded-md',
  circular: 'tw:rounded-full',
};

export const Skeleton = ({
  variant = 'text',
  animation = 'pulse',
  width,
  height,
  className,
  style,
  children,
}: SkeletonProps) => {
  const computedStyle: CSSProperties = { ...style };

  if (width !== undefined) {
    computedStyle.width = typeof width === 'number' ? `${width}px` : width;
  }

  if (height !== undefined) {
    computedStyle.height = typeof height === 'number' ? `${height}px` : height;
  } else if (variant === 'text') {
    computedStyle.height = '1.2em';
  }

  if (variant === 'circular') {
    if (computedStyle.width && !computedStyle.height) {
      computedStyle.height = computedStyle.width;
    } else if (computedStyle.height && !computedStyle.width) {
      computedStyle.width = computedStyle.height;
    }
  }

  return (
    <span
      aria-hidden="true"
      className={cx(
        'tw:block tw:bg-quaternary',
        VARIANT_CLASSES[variant],
        animation === 'pulse' && 'tw:animate-pulse',
        animation === 'wave' && 'skeleton-wave',
        className
      )}
      style={computedStyle}>
      {children && <span className="tw:invisible">{children}</span>}
    </span>
  );
};
