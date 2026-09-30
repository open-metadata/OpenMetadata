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
 * The bare type icon in the type's own palette family — shared by the banner,
 * the drawer card and the AI Home widget. `FeaturedIcon` cannot stand in: it
 * covers five colour families and announcements span thirteen. A leaf module on
 * purpose, so importing the chip does not pull the banner, and the cycle it sits
 * in, along with it.
 *
 * The icon used to sit inside a hairline circle. Every type icon is already a
 * ringed glyph, so that read as a second frame around a frame; it is gone and
 * the icon now carries the type colour on its own. The remaining span is a
 * layout-only hook — it holds `shrink-0` so the icon keeps its width in the
 * flex rows all three surfaces put it in, and draws nothing.
 *
 * 16px next to the badge, 20px on the landing banner. Losing the circle is not
 * a reason to grow the glyph: it sits beside 12px label text, and anything
 * larger outweighs the title it is annotating.
 */
const AnnouncementTypeChip = ({
  icon: TypeIcon,
  size = 'sm',
  surface,
}: {
  icon: IconComponentType;
  size?: 'sm' | 'lg';
  surface: { icon: string };
}) => (
  <span
    className="tw:flex tw:shrink-0 tw:items-center"
    data-testid="announcement-type-icon">
    <TypeIcon
      className={classNames(
        size === 'lg' ? 'tw:size-5' : 'tw:size-4',
        surface.icon
      )}
    />
  </span>
);

export default AnnouncementTypeChip;
