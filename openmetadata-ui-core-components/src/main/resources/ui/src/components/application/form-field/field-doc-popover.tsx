import type { FC, ReactNode } from 'react';
import { useRef } from 'react';
import { Dialog, Popover } from 'react-aria-components';
import { useActiveFieldDoc } from './field-doc-context';

export interface FieldDocPopoverProps {
  renderDoc?: (doc: string) => ReactNode;
}

const defaultRenderDoc = (doc: string): ReactNode => (
  <p className="tw:whitespace-pre-wrap tw:text-sm tw:text-secondary">{doc}</p>
);

export const FieldDocPopover: FC<FieldDocPopoverProps> = ({ renderDoc }) => {
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
      className="tw:w-[280px] tw:rounded-xl tw:border tw:border-primary tw:bg-primary tw:shadow-lg tw:p-4"
      offset={16}
      placement="right top"
      triggerRef={anchorRef}>
      <Dialog aria-label="Field documentation" className="tw:outline-none">
        <h4 className="tw:text-sm tw:font-semibold tw:text-primary tw:mb-2">
          {entry.label}
        </h4>
        {(renderDoc ?? defaultRenderDoc)(entry.doc)}
      </Dialog>
    </Popover>
  );
};

FieldDocPopover.displayName = 'FieldDocPopover';
