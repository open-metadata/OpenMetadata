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
import type { FC, ReactNode } from 'react';
import { useActiveFieldDoc } from './field-doc-context';

export interface FieldDocPanelProps {
  /** Renders the active doc body. Defaults to preformatted text. */
  renderDoc?: (doc: string) => ReactNode;
  /** Pinned card header (e.g. an icon + "Form Hint"); hidden when omitted. */
  header?: ReactNode;
  /** Shown when no documented field has focus. */
  emptyState?: ReactNode;
}

const defaultRenderDoc = (doc: string): ReactNode => (
  <p className="tw:whitespace-pre-wrap tw:text-sm tw:text-secondary">{doc}</p>
);

/**
 * Renders the focused field's documentation as a static column inside the form
 * surface. The counterpart to FieldDocPopover: same source (the FieldDoc
 * registry), different presentation. Unlike the popover it takes no anchor and
 * does no positioning — it occupies real layout space, so it cannot drift from
 * the surface or track the focused field's vertical position.
 *
 * Must be rendered inside a FieldDocProvider or it will always be empty.
 */
export const FieldDocPanel: FC<FieldDocPanelProps> = ({
  renderDoc,
  header,
  emptyState,
}) => {
  const { entry } = useActiveFieldDoc();

  return (
    <div
      aria-label="Field documentation"
      className="tw:flex tw:h-full tw:min-h-0 tw:flex-col"
      role="note">
      {header != null && <div className="tw:px-4 tw:pt-4">{header}</div>}
      {/* Body scrolls within the column; the header (if any) stays pinned so a
          long doc never pushes it out of view. */}
      <div className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:p-4">
        {entry ? (
          <>
            <h4 className="tw:text-md tw:mb-1 tw:font-medium tw:text-primary">
              {entry.label}
            </h4>
            {(renderDoc ?? defaultRenderDoc)(entry.doc)}
          </>
        ) : (
          <p className="tw:text-sm tw:text-tertiary">{emptyState}</p>
        )}
      </div>
    </div>
  );
};

FieldDocPanel.displayName = 'FieldDocPanel';
