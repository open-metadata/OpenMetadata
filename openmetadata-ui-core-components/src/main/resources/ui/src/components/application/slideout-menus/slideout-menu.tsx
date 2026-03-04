import { type ComponentPropsWithRef, type ReactNode, type RefAttributes } from "react";
import type {
    DialogProps as AriaDialogProps,
    ModalOverlayProps as AriaModalOverlayProps,
    ModalRenderProps as AriaModalRenderProps,
} from "react-aria-components";
import { Dialog as AriaDialog, DialogTrigger as AriaDialogTrigger, Modal as AriaModal, ModalOverlay as AriaModalOverlay } from "react-aria-components";
import { CloseButton } from "@/components/base/buttons/close-button";
import { cx } from "@/utils/cx";

interface ModalOverlayProps extends AriaModalOverlayProps, RefAttributes<HTMLDivElement> {}

export const ModalOverlay = (props: ModalOverlayProps) => {
    return (
        <AriaModalOverlay
            {...props}
            className={(state) =>
                cx(
                    "tw:fixed tw:inset-0 tw:flex tw:min-h-dvh tw:w-full tw:items-center tw:justify-end tw:bg-overlay/70 tw:pl-6 tw:outline-hidden tw:ease-linear tw:md:pl-10",
                    state.isEntering && "tw:duration-300 tw:animate-in tw:fade-in",
                    state.isExiting && "tw:duration-500 tw:animate-out tw:fade-out",
                    typeof props.className === "function" ? props.className(state) : props.className,
                )
            }
        />
    );
};
ModalOverlay.displayName = "ModalOverlay";

interface ModalProps extends AriaModalOverlayProps, RefAttributes<HTMLDivElement> {}

export const Modal = (props: ModalProps) => (
    <AriaModal
        {...props}
        className={(state) =>
            cx(
                "tw:inset-y-0 tw:right-0 tw:h-full tw:w-full tw:max-w-100 tw:shadow-xl tw:transition",
                state.isEntering && "tw:duration-300 tw:animate-in tw:slide-in-from-right",
                state.isExiting && "tw:duration-500 tw:animate-out tw:slide-out-to-right",
                typeof props.className === "function" ? props.className(state) : props.className,
            )
        }
    />
);
Modal.displayName = "Modal";

interface DialogProps extends AriaDialogProps, RefAttributes<HTMLElement> {}

export const Dialog = (props: DialogProps) => (
    <AriaDialog
        role="dialog"
        {...props}
        className={cx(
            "tw:relative tw:flex tw:size-full tw:flex-col tw:items-start tw:gap-6 tw:overflow-y-auto tw:bg-primary tw:ring-1 tw:ring-secondary_alt tw:outline-hidden",
            props.className,
        )}
    />
);
Dialog.displayName = "Dialog";

interface SlideoutMenuProps extends Omit<AriaModalOverlayProps, "children">, RefAttributes<HTMLDivElement> {
    children: ReactNode | ((children: AriaModalRenderProps & { close: () => void }) => ReactNode);
    dialogClassName?: string;
}

const Menu = ({ children, dialogClassName, ...props }: SlideoutMenuProps) => {
    return (
        <ModalOverlay {...props}>
            <Modal className={(state) => cx(typeof props.className === "function" ? props.className(state) : props.className)}>
                {(state) => (
                    <Dialog className={dialogClassName}>
                        {({ close }) => {
                            return typeof children === "function" ? children({ ...state, close }) : children;
                        }}
                    </Dialog>
                )}
            </Modal>
        </ModalOverlay>
    );
};
Menu.displayName = "SlideoutMenu";

const Content = ({ role = "main", ...props }: ComponentPropsWithRef<"div">) => {
    return <div role={role} {...props} className={cx("tw:flex tw:size-full tw:flex-col tw:gap-6 tw:overflow-y-auto tw:overscroll-auto tw:px-4 tw:md:px-6", props.className)} />;
};
Content.displayName = "SlideoutContent";

interface SlideoutHeaderProps extends ComponentPropsWithRef<"header"> {
    onClose?: () => void;
}

const Header = ({ className, children, onClose, ...props }: SlideoutHeaderProps) => {
    return (
        <header {...props} className={cx("tw:relative tw:z-1 tw:w-full tw:px-4 tw:pt-6 tw:md:px-6", className)}>
            {children}
            <CloseButton size="md" className="tw:absolute tw:top-3 tw:right-3 tw:shrink-0" onClick={onClose} />
        </header>
    );
};
Header.displayName = "SlideoutHeader";

const Footer = (props: ComponentPropsWithRef<"footer">) => {
    return <footer {...props} className={cx("tw:w-full tw:p-4 tw:shadow-[inset_0px_1px_0px_0px] tw:shadow-border-secondary tw:md:px-6", props.className)} />;
};
Footer.displayName = "SlideoutFooter";

const SlideoutMenu = Menu as typeof Menu & {
    Trigger: typeof AriaDialogTrigger;
    Content: typeof Content;
    Header: typeof Header;
    Footer: typeof Footer;
};
SlideoutMenu.displayName = "SlideoutMenu";

SlideoutMenu.Trigger = AriaDialogTrigger;
SlideoutMenu.Content = Content;
SlideoutMenu.Header = Header;
SlideoutMenu.Footer = Footer;

export { SlideoutMenu };
