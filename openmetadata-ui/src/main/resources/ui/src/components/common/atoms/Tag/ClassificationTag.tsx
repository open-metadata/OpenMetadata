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

import {
  Badge,
  BadgeWithButton,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { Tag } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { CSSProperties, FC, MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../Icon/Icon';
import { DEFAULT_TAG_COLOR, ICON_PX, SIZE_CLASS } from './Tag.constant';
import { BaseTagProps } from './Tag.interface';
import './Tag.style.less';

/**
 * Classification tag chip — rounded-md badge with tinted background and border.
 * Default icon: Tag (classification). Color defaults to DEFAULT_TAG_COLOR. Tint colors
 * (border/background/text/close-icon) are computed in CSS via color-mix() off
 * the --tag-color custom property — see Tag.style.less.
 */
const ClassificationTag: FC<BaseTagProps> = ({
  label,
  color,
  icon,
  size = 'sm',
  onDelete,
  href,
  maxWidth,
  disabled,
  className,
  tooltip,
  closeButtonTestId,
  ...otherProps
}) => {
  const resolvedColor = color ?? DEFAULT_TAG_COLOR;
  const tagColorStyle = { '--tag-color': resolvedColor } as CSSProperties;

  const iconNode = icon ? (
    <Icon
      iconValue={icon}
      imageClassName="tag-color-text"
      size={ICON_PX[size]}
    />
  ) : (
    <Tag
      className="tag-color-text"
      height={ICON_PX[size]}
      width={ICON_PX[size]}
    />
  );

  const labelNode = (
    <div style={{ maxWidth }}>
      <Typography
        ellipsis
        className={classNames(SIZE_CLASS[size], 'tag-color-text')}
        weight="regular">
        {label}
      </Typography>
    </div>
  );

  const innerContent = (
    <>
      {iconNode && (
        <span
          aria-hidden
          className="tw:inline-flex tw:shrink-0 tw:items-center"
          data-testid="classification-icon">
          {iconNode}
        </span>
      )}
      {href ? (
        <Link
          className="tw:no-underline tw:min-w-0"
          data-testid="tag-redirect-link"
          to={href}>
          {labelNode}
        </Link>
      ) : (
        labelNode
      )}
    </>
  );

  const content = tooltip ? (
    <Tooltip delay={500} title={tooltip}>
      <TooltipTrigger className="tw:flex tw:items-center tw:gap-1">
        {innerContent}
      </TooltipTrigger>
    </Tooltip>
  ) : (
    <div className="tw:flex tw:items-center tw:gap-1">{innerContent}</div>
  );

  const sharedProps = {
    className: classNames(
      SIZE_CLASS[size],
      'tag-tinted',
      { 'tw:cursor-not-allowed tw:opacity-50': disabled },
      className
    ),
    color: 'gray' as const,
    'data-testid': otherProps['data-testid'],
    size,
    type: 'color' as const,
  };

  if (onDelete) {
    return (
      <BadgeWithButton
        {...sharedProps}
        buttonTestId={closeButtonTestId}
        className={classNames(sharedProps.className, 'tag-tinted__close-icon')}
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
    <Badge {...sharedProps} style={tagColorStyle}>
      {content}
    </Badge>
  );
};

export default ClassificationTag;
