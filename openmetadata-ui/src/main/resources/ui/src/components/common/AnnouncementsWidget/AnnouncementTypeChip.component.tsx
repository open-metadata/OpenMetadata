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

import { Box, type IconComponentType } from '@openmetadata/ui-core-components';
import classNames from 'classnames';

/**
 * The bare type icon in the type's own palette family — shared by the banner,
 * the drawer card and the AI Home widget. A leaf module on purpose, so importing
 * the chip does not pull the banner, and the cycle it sits in, along with it.
 *
 * Not a `Badge`, and none of core's badge variants can stand in for it:
 *
 * - `BadgeIcon` paints `filledColors[color].root`, whose `50` fill is the same
 *   token the banner and the drawer card already use as their surface. The fill
 *   therefore disappears and only its `200` outline shows — a hairline circle
 *   around a glyph that is already a ringed circle, which is the frame-around-a-
 *   frame this design deliberately dropped. It also takes no `className`, so
 *   there is nothing to lift the fill with the way `TypeBadge` does.
 * - `BadgeWithIcon` requires `children`, so it would fold the icon into the type
 *   label's pill rather than standing beside it.
 * - Both hard-code the glyph at `tw:size-3`, losing the two sizes below.
 * - `FeaturedIcon` covers five colour families; announcements span thirteen.
 *
 * 16px next to the badge, 20px on the landing banner — it sits beside 12px label
 * text, and anything larger outweighs the title it is annotating. `Box` is here
 * only to hold `shrink-0`, so the icon keeps its width in the flex rows all
 * three surfaces put it in; it draws nothing.
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
  <Box
    align="center"
    className="tw:shrink-0"
    data-testid="announcement-type-icon">
    <TypeIcon
      className={classNames(
        size === 'lg' ? 'tw:size-5' : 'tw:size-4',
        surface.icon
      )}
    />
  </Box>
);

export default AnnouncementTypeChip;
