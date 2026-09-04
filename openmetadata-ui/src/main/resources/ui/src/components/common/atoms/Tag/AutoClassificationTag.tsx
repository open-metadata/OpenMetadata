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
import classNames from 'classnames';
import { CSSProperties, FC, MouseEvent, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ReactComponent as AutomatedTag } from '../../../../assets/svg/automated-tag.svg';
import { ICON_PX, SIZE_CLASS } from './Tag.constant';
import { AUTO_CLASSIFICATION_TAG_COLOR, BaseTagProps } from './Tag.interface';
import { computeTagColors } from './Tag.utils';

/**
 * Brand-colored chip for auto-classified (LabelType.Generated) tags.
 * Visually distinct from manually applied classification tags — uses
 * the utility-brand palette with an AutomatedTag icon. Sizing/typography
 * matches ClassificationTag and its siblings via SIZE_CLASS/ICON_PX.
 */
const AutoClassificationTag: FC<BaseTagProps> = ({
  label,
  size = 'sm',
  onDelete,
  href,
  maxWidth,
  disabled,
  className,
  tooltip,
  ...otherProps
}) => {
  const resolved = useMemo(
    () => computeTagColors(AUTO_CLASSIFICATION_TAG_COLOR),
    []
  );

  const iconNode = (
    <AutomatedTag
      className="tw:text-utility-brand-900 tw:shrink-0"
      width={ICON_PX[size]}
    />
  );

  const labelNode = (
    <div style={{ maxWidth }}>
      <Typography
        ellipsis
        className={classNames(SIZE_CLASS[size], 'tw:text-utility-brand-900')}
        weight="regular">
        {label}
      </Typography>
    </div>
  );

  const innerContent = (
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
      'tw:cursor-pointer tw:text-utility-brand-700 tw:outline-utility-brand-100 tw:bg-utility-brand-50 hover:tw:bg-utility-brand-50',
      { 'tw:cursor-not-allowed tw:opacity-50': disabled },
      className
    ),
    color: 'brand' as const,
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
          'tw:[&_button]:text-(--tag-close-color)'
        )}
        isDisabled={disabled}
        style={
          {
            '--tag-close-color': resolved.closeIcon,
          } as CSSProperties
        }
        onButtonClick={(e: MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation();
          onDelete(e.nativeEvent);
        }}>
        {content}
      </BadgeWithButton>
    );
  }

  return <Badge {...sharedProps}>{content}</Badge>;
};

export default AutoClassificationTag;
