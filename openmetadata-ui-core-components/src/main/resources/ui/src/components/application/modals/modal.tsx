import type { DialogProps as AriaDialogProps, ModalOverlayProps as AriaModalOverlayProps } from "react-aria-components";
import { Dialog as AriaDialog, DialogTrigger as AriaDialogTrigger, Modal as AriaModal, ModalOverlay as AriaModalOverlay } from "react-aria-components";
import { cx } from "@/utils/cx";

export const DialogTrigger = AriaDialogTrigger;

export const ModalOverlay = (props: AriaModalOverlayProps) => {
    return (
        <AriaModalOverlay
            {...props}
            className={(state) =>
                cx(
                    "tw:fixed tw:inset-0 tw:z-50 tw:flex tw:min-h-dvh tw:w-full tw:items-end tw:justify-center tw:overflow-y-auto tw:bg-overlay/70 tw:px-4 tw:pt-4 tw:pb-[clamp(16px,8vh,64px)] tw:outline-hidden tw:backdrop-blur-[6px] tw:sm:items-center tw:sm:justify-center tw:sm:p-8",
                    state.isEntering && "tw:duration-300 tw:ease-out tw:animate-in tw:fade-in",
                    state.isExiting && "tw:duration-200 tw:ease-in tw:animate-out tw:fade-out",
                    typeof props.className === "function" ? props.className(state) : props.className,
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
                "tw:max-h-full tw:w-full tw:align-middle tw:outline-hidden tw:max-sm:overflow-y-auto tw:max-sm:rounded-xl",
                state.isEntering && "tw:duration-300 tw:ease-out tw:animate-in tw:zoom-in-95",
                state.isExiting && "tw:duration-200 tw:ease-in tw:animate-out tw:zoom-out-95",
                typeof props.className === "function" ? props.className(state) : props.className,
            )
        }
    />
);

export const Dialog = (props: AriaDialogProps) => (
    <AriaDialog {...props} className={cx("tw:flex tw:w-full tw:items-center tw:justify-center tw:outline-hidden", props.className)} />
);
