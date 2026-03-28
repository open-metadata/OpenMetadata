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

import { Tooltip, TooltipTrigger } from '@/components/base/tooltip/tooltip';
import { cx } from '@/utils/cx';
import type { ElementType, HTMLAttributes, ReactNode, Ref } from 'react';

const lineClampClasses: Record<number, string> = {
  1: 'tw:line-clamp-1',
  2: 'tw:line-clamp-2',
  3: 'tw:line-clamp-3',
  4: 'tw:line-clamp-4',
  5: 'tw:line-clamp-5',
  6: 'tw:line-clamp-6',
  7: 'tw:line-clamp-7',
  8: 'tw:line-clamp-8',
  9: 'tw:line-clamp-9',
  10: 'tw:line-clamp-10',
};

type TypographyQuoteVariant = 'default' | 'centered-quote' | 'minimal-quote';

type TypographySize =
  | 'text-xs'
  | 'text-sm'
  | 'text-md'
  | 'text-lg'
  | 'text-xl'
  | 'display-xs'
  | 'display-sm'
  | 'display-md'
  | 'display-lg'
  | 'display-xl'
  | 'display-2xl';

type TypographyWeight = 'regular' | 'medium' | 'semibold' | 'bold';

type EllipsisRows = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

type TypographyEllipsis =
  | boolean
  | {
      rows?: EllipsisRows;
      tooltip?: ReactNode;
    };

interface TypographyProps extends HTMLAttributes<HTMLElement> {
  ref?: Ref<HTMLElement>;
  children?: ReactNode;
  as?: ElementType;
  quoteVariant?: TypographyQuoteVariant;
  className?: string;
  size?: TypographySize;
  weight?: TypographyWeight;
  ellipsis?: TypographyEllipsis;
}

const quoteStyles: Record<TypographyQuoteVariant, string> = {
  default: '',
  'centered-quote': 'prose-centered-quote',
  'minimal-quote': 'prose-minimal-quote',
};

const sizeClasses: Record<TypographySize, string> = {
  'text-xs': 'tw:text-xs',
  'text-sm': 'tw:text-sm',
  'text-md': 'tw:text-md',
  'text-lg': 'tw:text-lg',
  'text-xl': 'tw:text-xl',
  'display-xs': 'tw:text-display-xs',
  'display-sm': 'tw:text-display-sm',
  'display-md': 'tw:text-display-md',
  'display-lg': 'tw:text-display-lg',
  'display-xl': 'tw:text-display-xl',
  'display-2xl': 'tw:text-display-2xl',
};

const weightClasses: Record<TypographyWeight, string> = {
  regular: 'tw:font-normal',
  medium: 'tw:font-medium',
  semibold: 'tw:font-semibold',
  bold: 'tw:font-bold',
};

export const Typography = (props: TypographyProps) => {
  const {
    as: Component = 'span',
    quoteVariant = 'default',
    className,
    children,
    size,
    weight,
    ellipsis,
    style,
    ...otherProps
  } = props;

  const sizeClass = size ? sizeClasses[size] : undefined;
  const weightClass = weight ? weightClasses[weight] : undefined;

  const ellipsisConfig = typeof ellipsis === 'object' ? ellipsis : undefined;
  const isEllipsis = !!ellipsis;
  const ellipsisRows = ellipsisConfig?.rows ?? 1;
  const ellipsisTooltip = ellipsisConfig?.tooltip;

  const getEllipsisClassName = () => {
    if (ellipsisRows <= 1) {
      return 'tw:truncate';
    }

    return lineClampClasses[ellipsisRows];
  };

  const ellipsisClassName = isEllipsis ? getEllipsisClassName() : undefined;

  const innerClassName = cx(
    sizeClass,
    weightClass,
    className,
    ellipsisClassName
  );

  if (ellipsisTooltip) {
    return (
      <Tooltip title={ellipsisTooltip}>
        <TooltipTrigger className="tw:block tw:w-full tw:min-w-0">
          <div className={cx('prose', quoteStyles[quoteVariant])}>
            <Component {...otherProps} className={innerClassName} style={style}>
              {children}
            </Component>
          </div>
        </TooltipTrigger>
      </Tooltip>
    );
  }

  return (
    <div className={cx('prose', quoteStyles[quoteVariant])}>
      <Component {...otherProps} className={innerClassName} style={style}>
        {children}
      </Component>
    </div>
  );
};

export type {
  TypographyEllipsis,
  TypographyProps,
  TypographyQuoteVariant,
  TypographySize,
  TypographyWeight,
};
