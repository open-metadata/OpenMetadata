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
import { DotsGrid } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import {
  LayoutDragHandleProps,
  LayoutDropIndicatorProps,
} from './LayoutDragParts.interface';

// Insertion line in the gap: beside half-width items (they share a row),
// above or below full-width items (they stack).
const DROP_INDICATOR_CLASS = {
  half: {
    before: 'tw:inset-y-0 tw:-left-1.5 tw:w-0.5',
    after: 'tw:inset-y-0 tw:-right-1.5 tw:w-0.5',
  },
  full: {
    before: 'tw:inset-x-0 tw:-top-1.5 tw:h-0.5',
    after: 'tw:inset-x-0 tw:-bottom-1.5 tw:h-0.5',
  },
} as const;

/** Line where a dragged item lands; its parent must be `tw:relative`. */
export const LayoutDropIndicator = ({
  width,
  side,
}: LayoutDropIndicatorProps) => (
  <span
    aria-hidden
    className={classNames(
      'tw:pointer-events-none tw:absolute tw:rounded-full tw:bg-brand-solid',
      DROP_INDICATOR_CLASS[width][side]
    )}
    data-testid="layout-drop-indicator"
  />
);

/**
 * Pointer-only drag handle: reordering has no keyboard path, so the handle is
 * hidden from assistive tech rather than exposed as a control that does nothing.
 */
export const LayoutDragHandle = ({
  dataTestId,
  isBordered = false,
  isDisabled = false,
  handleRef,
}: LayoutDragHandleProps) => (
  <span
    aria-hidden
    className={classNames(
      'tw:flex tw:shrink-0 tw:rounded-md tw:text-fg-quaternary',
      isBordered ? 'tw:border tw:border-secondary tw:p-1.5' : 'tw:p-1',
      isDisabled
        ? 'tw:cursor-not-allowed'
        : 'tw:cursor-grab tw:hover:bg-secondary tw:hover:text-fg-secondary tw:active:cursor-grabbing'
    )}
    data-testid={dataTestId}
    ref={handleRef}>
    <DotsGrid className="tw:size-4" />
  </span>
);
