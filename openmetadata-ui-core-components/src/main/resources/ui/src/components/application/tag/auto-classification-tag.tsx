/*
 *  Copyright 2026 Collate.
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
import { cx } from '@/utils/cx';
import { CSSProperties, FC, MouseEvent } from 'react';
import { AutomatedTag } from '../../../icons/AutomatedTag';
import { Badge, BadgeWithButton } from '../../base/badges/badges';
import { TagChipContent } from './tag-chip-content';
import {
  AUTO_CLASSIFICATION_TAG_COLOR,
  DEFAULT_TAG_MAX_WIDTH,
  ICON_PX,
} from './tag.constants';
import { EntityTagProps } from './tag.types';

/**
 * Brand-colored chip for auto-classified (LabelType.Generated) tags.
 * Visually distinct from manually applied classification tags — uses
 * the utility-brand palette with an AutomatedTag icon. Sizing/typography
 * matches ClassificationTag and its siblings via SIZE_CLASS/ICON_PX. The
 * close-icon tint is computed in CSS via color-mix() off the --tag-color
 * custom property — see styles/globals.css. Has no `color`/`icon` props: the
 * brand identity and icon are fixed, unlike the other four tag variants.
 */
export const AutoClassificationTag: FC<
  Omit<EntityTagProps, 'color' | 'icon'>
> = ({
  label,
  size = 'sm',
  onDelete,
  href,
  maxWidth = DEFAULT_TAG_MAX_WIDTH,
  disabled,
  className,
  tooltip,
  closeButtonTestId,
  ...otherProps
}) => {
  const tagColorStyle = {
    '--tag-color': AUTO_CLASSIFICATION_TAG_COLOR,
  } as CSSProperties;

  const content = (
    <TagChipContent
      defaultIcon={
        <AutomatedTag
          className="tw:shrink-0"
          height={ICON_PX[size]}
          width={ICON_PX[size]}
        />
      }
      iconSize={ICON_PX[size]}
      label={label}
      maxWidth={maxWidth}
    />
  );

  const sharedProps = {
    ...otherProps,
    className: cx(
      'tw:cursor-pointer ',
      disabled && 'tw:cursor-not-allowed tw:opacity-50',
      className
    ),
    color: 'brand' as const,
    size,
    tooltip,
    type: 'color' as const,
  };

  if (onDelete) {
    return (
      <BadgeWithButton
        {...sharedProps}
        buttonTestId={closeButtonTestId}
        className={cx(sharedProps.className, 'tag-tinted__close-icon')}
        isDisabled={disabled}
        style={tagColorStyle}
        onButtonClick={(e: MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation();
          onDelete(e.nativeEvent);
        }}>
        {content}
      </BadgeWithButton>
    );
  }

  return (
    <Badge {...sharedProps} href={href}>
      {content}
    </Badge>
  );
};
