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

import classNames from 'classnames';
import { FC } from 'react';
import { ReactComponent as FollowStarFilled } from '../../../assets/svg/ic-follow-star-filled.svg';
import { ReactComponent as FollowStarOutline } from '../../../assets/svg/ic-follow-star-outline.svg';
import { FollowStarIconProps } from './FollowStarIcon.interface';

// The SVGs bake in a light brand-50 disc and brand-100 ring; in dark they read
// as a white badge, so retint them to the theme-aware brand scale.
const DARK_RING_CLASS_NAME =
  'tw:dark:[&_g>circle:last-child]:[stroke:var(--color-utility-brand-200)]';
const DARK_OUTLINE_DISC_CLASS_NAME =
  'tw:dark:[&_g>circle:first-child]:[fill:var(--color-utility-brand-50)]';

export const FollowStarIcon: FC<FollowStarIconProps> = ({
  className,
  selected,
}) =>
  selected ? (
    <FollowStarFilled className={classNames(className, DARK_RING_CLASS_NAME)} />
  ) : (
    <FollowStarOutline
      className={classNames(
        className,
        DARK_RING_CLASS_NAME,
        DARK_OUTLINE_DISC_CLASS_NAME
      )}
    />
  );
