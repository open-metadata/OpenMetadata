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
import { Popover } from 'react-aria-components';
import { useActiveFieldDoc } from './field-doc-context';

export interface FieldDocPopoverProps {
  renderDoc?: (doc: string) => ReactNode;
  /** Optional card header (e.g. an icon + "Form Hint"); hidden when omitted. */
  header?: ReactNode;
  /**
   * Distance in px between the popover and the focused field. Consumers tune
   * this to their layout (e.g. to clear a modal's padding). Defaults to 16.
   */
  offset?: number;
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
  offset = 16,
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
      className="tw:w-[300px] tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary tw:bg-primary tw:shadow-lg"
      offset={offset}
      placement="right top"
      triggerRef={anchorRef}>
      {/* A plain container, not a Dialog — the doc popover must never take
          focus, or it would steal it from the field being edited. */}
      <div aria-label="Field documentation" role="note">
        {header != null && <div className="tw:px-4 tw:pt-4">{header}</div>}
        <div className="tw:px-4 tw:pb-4 tw:pt-4">
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
