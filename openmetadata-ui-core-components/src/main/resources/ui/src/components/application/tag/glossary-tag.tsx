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
import { GlossaryTerm } from '../../../icons/GlossaryTerm';
import { Badge, BadgeWithButton } from '../../base/badges/badges';
import { TagChipContent } from './tag-chip-content';
import {
  DEFAULT_TAG_COLOR,
  DEFAULT_TAG_MAX_WIDTH,
  ICON_PX,
} from './tag.constants';
import { EntityTagProps } from './tag.types';

/**
 * Glossary term tag — fully rounded pill with tinted background and border.
 * Default icon: GlossaryTerm (book). Color defaults to DEFAULT_TAG_COLOR. Tint colors
 * (border/background/text/close-icon) are computed in CSS via color-mix() off
 * the --tag-color custom property — see styles/globals.css.
 */
export const GlossaryTag: FC<EntityTagProps> = ({
  label,
  color,
  icon,
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
  const resolvedColor = color ?? DEFAULT_TAG_COLOR;
  const tagColorStyle = { '--tag-color': resolvedColor } as CSSProperties;

  const content = (
    <TagChipContent
      defaultIcon={
        <GlossaryTerm
          className="tag-color-text"
          height={ICON_PX[size]}
          width={ICON_PX[size]}
        />
      }
      icon={icon}
      iconSize={ICON_PX[size]}
      iconTestId="glossary-icon"
      label={label}
      labelClassName={cx('tag-color-text')}
      maxWidth={maxWidth}
    />
  );

  const sharedProps = {
    ...otherProps,
    className: cx(
      'tag-tinted',
      disabled && 'tw:cursor-not-allowed tw:opacity-50',
      className
    ),
    color: 'gray' as const,
    size,
    tooltip,
    type: 'pill-color' as const,
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
    <Badge
      {...sharedProps}
      href={disabled ? undefined : href}
      style={tagColorStyle}>
      {content}
    </Badge>
  );
};
