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

import type { IconComponentType } from '@openmetadata/ui-core-components';
import classNames from 'classnames';

/**
 * The type icon inside a hairline circle, in the type's own palette family —
 * shared by the banner, the drawer card and the AI Home widget. `FeaturedIcon`
 * cannot stand in: it covers five colour families and announcements span
 * thirteen. A leaf module on purpose, so importing the chip does not pull the
 * banner, and the cycle it sits in, along with it.
 */
const AnnouncementTypeChip = ({
  icon: TypeIcon,
  size = 'sm',
  surface,
}: {
  icon: IconComponentType;
  size?: 'sm' | 'lg';
  surface: { border: string; icon: string };
}) => (
  <span
    className={classNames(
      'tw:flex tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:border tw:bg-primary',
      size === 'lg' ? 'tw:size-10' : 'tw:size-7',
      surface.border
    )}>
    <TypeIcon
      className={classNames(
        size === 'lg' ? 'tw:size-5' : 'tw:size-4',
        surface.icon
      )}
    />
  </span>
);

export default AnnouncementTypeChip;
