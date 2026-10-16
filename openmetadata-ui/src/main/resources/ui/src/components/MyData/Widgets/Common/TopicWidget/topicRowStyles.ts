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
  'tw:group tw:-mx-2 tw:rounded-lg tw:px-2 tw:no-underline! tw:transition-colors tw:hover:bg-utility-gray-blue-50';

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
