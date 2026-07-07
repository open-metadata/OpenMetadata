import type { FC, ReactNode } from 'react';
import { useRef } from 'react';
import { Dialog, Popover } from 'react-aria-components';
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
      ? document.querySelector<HTMLElement>(`[data-field-doc="${CSS.escape(name)}"]`)
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
      <Dialog aria-label="Field documentation" className="tw:outline-none">
        {header != null && (
          <div className="tw:border-b tw:border-secondary tw:px-4 tw:py-3">
            {header}
          </div>
        )}
        <div className="tw:px-4 tw:py-3">
          <h4 className="tw:text-sm tw:font-semibold tw:text-primary tw:mb-1">
            {entry.label}
          </h4>
          {(renderDoc ?? defaultRenderDoc)(entry.doc)}
        </div>
      </Dialog>
    </Popover>
  );
};

FieldDocPopover.displayName = 'FieldDocPopover';
