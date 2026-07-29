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
import type { FC, ReactNode } from 'react';
import { useRef } from 'react';
import type { PopoverProps } from 'react-aria-components';
import { Popover } from 'react-aria-components';
import { cx } from '@/utils/cx';
import { useActiveFieldDoc } from './field-doc-context';

// Everything the underlying Popover accepts is forwarded, except the bits this
// component owns: its open behaviour and the field it anchors to.
export interface FieldDocPopoverProps
  extends Omit<
    PopoverProps,
    'children' | 'className' | 'isOpen' | 'isNonModal' | 'triggerRef'
  > {
  /** Extra classes merged onto the card's own styling. */
  className?: string;
  renderDoc?: (doc: string) => ReactNode;
  /** Optional card header (e.g. an icon + "Form Hint"); hidden when omitted. */
  header?: ReactNode;
  /**
   * Distance in px between the popover and the focused field. Consumers tune
   * this to their layout (e.g. to clear a modal's padding). Defaults to 16.
   */
  offset?: number;
  /**
   * Max height in px of the popover card; the doc body scrolls internally
   * beyond it so a long hint never grows to the full page height. Defaults
   * to 480.
   */
  maxHeight?: number;
}

const defaultRenderDoc = (doc: string): ReactNode => (
  <p className="tw:whitespace-pre-wrap tw:text-sm tw:text-secondary">{doc}</p>
);

// CSS.escape is missing in some non-browser/older runtimes; fall back to
// escaping the characters that would break the attribute selector so focusing a
// documented field never throws.
const escapeFieldName = (name: string): string =>
  typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(name)
    : name.replace(/["\\]/g, '\\$&');

export const FieldDocPopover: FC<FieldDocPopoverProps> = ({
  renderDoc,
  header,
  className,
  // Defaulted here rather than in the JSX below: consumers (e.g. HookForm)
  // forward these unconditionally, so an undefined value would otherwise land
  // in the spread and clobber the default.
  offset = 16,
  maxHeight = 480,
  ...popoverProps
}) => {
  const { entry, name } = useActiveFieldDoc();
  const anchorRef = useRef<HTMLElement | null>(null);
  // Re-find the anchor by field name on every render so positioning survives
  // the focused field re-rendering/remounting (e.g. param fields appearing).
  anchorRef.current =
    name && typeof document !== 'undefined'
      ? document.querySelector<HTMLElement>(
          `[data-field-doc="${escapeFieldName(name)}"]`
        )
      : null;

  if (!entry || !anchorRef.current) {
    return null;
  }

  return (
    <Popover
      isNonModal
      isOpen
      className={cx(
        'tw:flex tw:w-75 tw:flex-col tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary tw:bg-primary tw:shadow-lg',
        className
      )}
      placement="right top"
      {...popoverProps}
      // react-aria sets its own inline maxHeight from available space, which
      // overrides any CSS max-h-* class; use the prop so the hint card stays a
      // fixed, bounded height and scrolls internally instead of growing to the
      // full page height.
      maxHeight={maxHeight}
      offset={offset}
      triggerRef={anchorRef}>
      {/* A plain container, not a Dialog — the doc popover must never take
          focus, or it would steal it from the field being edited. */}
      <div
        aria-label="Field documentation"
        className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col"
        role="note">
        {header != null && <div className="tw:px-4 tw:pt-4">{header}</div>}
        {/* Body scrolls within the capped popover height; the header (if any)
            stays pinned so long docs never push the popover off-screen. */}
        <div className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:px-4 tw:pb-4 tw:pt-4">
          <h4 className="tw:text-md tw:font-medium tw:text-primary tw:mb-1">
            {entry.label}
          </h4>
          {(renderDoc ?? defaultRenderDoc)(entry.doc)}
        </div>
      </div>
    </Popover>
  );
};

FieldDocPopover.displayName = 'FieldDocPopover';
