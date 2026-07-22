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
import { useLayoutEffect, useRef, useState } from 'react';
import { useActiveFieldDoc, useFieldDocRegistry } from './field-doc-context';

export interface FieldDocPanelProps {
  /** Renders the active doc body. Defaults to preformatted text. */
  renderDoc?: (doc: string) => ReactNode;
  /** Pinned card header (e.g. an icon + "Form Hint"); hidden when omitted. */
  header?: ReactNode;
  /**
   * Shown only when the form has no documented fields at all — for example a
   * read-only view that suppresses its docs. A form that has docs opens on the
   * first one (see below), so this is not the normal opening state.
   *
   * Rendered into a `relative`, non-scrolling container that fills the
   * remaining column height, so an `EmptyPlaceholder` can be passed straight in
   * and will centre itself.
   *
   * Pass `width="100%"` to an EmptyPlaceholder here — its 300px default is
   * wider than this column's 260px minimum and would overflow when the column
   * shrinks.
   */
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
 * The last doc stays on screen once focus leaves the documented fields. The
 * registry clears the active field on blur, which is right for the popover
 * (it closes), but this column is always visible: reverting to the empty state
 * every time focus lands on an undocumented control — the description editor,
 * a button, whitespace — would blank the panel out mid-task. Holding the last
 * doc is a presentation choice, so it lives here rather than in the shared
 * registry.
 *
 * Must be rendered inside a FieldDocProvider or it will always be empty.
 */
export const FieldDocPanel: FC<FieldDocPanelProps> = ({
  renderDoc,
  header,
  emptyState,
}) => {
  const { entry } = useActiveFieldDoc();
  const { enabled, entries } = useFieldDocRegistry();
  const rootRef = useRef<HTMLDivElement>(null);
  // A form opens with focus nowhere, so falling back to the empty state would
  // leave the column advertising that hints exist while showing none — at the
  // moment the user has read least. Opening on the first field's doc costs
  // nothing and explains the form's starting point.
  //
  // "First" has to mean first on screen, which is why this reads the DOM rather
  // than taking the head of `entries`. Registration order is not visual order:
  // a form whose docs arrive asynchronously (fetched markdown) registers them
  // after any field holding its doc as a local constant, so the map can open
  // with a field from the bottom of the form.
  const [firstName, setFirstName] = useState<string>();
  // Watch the form for structural changes rather than recomputing per commit
  // or keying off `entries`. Neither of those is right: a form can reorder
  // documented fields it has already mounted — same names, same docs — which
  // leaves the registry untouched while a different field is now first on
  // screen, and re-running on every render is what the exhaustive-deps rule
  // warns about. The DOM is the thing that actually changed, so observe it.
  useLayoutEffect(() => {
    // Climb to whatever encloses this panel and the fields it describes,
    // accepting either a documented field or the form itself: docs can arrive
    // asynchronously, so at mount there may be no `[data-field-doc]` yet, and
    // the panel is exported for use outside a form, where there is no `form`
    // to find. Scoping at all is what stops a second documented form elsewhere
    // on the page from being read.
    const start = rootRef.current?.parentElement ?? null;
    let ancestor = start;
    while (ancestor && !ancestor.querySelector('[data-field-doc], form')) {
      ancestor = ancestor.parentElement;
    }

    const scope = ancestor ?? start;

    if (!scope) {
      return undefined;
    }
    const readFirst = () =>
      setFirstName(
        scope
          .querySelector('[data-field-doc]')
          ?.getAttribute('data-field-doc') ?? undefined
      );

    readFirst();

    // `data-field-doc` is set and cleared on existing elements as docs load,
    // so attributes matter as much as added and removed nodes.
    const observer = new MutationObserver(readFirst);
    observer.observe(scope, {
      attributeFilter: ['data-field-doc'],
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);
  const firstEntry = firstName ? entries.get(firstName) : undefined;
  // Remembering the last entry is idempotent, so writing it during render is
  // safe under StrictMode's double-invoke.
  const lastEntry = useRef(entry);
  if (entry) {
    lastEntry.current = entry;
  }
  // Forget it while docs are switched off. The panel stays mounted (collapsed
  // to zero width) so that toggling never remounts the form, which means a
  // remembered doc would otherwise linger in the DOM while hidden and reappear
  // instead of the empty state when docs are switched back on.
  if (!enabled) {
    lastEntry.current = undefined;
  }
  const shownEntry = enabled
    ? entry ?? lastEntry.current ?? firstEntry
    : undefined;

  return (
    <div
      aria-label="Field documentation"
      className="tw:flex tw:h-full tw:min-h-0 tw:flex-col"
      ref={rootRef}
      role="note">
      {header != null && <div className="tw:px-4 tw:pt-4">{header}</div>}
      {shownEntry ? (
        // Body scrolls within the column; the header (if any) stays pinned so a
        // long doc never pushes it out of view.
        <div className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:p-4">
          <h4 className="tw:text-md tw:mb-1 tw:font-semibold tw:text-primary">
            {shownEntry.label}
          </h4>
          {(renderDoc ?? defaultRenderDoc)(shownEntry.doc)}
        </div>
      ) : (
        // `relative` is required, not cosmetic: EmptyPlaceholder's shell is
        // absolutely positioned and fills its nearest positioned ancestor, so
        // without this it would escape the column and fill the whole modal.
        // Not scrollable — the placeholder centres itself in the space.
        <div className="tw:relative tw:min-h-0 tw:flex-1">{emptyState}</div>
      )}
    </div>
  );
};

FieldDocPanel.displayName = 'FieldDocPanel';
