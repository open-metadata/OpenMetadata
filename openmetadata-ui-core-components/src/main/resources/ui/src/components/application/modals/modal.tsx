import { CloseButton } from '@/components/base/buttons/close-button';
import { cx } from '@/utils/cx';
import type { ReactNode } from 'react';
import type {
  DialogProps as AriaDialogProps,
  ModalOverlayProps as AriaModalOverlayProps,
} from 'react-aria-components';
import {
  Dialog as AriaDialog,
  DialogTrigger as AriaDialogTrigger,
  Modal as AriaModal,
  ModalOverlay as AriaModalOverlay,
  Heading,
} from 'react-aria-components';

export const DialogTrigger = AriaDialogTrigger;

export const ModalOverlay = (props: AriaModalOverlayProps) => {
  return (
    <AriaModalOverlay
      {...props}
      className={(state) =>
        cx(
          'tw:fixed tw:inset-0 tw:z-50 tw:flex tw:min-h-dvh tw:w-full tw:items-end tw:justify-center tw:overflow-y-auto tw:bg-overlay/70 tw:px-4 tw:pt-4 tw:pb-[clamp(16px,8vh,64px)] tw:outline-hidden tw:backdrop-blur-[6px] tw:sm:items-center tw:sm:justify-center tw:sm:p-8',
          state.isEntering &&
            'tw:duration-300 tw:ease-out tw:animate-in tw:fade-in',
          state.isExiting &&
            'tw:duration-200 tw:ease-in tw:animate-out tw:fade-out',
          typeof props.className === 'function'
            ? props.className(state)
            : props.className
        )
      }
    />
  );
};

export const Modal = (props: AriaModalOverlayProps) => (
  <AriaModal
    {...props}
    className={(state) =>
      cx(
        'tw:max-h-full tw:w-full tw:align-middle tw:outline-hidden tw:max-sm:overflow-y-auto tw:max-sm:rounded-xl',
        state.isEntering &&
          'tw:duration-300 tw:ease-out tw:animate-in tw:zoom-in-95',
        state.isExiting &&
          'tw:duration-200 tw:ease-in tw:animate-out tw:zoom-out-95',
        typeof props.className === 'function'
          ? props.className(state)
          : props.className
      )
    }
  />
);

// Sub-components

interface DialogHeaderProps {
  title?: string;
  children?: ReactNode;
  className?: string;
}

const DialogHeader = ({ title, children, className }: DialogHeaderProps) => (
  <div
    className={cx(
      'tw:shrink-0 tw:px-4 tw:pt-5 tw:sm:px-6 tw:sm:pt-6',
      className
    )}>
    {title && (
      <Heading
        className="tw:text-md tw:font-semibold tw:text-primary"
        slot="title">
        {title}
      </Heading>
    )}
    {children}
  </div>
);

interface DialogContentProps {
  children?: ReactNode;
  className?: string;
}

// flex-1 + min-h-0 let this pane absorb all the available space *and* shrink
// below its content's intrinsic height — without min-h-0, a flex item's
// default min-height: auto (content-based) blocks the shrink and the scroll
// this exists for never kicks in. overflow-y-auto only does anything once
// that shrink has actually happened. See DialogBase for the rest of the
// flex-column chain this depends on.
const DialogContent = ({ children, className }: DialogContentProps) => (
  <div
    className={cx(
      'tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:justify-start tw:gap-4 tw:overflow-y-auto tw:px-4 tw:pt-5 tw:sm:px-6',
      className
    )}>
    {children}
  </div>
);

interface DialogFooterProps {
  children?: ReactNode;
  className?: string;
}

const DialogFooter = ({ children, className }: DialogFooterProps) => (
  <div
    className={cx(
      'tw:shrink-0 tw:z-10 tw:mt-6 tw:sm:mt-8 tw:border-t tw:border-secondary',
      className
    )}>
    <div className="tw:flex tw:flex-1 tw:gap-3 tw:sm:px-6 tw:px-4 tw:py-4 tw:justify-end">
      {children}
    </div>
  </div>
);

// Main Dialog

interface DialogProps extends Omit<AriaDialogProps, 'children'> {
  children?: ReactNode;
  title?: string;
  showCloseButton?: boolean;
  width?: number;
  onClose?: () => void;
  /**
   * Classes for the panel itself — the element `width` is applied to.
   * `className` lands on the outer dialog wrapper, which is not the element
   * that carries the width, so styling that depends on it (e.g. transitioning
   * `max-width` when `width` changes) has to go here.
   */
  panelClassName?: string;
}

type DialogComponent = ((props: DialogProps) => JSX.Element) & {
  Header: typeof DialogHeader;
  Content: typeof DialogContent;
  Footer: typeof DialogFooter;
};

const DialogBase = ({
  children,
  title,
  showCloseButton,
  onClose,
  width = 688,
  panelClassName,
  ...props
}: DialogProps) => (
  <AriaDialog
    {...props}
    className={cx(
      'tw:flex tw:w-full tw:items-center tw:justify-center tw:outline-hidden',
      props.className as string | undefined
    )}>
    {({ close }) => (
      // flex + max-h-[85dvh] here (not a % height — Modal above only ever
      // sets max-height, never a definite height, so a percentage would have
      // no definite ancestor to resolve against and silently no-op) bounds
      // the panel so DialogContent's flex-1/min-h-0/overflow-y-auto below
      // has an actual constraint to shrink against instead of growing
      // unbounded and being clipped by the rounded-2xl overflow-hidden pane.
      <div
        className={cx(
          'tw:relative tw:flex tw:max-h-[85dvh] tw:w-full tw:flex-col tw:rounded-2xl tw:bg-primary tw:shadow-xl',
          panelClassName
        )}
        style={{ maxWidth: width }}>
        <div className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:overflow-hidden tw:rounded-2xl">
          {title && (
            <>
              <DialogHeader
                className={showCloseButton ? 'tw:pr-12' : undefined}
                title={title}
              />
              <div className="tw:h-5 tw:w-full tw:shrink-0" />
              <div className="tw:w-full tw:shrink-0 tw:border-t tw:border-secondary" />
            </>
          )}
          {children}
        </div>
        {showCloseButton && (
          <CloseButton
            className="tw:absolute tw:top-3 tw:right-3 tw:z-10"
            size="lg"
            // If a caller doesn’t pass onClose, fall back to React Aria’s built-in
            // close() to dismiss the dialog.
            onPress={onClose ?? close}
          />
        )}
      </div>
    )}
  </AriaDialog>
);

export const Dialog = DialogBase as DialogComponent;
Dialog.Header = DialogHeader;
Dialog.Content = DialogContent;
Dialog.Footer = DialogFooter;
