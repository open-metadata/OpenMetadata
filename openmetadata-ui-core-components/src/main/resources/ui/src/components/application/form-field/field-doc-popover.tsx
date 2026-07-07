import type { FC, ReactNode } from 'react';
import { useRef } from 'react';
import { Dialog, Popover } from 'react-aria-components';
import { useActiveFieldDoc } from './field-doc-context';

export interface FieldDocPopoverProps {
  renderDoc?: (doc: string) => ReactNode;
  /** Optional card header (e.g. an icon + "Form Hint"); hidden when omitted. */
  header?: ReactNode;
}

const defaultRenderDoc = (doc: string): ReactNode => (
  <p className="tw:whitespace-pre-wrap tw:text-sm tw:text-secondary">{doc}</p>
);

export const FieldDocPopover: FC<FieldDocPopoverProps> = ({
  renderDoc,
  header,
}) => {
  const { entry, anchor } = useActiveFieldDoc();
  const anchorRef = useRef<HTMLElement | null>(null);
  anchorRef.current = anchor ?? null;

  if (!entry || !anchor) {
    return null;
  }

  return (
    <Popover
      isNonModal
      isOpen
      className="tw:w-[300px] tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary tw:bg-primary tw:shadow-lg"
      offset={16}
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
