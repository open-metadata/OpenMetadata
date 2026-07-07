import type { FC, ReactNode, RefObject } from 'react';
import { Dialog, Popover } from 'react-aria-components';
import { useActiveFieldDoc } from './field-doc-context';

export interface FieldDocPopoverProps {
  triggerRef: RefObject<HTMLElement | null>;
  renderDoc?: (doc: string) => ReactNode;
}

const defaultRenderDoc = (doc: string): ReactNode => (
  <p className="tw:whitespace-pre-wrap tw:text-sm tw:text-secondary">{doc}</p>
);

export const FieldDocPopover: FC<FieldDocPopoverProps> = ({ triggerRef, renderDoc }) => {
  const { entry } = useActiveFieldDoc();

  if (!entry) {
    return null;
  }

  return (
    <Popover
      isNonModal
      isOpen
      placement="right top"
      offset={12}
      triggerRef={triggerRef}
      className="tw:w-[280px] tw:rounded-xl tw:border tw:border-primary tw:bg-primary tw:shadow-lg tw:p-4">
      <Dialog aria-label="Field documentation" className="tw:outline-none">
        <h4 className="tw:text-sm tw:font-semibold tw:text-primary tw:mb-2">{entry.label}</h4>
        {(renderDoc ?? defaultRenderDoc)(entry.doc)}
      </Dialog>
    </Popover>
  );
};

FieldDocPopover.displayName = 'FieldDocPopover';
