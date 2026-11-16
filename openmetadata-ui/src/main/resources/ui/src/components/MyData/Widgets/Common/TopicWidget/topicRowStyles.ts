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

/**
 * The body of a card that opens on filter chips: the chips sit closer to the
 * header rule than a plain body's content does.
 */
export const TOPIC_FILTERED_BODY_CLASSES = 'tw:pt-3.5';

/** The gap between a card's filter row and the list it filters. */
export const TOPIC_FILTERED_LIST_CLASSES = 'tw:mt-1.5';

/**
 * The hover every topic card's list row shares: a rounded tint behind the row
 * instead of an underline. The row bleeds 8px past the card body on both sides
 * (`-mx-2` + `px-2`) so its content stays aligned with the filters above while
 * the tint gets room around it. `group` lets the row's icon tile react too.
 *
 * `no-underline!`: the global `a:hover` rule is unlayered LESS, which beats a
 * plain Tailwind utility, and an anchor's underline runs through every line of
 * text inside it.
 */
export const TOPIC_ROW_CLASSES =
  'tw:group tw:-mx-2 tw:rounded-lg tw:px-2 tw:no-underline! tw:transition-colors tw:hover:bg-primary_hover';

/**
 * The rule between a list's rows. Not `divide-y` on the list: that is a border
 * on the row, and the row's `rounded-lg` bends it up at both ends. A line
 * drawn by the row's own `::after` stays straight.
 */
export const TOPIC_ROW_DIVIDER_CLASSES =
  'tw:relative tw:not-last:after:absolute tw:not-last:after:inset-x-0 tw:not-last:after:bottom-0 tw:not-last:after:h-px tw:not-last:after:bg-border-secondary';

/** A row's icon tile turns white on hover so it still stands off the tint. */
export const TOPIC_ROW_TILE_CLASSES =
  'tw:transition-colors tw:group-hover:bg-primary';

/** The blue tile the Domains, Data Products and Context Center rows share. */
export const TOPIC_BLUE_TILE_CLASSES =
  'tw:bg-utility-blue-50 tw:text-utility-blue-500';

/**
 * A row whose content holds links of its own (owners) cannot be one big
 * anchor, so its title link is stretched over the row instead: the whole row
 * still opens it, with no anchors nested inside each other. The row needs
 * `relative`; anything inside that must stay clickable sits above on `z-10`.
 *
 * `max-w-full`: the link sits in a column aligned to the start (so the owners
 * beside it do not span the row and swallow its clicks), and a start-aligned
 * item sizes to its content — without the cap a long name never truncates and
 * pushes the card body into a horizontal scroll.
 */
export const TOPIC_ROW_STRETCHED_LINK_CLASSES =
  'tw:min-w-0 tw:max-w-full tw:no-underline! tw:after:absolute tw:after:inset-0 tw:after:rounded-lg';

// The core chip sets its name at 14px; a topic row's secondary line is 12px.
export const TOPIC_ROW_OWNER_NAME_CLASSES =
  'tw:[&_[data-testid=owner-link]]:text-xs tw:[&_[data-testid=owner-link]]:text-tertiary';

// Core's avatar group backs each avatar with an opaque disc so overlaps cut
// cleanly. That disc is a block span sized by the line height, not the avatar,
// so it showed as an oversized white blob; and it is always `bg-surface`, which
// stood out on the row's hover tint. Flex the spans so the disc hugs the
// avatar, and give it the row's hover tint so the cut still matches. The "+N"
// trigger is sized by the line height the same way, so it is flexed too or it
// sits below the avatars. Dark's hover tint is translucent, which cannot cut the
// overlap (the translucent avatars behind would show through), so there the
// disc keeps the opaque card surface.
export const TOPIC_ROW_AVATAR_BACKING_CLASSES =
  'tw:[&_[data-testid=avatar-group-item]]:flex tw:[&_[data-testid=avatar-group-item]_span]:flex ' +
  'tw:[&_[data-testid=avatar-group-overflow]]:flex ' +
  'tw:group-hover:[&_[data-testid=avatar-group-item]]:bg-primary_hover ' +
  'tw:dark:group-hover:[&_[data-testid=avatar-group-item]]:bg-surface';
