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

import { Badge, BadgeWithButton } from '@openmetadata/ui-core-components';
import { ReactComponent as DefaultIcon } from '../../../../assets/svg/classification.svg';
import classNames from 'classnames';
import { CSSProperties, FC, MouseEvent, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../Icon/Icon';
import { BaseTagProps, DEFAULT_TAG_COLOR } from './Tag.interface';
import {
  computeTagColors,
  ICON_PX,
  SIZE_INLINE,
} from './Tag.utils';

/**
 * Classification tag chip — rounded-md badge with tinted background and border.
 * Default icon: Tag (classification). Color defaults to #5D6B98.
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
  ...otherProps
}) => {
  const resolvedColor = color ?? DEFAULT_TAG_COLOR;
  const resolved = useMemo(() => computeTagColors(resolvedColor), [resolvedColor]);

  const inlineStyle: CSSProperties = useMemo(
    () => ({
      ...SIZE_INLINE[size],
      borderStyle: 'solid',
      borderWidth: '1px',
      borderColor: resolved.border,
      backgroundColor: resolved.bg,
      outline: 'none',
    }),
    [size, resolved.border, resolved.bg]
  );

  const iconNode = icon ? (
    <Icon iconValue={icon} imageStyle={{ color: resolvedColor }} size={ICON_PX[size]} />
  ) : (
    <DefaultIcon
      height={ICON_PX[size]}
      style={{ color: resolvedColor }}
      width={ICON_PX[size]}
    />
  );

  const labelNode = (
    <div style={{ maxWidth }}>
      <span
        className="tw:truncate"
        style={{
          color: resolvedColor,
          fontSize: SIZE_INLINE[size].fontSize,
          fontWeight: 400,
        }}>
        {label}
      </span>
    </div>
  );

  const content = (
    <>
      <span
        aria-hidden
        className="tw:mr-1 tw:inline-flex tw:shrink-0 tw:items-center">
        {iconNode}
      </span>
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

  const sharedProps = {
    className: classNames(
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
        className={classNames(
          sharedProps.className,
          'tw:[&_button]:text-[var(--tag-close-color)]'
        )}
        isDisabled={disabled}
        style={
          { ...inlineStyle, '--tag-close-color': resolved.closeIcon } as CSSProperties
        }
        onButtonClick={(e: MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation();
          onDelete(e.nativeEvent);
        }}>
        {content}
      </BadgeWithButton>
    );
  }

  return (
    <Badge {...sharedProps} style={inlineStyle}>
      {content}
    </Badge>
  );
};

export default ClassificationTag;
