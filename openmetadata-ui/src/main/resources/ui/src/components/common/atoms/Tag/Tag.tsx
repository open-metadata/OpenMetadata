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
  Typography,
  type BadgeColors,
  type BadgeTypes,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import {
  ComponentType,
  CSSProperties,
  FC,
  MouseEvent,
  SVGProps,
  useMemo,
} from 'react';
import { Link } from 'react-router-dom';
import { ReactComponent as ClassificationIcon } from '../../../../assets/svg/classification.svg';
import { ReactComponent as DataProductIcon } from '../../../../assets/svg/ic-data-product.svg';
import { ReactComponent as DomainIcon } from '../../../../assets/svg/ic-domain.svg';
import { ReactComponent as GlossaryIcon } from '../../../../assets/svg/glossary.svg';
import { reduceColorOpacity } from '../../../../utils/ColorUtils';
import { Icon } from '../../Icon/Icon';
import { TagProps, TagSize, TagVariant } from './Tag.interface';

type SVGIconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const ICON_SIZE: Record<TagSize, number> = { sm: 12, md: 14, lg: 16 };

/** Default icon per variant when no `icon` prop is supplied. */
const DEFAULT_VARIANT_ICON: Partial<Record<TagVariant, SVGIconComponent>> = {
  classification: ClassificationIcon,
  glossary: GlossaryIcon,
  tier: ClassificationIcon,
  domain: DomainIcon,
  dataProduct: DataProductIcon,
};

/**
 * Static variants: fixed Badge type + color, no dynamic hex needed.
 * - tier     → modern/gray  (shadowed badge)
 * - glossary → color/gray-blue (solid badge)
 * - pill     → pill-color/gray (fully rounded pill)
 */
const STATIC_VARIANT_CONFIG: Partial<
  Record<TagVariant, { type: BadgeTypes; color: BadgeColors }>
> = {
  tier: { type: 'modern', color: 'gray' },
  glossary: { type: 'color', color: 'gray-blue' },
  pill: { type: 'pill-color', color: 'gray' },
};

/**
 * Badge type for dynamic-colour variants.
 * - classification → pill-color  (fully rounded pill)
 * - domain         → color       (badge shape + 4 px left accent)
 * - dataProduct    → color       (badge shape + 4 px left accent)
 */
const DYNAMIC_VARIANT_TYPE: Partial<Record<TagVariant, BadgeTypes>> = {
  classification: 'pill-color',
  domain: 'color',
  dataProduct: 'color',
};

/**
 * Border-radius that matches the Badge shape for each type.
 * Used on the color wrapper so the border curves align with Badge's corners.
 */
const BORDER_RADIUS: Record<BadgeTypes, string> = {
  'pill-color': '9999px',
  color: '6px',
  modern: '6px',
};

const TagIconSlot: FC<{
  icon?: TagProps['icon'];
  variant: TagVariant;
  size: TagSize;
  color?: string;
}> = ({ icon, variant, size, color }) => {
  const px = ICON_SIZE[size];
  const DefaultIcon = DEFAULT_VARIANT_ICON[variant];
  const iconStyle: CSSProperties | undefined = color ? { color } : undefined;

  if (icon && typeof icon !== 'string') {
    const Comp = icon as SVGIconComponent;

    return <Comp height={px} style={iconStyle} width={px} />;
  }

  if (icon) {
    return (
      <Icon
        fallback={
          DefaultIcon ? (
            <DefaultIcon height={px} style={iconStyle} width={px} />
          ) : null
        }
        iconValue={icon as string}
        size={px}
      />
    );
  }

  if (!DefaultIcon) {
    return null;
  }

  const FallbackIcon = DefaultIcon as SVGIconComponent;

  return <FallbackIcon height={px} style={iconStyle} width={px} />;
};

const Tag: FC<TagProps> = ({
  label,
  color,
  variant = 'classification',
  icon,
  size = 'sm',
  onDelete,
  href,
  showIcon = true,
  maxWidth,
  disabled,
  className,
  ...otherProps
}) => {
  const staticConfig = STATIC_VARIANT_CONFIG[variant];
  const isStaticVariant = Boolean(staticConfig);
  const hasDynamicColor = !isStaticVariant && Boolean(color);
  const hasLeftAccent =
    (variant === 'domain' || variant === 'dataProduct') && hasDynamicColor;

  const badgeType: BadgeTypes = isStaticVariant
    ? staticConfig!.type
    : (DYNAMIC_VARIANT_TYPE[variant] ?? 'pill-color');

  const badgeColor: BadgeColors = isStaticVariant ? staticConfig!.color : 'gray-blue';

  const iconSlot = useMemo(
    () =>
      showIcon ? (
        <TagIconSlot color={color} icon={icon} size={size} variant={variant} />
      ) : null,
    [showIcon, icon, variant, size, color]
  );

  const typographySize =
    size === 'sm' ? ('text-xs' as const) : ('text-sm' as const);

  const labelNode = (
    <Typography
      className="tw:text-inherit tw:min-w-0"
      ellipsis
      size={typographySize}
      weight="regular">
      {label}
    </Typography>
  );

  const content = (
    <>
      {iconSlot && (
        <span
          aria-hidden
          className="tw:mr-1 tw:inline-flex tw:shrink-0 tw:items-center"
          style={hasDynamicColor ? { color } : undefined}>
          {iconSlot}
        </span>
      )}
      {href ? (
        <Link
          className="tw:text-inherit tw:no-underline tw:min-w-0"
          data-testid="tag-redirect-link"
          to={href}>
          {labelNode}
        </Link>
      ) : (
        labelNode
      )}
    </>
  );

  const sharedClassName = classNames(
    { 'tw:cursor-not-allowed tw:opacity-50': disabled },
    className
  );

  // Static variants (tier, glossary, pill): Badge handles everything via Tailwind tokens.
  if (isStaticVariant) {
    if (onDelete) {
      return (
        <BadgeWithButton
          bordered
          className={sharedClassName}
          color={badgeColor}
          data-testid={otherProps['data-testid']}
          isDisabled={disabled}
          size={size}
          type={badgeType}
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
        bordered
        className={sharedClassName}
        color={badgeColor}
        data-testid={otherProps['data-testid']}
        size={size}
        type={badgeType}>
        {content}
      </Badge>
    );
  }

  // Dynamic variants WITHOUT a supplied color: fall back to Badge's gray-blue tokens.
  if (!hasDynamicColor) {
    if (onDelete) {
      return (
        <BadgeWithButton
          bordered
          className={sharedClassName}
          color={badgeColor}
          data-testid={otherProps['data-testid']}
          isDisabled={disabled}
          size={size}
          type={badgeType}
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
        bordered
        className={sharedClassName}
        color={badgeColor}
        data-testid={otherProps['data-testid']}
        size={size}
        type={badgeType}>
        {content}
      </Badge>
    );
  }

  // Dynamic-colour variants WITH a hex color: a thin wrapper provides the
  // border and background via inline styles directly on the wrapper element —
  // no dependency on Badge's style-prop forwarding or the Vite pre-bundle cache.
  const wrapperStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS[badgeType],
    borderStyle: 'solid',
    borderWidth: '1px',
    borderColor: color,
    ...(hasLeftAccent ? { borderLeftWidth: '4px' } : {}),
    backgroundColor: reduceColorOpacity(color!, 0.08),
    color,
    maxWidth,
  };

  if (onDelete) {
    return (
      <span
        aria-disabled={disabled}
        className={classNames(
          { 'tw:cursor-not-allowed tw:opacity-50': disabled },
          className
        )}
        data-testid={otherProps['data-testid']}
        style={wrapperStyle}>
        <BadgeWithButton
          bordered={false}
          className="tw:!bg-transparent tw:!outline-none tw:!shadow-none"
          color={badgeColor}
          data-testid={undefined}
          isDisabled={disabled}
          size={size}
          type={badgeType}
          onButtonClick={(e: MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            onDelete(e.nativeEvent);
          }}>
          {content}
        </BadgeWithButton>
      </span>
    );
  }

  return (
    <span
      aria-disabled={disabled}
      className={classNames(
        { 'tw:cursor-not-allowed tw:opacity-50': disabled },
        className
      )}
      data-testid={otherProps['data-testid']}
      style={wrapperStyle}>
      <Badge
        bordered={false}
        className="tw:!bg-transparent tw:!outline-none"
        color={badgeColor}
        data-testid={undefined}
        size={size}
        type={badgeType}>
        {content}
      </Badge>
    </span>
  );
};

export default Tag;
