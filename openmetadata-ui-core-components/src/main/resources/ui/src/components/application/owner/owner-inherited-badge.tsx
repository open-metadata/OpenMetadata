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
import { useCoreTranslation } from '@/i18n/useCoreTranslation';
import { cx } from '@/utils/cx';
import { InheritedBadge } from '../../../icons/InheritedBadge';
import type { AvatarProps } from '../../base/avatar/avatar';

// Same per-size scale as Avatar's VerifiedTick, so the badge stays
// proportional from xxs avatars up to 2xl.
const BADGE_PX: Record<NonNullable<AvatarProps['size']>, number> = {
  xxs: 10,
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  '2xl': 20,
};

export const OwnerInheritedBadge = ({
  size = 'xs',
}: {
  size?: AvatarProps['size'];
}) => {
  const { t } = useCoreTranslation();

  return (
    <InheritedBadge
      aria-hidden={false}
      aria-label={t('label.inherited')}
      className={cx(
        'tw:absolute tw:right-0 tw:bottom-0 tw:text-fg-secondary',
        (size === 'xxs' || size === 'xs') && 'tw:-right-px tw:-bottom-px'
      )}
      data-testid="inherited-owner-icon"
      role="img"
      size={BADGE_PX[size] ?? BADGE_PX.xs}
    />
  );
};
