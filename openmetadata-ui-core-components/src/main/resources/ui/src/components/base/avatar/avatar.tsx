import { cx } from '@/utils/cx';
import { User01 } from '@untitledui/icons';
import { type CSSProperties, type FC, type ReactNode, useState } from 'react';
import { AvatarOnlineIndicator, VerifiedTick } from './base-components';
import { getAvatarColorClasses } from './utils';

type AvatarSize = 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface AvatarProps {
  size?: AvatarSize;
  className?: string;
  src?: string | null;
  alt?: string;
  /**
   * Display a contrast border around the avatar.
   */
  contrastBorder?: boolean;
  /**
   * Display a badge (i.e. company logo).
   */
  badge?: ReactNode;
  /**
   * Display a status indicator.
   */
  status?: 'online' | 'offline';
  /**
   * Display a verified tick icon.
   *
   * @default false
   */
  verified?: boolean;

  /**
   * The initials of the user to display if no image is available.
   */
  initials?: string;
  /**
   * How initials are colored when no image is available:
   * - `auto` (default): a consistent tinted `utility-*` color derived from the
   *   name (`alt` ?? `initials`) that adapts to light/dark.
   * - `solid`: a solid `utility-*` fill with white initials.
   * - `neutral`: the plain gray surface with muted initials (e.g. the "+N"
   *   overflow bubble).
   *
   * @default 'auto'
   */
  colorVariant?: 'auto' | 'solid' | 'neutral';
  /**
   * An icon to display if no image is available.
   */
  placeholderIcon?: FC<{ className?: string }>;
  /**
   * A placeholder to display if no image is available.
   */
  placeholder?: ReactNode;

  /**
   * Whether the avatar should show a focus ring when the parent group is in focus.
   * For example, when the avatar is wrapped inside a link.
   *
   * @default false
   */
  focusable?: boolean;
  style?: CSSProperties;
  'data-testid'?: string;
}

const styles = {
  xxs: {
    root: 'tw:size-4 tw:outline-[0.5px] tw:-outline-offset-[0.5px]',
    initials: 'tw:text-[8px] tw:font-semibold',
    icon: 'tw:size-3',
  },
  xs: {
    root: 'tw:size-6 tw:outline-[0.5px] tw:-outline-offset-[0.5px]',
    initials: 'tw:text-[10px] tw:font-semibold',
    icon: 'tw:size-4',
  },
  sm: {
    root: 'tw:size-8 tw:outline-[0.75px] tw:-outline-offset-[0.75px]',
    initials: 'tw:text-sm tw:font-semibold',
    icon: 'tw:size-5',
  },
  md: {
    root: 'tw:size-10 tw:outline-1 tw:-outline-offset-1',
    initials: 'tw:text-md tw:font-semibold',
    icon: 'tw:size-6',
  },
  lg: {
    root: 'tw:size-12 tw:outline-1 tw:-outline-offset-1',
    initials: 'tw:text-lg tw:font-semibold',
    icon: 'tw:size-7',
  },
  xl: {
    root: 'tw:size-14 tw:outline-1 tw:-outline-offset-1',
    initials: 'tw:text-xl tw:font-semibold',
    icon: 'tw:size-8',
  },
  '2xl': {
    root: 'tw:size-16 tw:outline-1 tw:-outline-offset-1',
    initials: 'tw:text-display-xs tw:font-semibold',
    icon: 'tw:size-8',
  },
};

export const Avatar = ({
  contrastBorder = true,
  size = 'md',
  src,
  alt,
  initials,
  colorVariant = 'auto',
  placeholder,
  placeholderIcon: PlaceholderIcon,
  badge,
  status,
  verified,
  focusable = false,
  className,
  style,
  'data-testid': dataTestId,
}: AvatarProps) => {
  const [isFailed, setIsFailed] = useState(false);

  // Normalize an unknown `size` (e.g. a stray numeric value from an untyped
  // caller) to `md` once, so every size-keyed consumer below — the styles
  // lookup and the badge sub-components — degrades safely instead of crashing
  // on `.root`.
  const resolvedSize: AvatarSize = size in styles ? size : 'md';
  const sizeStyles = styles[resolvedSize];

  // Color the initials only when we actually fall back to them (no usable
  // image). `auto`/`solid` derive a theme-adapting utility color from the name;
  // `neutral` keeps the plain gray surface.
  const showingInitials = Boolean(initials) && !(src && !isFailed);
  const initialsColor =
    showingInitials && colorVariant !== 'neutral'
      ? getAvatarColorClasses(
          alt || initials || '',
          colorVariant === 'solid' ? 'solid' : 'outlined'
        )
      : undefined;

  const renderMainContent = () => {
    if (src && !isFailed) {
      return (
        <img
          data-avatar-img
          alt={alt}
          className="tw:size-full tw:rounded-full tw:object-cover"
          src={src}
          onError={() => setIsFailed(true)}
        />
      );
    }

    if (initials) {
      return (
        // Color is inherited from the root (see className above) so a caller can
        // override it; the span only carries sizing.
        <span className={cx('tw:text-current', sizeStyles.initials)}>
          {initials}
        </span>
      );
    }

    if (PlaceholderIcon) {
      return (
        <PlaceholderIcon className={cx('tw:text-current', sizeStyles.icon)} />
      );
    }

    return (
      placeholder || (
        <User01 className={cx('tw:text-fg-quaternary', sizeStyles.icon)} />
      )
    );
  };

  const renderBadgeContent = () => {
    if (status) {
      return (
        <AvatarOnlineIndicator
          size={resolvedSize === 'xxs' ? 'xs' : resolvedSize}
          status={status}
        />
      );
    }

    if (verified) {
      return (
        <VerifiedTick
          className={cx(
            'tw:absolute tw:right-0 tw:bottom-0',
            (resolvedSize === 'xxs' || resolvedSize === 'xs') &&
              'tw:-right-px tw:-bottom-px'
          )}
          size={resolvedSize === 'xxs' ? 'xs' : resolvedSize}
        />
      );
    }

    return badge;
  };

  return (
    <div
      data-avatar
      className={cx(
        'tw:relative tw:inline-flex tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:outline-transparent',
        // Colored initials bring their own tinted surface (+ border for the
        // outlined variant); otherwise fall back to the neutral gray surface.
        initialsColor ? initialsColor.container : 'tw:bg-tertiary',
        // Initials text color lives on the root (the span inherits it) so a
        // caller's `className` — applied last — can still override it.
        showingInitials && (initialsColor?.text ?? 'tw:text-quaternary'),
        // Focus styles
        focusable &&
          'tw:group-outline-focus-ring tw:group-focus-visible:outline-2 tw:group-focus-visible:outline-offset-2',
        // Honor the contrast outline regardless of the initials color treatment
        // — AvatarGroup relies on it to separate negatively-overlapped avatars.
        contrastBorder && 'tw:outline tw:outline-avatar-contrast-border',
        sizeStyles.root,
        className
      )}
      data-testid={dataTestId}
      style={style}>
      {renderMainContent()}
      {renderBadgeContent()}
    </div>
  );
};
