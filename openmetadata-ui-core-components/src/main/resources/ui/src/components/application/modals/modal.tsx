import { CloseButton } from '@/components/base/buttons/close-button';
import { useResizeObserver } from '@/hooks/use-resize-observer';
import { cx } from '@/utils/cx';
import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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

type ModalPresentation = 'dialog' | 'fullscreen';
const ModalPresentationContext = createContext<ModalPresentation>('dialog');

export const ModalOverlay = ({
  presentation = 'dialog',
  ...props
}: AriaModalOverlayProps & { presentation?: ModalPresentation }) => {
  return (
    <ModalPresentationContext.Provider value={presentation}>
      <AriaModalOverlay
        {...props}
        className={(state) =>
          cx(
            'tw:fixed tw:inset-0 tw:z-50 tw:flex tw:min-h-dvh tw:w-full tw:justify-center tw:outline-hidden',
            presentation === 'fullscreen'
              ? 'tw:items-stretch tw:overflow-hidden'
              : 'tw:items-end tw:overflow-y-auto tw:bg-overlay/70 tw:dark:bg-overlay/60 tw:px-4 tw:pt-4 tw:pb-[clamp(16px,8vh,64px)] tw:backdrop-blur-[6px] tw:sm:items-center tw:sm:justify-center tw:sm:p-8',
            presentation !== 'fullscreen' &&
              state.isEntering &&
              'tw:duration-300 tw:ease-out tw:animate-in tw:fade-in',
            presentation !== 'fullscreen' &&
              state.isExiting &&
              'tw:duration-200 tw:ease-in tw:animate-out tw:fade-out',
            typeof props.className === 'function'
              ? props.className(state)
              : props.className
          )
        }
      />
    </ModalPresentationContext.Provider>
  );
};

export const Modal = (props: AriaModalOverlayProps) => {
  const fullscreen = useContext(ModalPresentationContext) === 'fullscreen';

  return (
    <AriaModal
      {...props}
      className={(state) =>
        cx(
          'tw:max-h-full tw:w-full tw:align-middle tw:outline-hidden',
          fullscreen
            ? 'tw:h-dvh'
            : 'tw:max-sm:overflow-y-auto tw:max-sm:rounded-xl',
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
};

/**
 * - `always`: a divider under the title and above the footer.
 * - `scroll`: no title divider; the footer divider shows only while
 *   `Dialog.Content` overflows, marking that more of the form is below.
 */
export type DialogDividers = 'always' | 'scroll';

interface DialogDividerContextValue {
  dividers: DialogDividers;
  isContentScrollable: boolean;
  setContentScrollable: (scrollable: boolean) => void;
}

const DialogDividerContext = createContext<DialogDividerContextValue>({
  dividers: 'always',
  isContentScrollable: false,
  setContentScrollable: () => undefined,
});

// Sub-components

interface DialogHeaderProps {
  title?: string;
  children?: ReactNode;
  className?: string;
}

const DialogHeader = ({ title, children, className }: DialogHeaderProps) => {
  const fullscreen = useContext(ModalPresentationContext) === 'fullscreen';

  return (
    <div
      className={cx(
        fullscreen
          ? 'tw:min-h-16 tw:shrink-0 tw:px-4 tw:py-3 tw:sm:px-6'
          : 'tw:px-4 tw:pt-5 tw:sm:px-6 tw:sm:pt-6',
        className
      )}>
      {title && (
        <Heading
          className="tw:text-md tw:font-semibold tw:text-primary"
          data-testid="dialog-title"
          slot="title">
          {title}
        </Heading>
      )}
      {children}
    </div>
  );
};

interface DialogContentProps {
  children?: ReactNode;
  className?: string;
}

// max-h-[60vh] + overflow-y-auto so long content scrolls within its own pane
// instead of being silently clipped by the panel's overflow-hidden rounding
// (Dialog.Footer sits below this, outside it, so it's unaffected either
// way). Matches the value/pattern already duplicated across ~13 call sites
// in openmetadata-ui/collate-ui that worked around this by hand; a consumer
// can still override via className for a case that genuinely needs more.
const DialogContent = ({ children, className }: DialogContentProps) => {
  const fullscreen = useContext(ModalPresentationContext) === 'fullscreen';
  const ref = useRef<HTMLDivElement>(null);
  const { dividers, setContentScrollable } = useContext(DialogDividerContext);
  const measure = useCallback(() => {
    const element = ref.current;
    if (dividers === 'scroll' && element) {
      setContentScrollable(element.scrollHeight > element.clientHeight);
    }
  }, [dividers, setContentScrollable]);

  useResizeObserver({ ref, onResize: measure });
  // Content can grow without the capped pane resizing (e.g. a validation
  // message appearing), so re-measure after every render too.
  useLayoutEffect(measure);

  return (
    <div
      className={cx(
        'tw:flex tw:flex-col tw:justify-start tw:gap-4 tw:overflow-y-auto tw:px-4 tw:sm:px-6',
        fullscreen
          ? 'tw:min-h-0 tw:flex-1 tw:bg-canvas tw:py-6'
          : 'tw:max-h-[60vh] tw:pt-5',
        className
      )}
      ref={ref}>
      {children}
    </div>
  );
};

interface DialogFooterProps {
  children?: ReactNode;
  className?: string;
}

const DialogFooter = ({ children, className }: DialogFooterProps) => {
  const { dividers, isContentScrollable } = useContext(DialogDividerContext);
  const hasDivider = dividers === 'always' || isContentScrollable;

  return (
    <div
      className={cx(
        'tw:z-10 tw:mt-6 tw:sm:mt-8',
        hasDivider && 'tw:border-t tw:border-subtle',
        className
      )}
      data-divider={hasDivider}>
      <div className="tw:flex tw:flex-1 tw:gap-3 tw:sm:px-6 tw:px-4 tw:py-4 tw:justify-end">
        {children}
      </div>
    </div>
  );
};

// Main Dialog

interface DialogProps extends Omit<AriaDialogProps, 'children'> {
  children?: ReactNode;
  title?: string;
  showCloseButton?: boolean;
  width?: number;
  onClose?: () => void;
  /** Where dividers are drawn; see `DialogDividers`. Defaults to `always`. */
  dividers?: DialogDividers;
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
  dividers = 'always',
  ...props
}: DialogProps) => {
  const fullscreen = useContext(ModalPresentationContext) === 'fullscreen';
  const [isContentScrollable, setContentScrollable] = useState(false);
  const dividerContext = useMemo(
    () => ({ dividers, isContentScrollable, setContentScrollable }),
    [dividers, isContentScrollable]
  );

  return (
    <DialogDividerContext.Provider value={dividerContext}>
      <AriaDialog
        {...props}
        className={cx(
          'tw:flex tw:w-full tw:items-center tw:justify-center tw:outline-hidden',
          fullscreen && 'tw:h-full',
          props.className as string | undefined
        )}>
        {({ close }) => (
          <div
            className={cx(
              'tw:relative tw:w-full tw:bg-overlay-surface',
              fullscreen ? 'tw:h-full' : 'tw:rounded-2xl tw:shadow-overlay',
              panelClassName
            )}
            style={fullscreen ? undefined : { maxWidth: width }}>
            <div
              className={cx(
                'tw:overflow-hidden',
                fullscreen ? 'tw:flex tw:h-full tw:flex-col' : 'tw:rounded-2xl'
              )}>
              {title && (
                <>
                  <DialogHeader
                    className={showCloseButton ? 'tw:pr-12' : undefined}
                    title={title}
                  />
                  {/* Without a divider, Dialog.Content's top padding is the gap. */}
                  {dividers === 'always' && (
                    <>
                      <div className="tw:h-5 tw:w-full" />
                      <div className="tw:w-full tw:border-t tw:border-subtle" />
                    </>
                  )}
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
    </DialogDividerContext.Provider>
  );
};

export const Dialog = DialogBase as DialogComponent;
Dialog.Header = DialogHeader;
Dialog.Content = DialogContent;
Dialog.Footer = DialogFooter;
