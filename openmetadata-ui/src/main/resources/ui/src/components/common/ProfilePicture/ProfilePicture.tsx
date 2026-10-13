/*
 *  Copyright 2022 Collate.
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

import { Avatar } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { parseInt } from 'lodash';
import { ComponentProps, CSSProperties, useMemo, type ReactNode } from 'react';
import { ReactComponent as IconTeams } from '../../../assets/svg/common/teams.svg';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../enums/permissions.enum';
import { User } from '../../../generated/entity/teams/user';
import { useUserProfile } from '../../../hooks/user-profile/useUserProfile';
import { getRandomColor } from '../../../utils/ColorUtils';
import { userPermissions } from '../../../utils/PermissionsUtils';
import Loader from '../Loader/Loader';

type UserData = Pick<User, 'name' | 'displayName'>;

type CoreAvatarSize = NonNullable<ComponentProps<typeof Avatar>['size']>;

// Maps numeric pixel width to the closest core-components Avatar size.
const WIDTH_TO_SIZE: Partial<Record<number, CoreAvatarSize>> = {
  16: 'xxs',
  18: 'xxs',
  20: 'xs',
  24: 'xs',
  28: 'xs',
  32: 'sm',
  36: 'sm',
  40: 'md',
  48: 'lg',
  56: 'xl',
  64: '2xl',
  80: '2xl',
};

const SMALL_LOADER_SIZES: CoreAvatarSize[] = ['xxs', 'xs'];

// Resolve the effective Avatar size: prefer the defined `size`, otherwise map
// the legacy numeric `width` to the nearest defined size (default `sm`).
function resolveAvatarSize(
  size: CoreAvatarSize | undefined,
  width: string | undefined
): CoreAvatarSize {
  if (size) {
    return size;
  }

  return WIDTH_TO_SIZE[parseInt(width ?? '') || 36] ?? 'sm';
}

function getLoaderPlaceholder(
  isLoading: boolean,
  size: CoreAvatarSize,
  isSolid: boolean
): ReactNode | undefined {
  if (!isLoading) {
    return undefined;
  }

  return (
    <Loader
      size={SMALL_LOADER_SIZES.includes(size) ? 'x-small' : 'small'}
      type={isSolid ? 'white' : 'default'}
    />
  );
}

// The outlined avatar is a pale 92%-light tint, which glares on a dark
// surface, and inline styles cannot change with the theme. So the hue travels
// as a CSS variable and these classes pick the lightness per theme: light
// reproduces the original HSL exactly, dark uses a deep tint with a light
// glyph. Dark also draws the ring in the fill's hue; the core Avatar would
// otherwise tint it from the initial, mismatching the fill.
const OUTLINED_AVATAR_CLASSES = [
  'tw:bg-[hsl(var(--avatar-hue)_100%_92%)]',
  'tw:text-[hsl(var(--avatar-hue)_70%_40%)]',
  'tw:dark:bg-[hsl(var(--avatar-hue)_40%_22%)]',
  'tw:dark:text-[hsl(var(--avatar-hue)_85%_78%)]',
  'tw:dark:border-[hsl(var(--avatar-hue)_45%_38%)]',
].join(' ');
const MATCHED_RING_CLASS = 'tw:border-[hsl(var(--avatar-hue)_70%_80%)]';

function getAvatarClassName(
  isSolid: boolean,
  matchRingToFill: boolean,
  className: string
): string {
  return classNames(
    !isSolid && OUTLINED_AVATAR_CLASSES,
    !isSolid && matchRingToFill && MATCHED_RING_CLASS,
    className
  );
}

function getAvatarStyle(
  isSolid: boolean,
  hue: number,
  color: string
): CSSProperties {
  return isSolid
    ? { backgroundColor: color, color: '#fff' }
    : ({ '--avatar-hue': hue } as CSSProperties);
}

// How the avatar is edged. The outlined look draws a contrast outline and a
// tinted border; a borderless avatar takes the neutral variant, which has no
// border, while its fill and text colors still come from the hue classes.
function getAvatarEdge(
  isSolid: boolean,
  borderless: boolean,
  matchRingToFill: boolean
) {
  return {
    colorVariant: borderless ? ('neutral' as const) : undefined,
    contrastBorder: !isSolid && !borderless,
    matchRingToFill: matchRingToFill && !borderless,
  };
}

interface Props extends UserData {
  /**
   * Preferred: a defined core Avatar size (`xxs`…`2xl`). Takes precedence over
   * the legacy numeric `width`.
   */
  size?: CoreAvatarSize;
  /**
   * @deprecated Pass a defined `size` instead. Numeric pixel width, mapped to
   * the nearest defined size for backward compatibility.
   */
  width?: string;
  className?: string;
  height?: string;
  isTeam?: boolean;
  avatarType?: 'solid' | 'outlined';
  /**
   * Draw the ring in the fill's hue. The core Avatar otherwise tints the ring
   * from the initial alone, so e.g. a blue fill can get a pink ring.
   */
  matchRingToFill?: boolean;
  /**
   * A plain filled circle, with neither the contrast outline nor a ring. Wins
   * over `matchRingToFill`.
   */
  borderless?: boolean;
}

const ProfilePicture = ({
  name,
  displayName,
  className = '',
  size,
  width,
  isTeam = false,
  avatarType = 'outlined',
  matchRingToFill = false,
  borderless = false,
}: Props) => {
  const { permissions } = usePermissionProvider();
  const avatarName = displayName ?? name ?? '';
  const avatarSize = resolveAvatarSize(size, width);
  const { hue, color, character } = getRandomColor(avatarName);
  const isSolid = avatarType === 'solid';

  const viewUserPermission = useMemo(() => {
    return userPermissions.hasViewPermissions(ResourceEntity.USER, permissions);
  }, [permissions]);

  const [profileURL, isPicLoading] = useUserProfile({
    permission: viewUserPermission,
    name,
    isTeam,
  });

  const isLoadingWithoutUrl = isPicLoading && !profileURL;
  const edge = getAvatarEdge(isSolid, borderless, matchRingToFill);

  if (isTeam) {
    return (
      <Avatar
        className={className}
        contrastBorder={false}
        data-testid="profile-avatar"
        placeholderIcon={IconTeams}
        size={avatarSize}
        src={profileURL || undefined}
        style={{ backgroundColor: 'transparent' }}
      />
    );
  }

  return (
    <Avatar
      className={getAvatarClassName(isSolid, edge.matchRingToFill, className)}
      colorVariant={edge.colorVariant}
      contrastBorder={edge.contrastBorder}
      data-testid="profile-avatar"
      initials={isLoadingWithoutUrl ? undefined : character}
      placeholder={getLoaderPlaceholder(
        isLoadingWithoutUrl,
        avatarSize,
        isSolid
      )}
      size={avatarSize}
      src={profileURL || undefined}
      style={getAvatarStyle(isSolid, hue, color)}
    />
  );
};

export default ProfilePicture;
