import type { ReactNode } from 'react';
import type {
  DialogProps as AriaDialogProps,
  ModalOverlayProps as AriaModalOverlayProps,
} from 'react-aria-components';
import {
  Dialog as AriaDialog,
  DialogTrigger as AriaDialogTrigger,
  Heading,
  Modal as AriaModal,
  ModalOverlay as AriaModalOverlay,
} from 'react-aria-components';
import { CloseButton } from '@/components/base/buttons/close-button';
import { cx } from '@/utils/cx';

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
  <div className={cx('tw:px-4 tw:pt-5 tw:sm:px-6 tw:sm:pt-6', className)}>
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

const DialogContent = ({ children, className }: DialogContentProps) => (
  <div
    className={cx(
      'tw:flex tw:flex-col tw:justify-start tw:gap-4 tw:px-4 tw:pt-5 tw:sm:px-6',
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
    className={cx('tw:z-10 tw:pt-6 tw:pb-4 tw:sm:pt-8 tw:sm:pb-6', className)}>
    <div className="tw:w-full tw:border-t tw:border-secondary" />
    <div className="tw:h-4 tw:w-full tw:sm:h-6" />
    <div className="tw:flex tw:flex-1 tw:flex-col-reverse tw:gap-3 tw:sm:grid tw:sm:grid-cols-2 tw:sm:px-6 tw:px-4">
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
  ...props
}: DialogProps) => (
  <AriaDialog
    {...props}
    className={cx(
      'tw:flex tw:w-full tw:items-center tw:justify-center tw:outline-hidden',
      props.className as string | undefined
    )}>
    <div
      className="tw:relative tw:w-full tw:rounded-2xl tw:bg-primary tw:shadow-xl"
      style={{ maxWidth: width }}>
      <div className="tw:overflow-hidden tw:rounded-2xl">
        {title && (
          <>
            <DialogHeader
              className={showCloseButton ? 'tw:pr-12' : undefined}
              title={title}
            />
            <div className="tw:h-5 tw:w-full" />
            <div className="tw:w-full tw:border-t tw:border-secondary" />
          </>
        )}
        {children}
      </div>
      {showCloseButton && (
        <CloseButton
          className="tw:absolute tw:top-3 tw:right-3 tw:z-10"
          size="lg"
          onPress={onClose}
        />
      )}
    </div>
  </AriaDialog>
);

export const Dialog = DialogBase as DialogComponent;
Dialog.Header = DialogHeader;
Dialog.Content = DialogContent;
Dialog.Footer = DialogFooter;
