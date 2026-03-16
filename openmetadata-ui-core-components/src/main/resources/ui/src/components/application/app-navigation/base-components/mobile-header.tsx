import type { PropsWithChildren } from "react";
import { X as CloseIcon, Home01, Menu02 } from "@untitledui/icons";
import {
    Button as AriaButton,
    Dialog as AriaDialog,
    DialogTrigger as AriaDialogTrigger,
    Modal as AriaModal,
    ModalOverlay as AriaModalOverlay,
} from "react-aria-components";
import { cx } from "@/utils/cx";

export const MobileNavigationHeader = ({ children }: PropsWithChildren) => {
    return (
        <AriaDialogTrigger>
            <header className="tw:flex tw:h-16 tw:items-center tw:justify-between tw:border-b tw:border-secondary tw:bg-primary tw:py-3 tw:pr-2 tw:pl-4 tw:lg:hidden">
                <Home01 className="tw:size-8 tw:text-fg-primary" />

                <AriaButton
                    aria-label="Expand navigation menu"
                    className="tw:group tw:flex tw:items-center tw:justify-center tw:rounded-lg tw:bg-primary tw:p-2 tw:text-fg-secondary tw:outline-focus-ring tw:hover:bg-primary_hover tw:hover:text-fg-secondary_hover tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2"
                >
                    <Menu02 className="tw:size-6 tw:transition tw:duration-200 tw:ease-in-out tw:group-aria-expanded:opacity-0" />
                    <CloseIcon className="tw:absolute tw:size-6 tw:opacity-0 tw:transition tw:duration-200 tw:ease-in-out tw:group-aria-expanded:opacity-100" />
                </AriaButton>
            </header>

            <AriaModalOverlay
                isDismissable
                className={({ isEntering, isExiting }) =>
                    cx(
                        "tw:fixed tw:inset-0 tw:z-50 tw:cursor-pointer tw:bg-overlay/70 tw:pr-16 tw:backdrop-blur-md tw:lg:hidden",
                        isEntering && "tw:duration-300 tw:ease-in-out tw:animate-in tw:fade-in",
                        isExiting && "tw:duration-200 tw:ease-in-out tw:animate-out tw:fade-out",
                    )
                }
            >
                {({ state }) => (
                    <>
                        <AriaButton
                            aria-label="Close navigation menu"
                            onPress={() => state.close()}
                            className="tw:fixed tw:top-3 tw:right-2 tw:flex tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-lg tw:p-2 tw:text-fg-white/70 tw:outline-focus-ring tw:hover:bg-white/10 tw:hover:text-fg-white tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2"
                        >
                            <CloseIcon className="tw:size-6" />
                        </AriaButton>

                        <AriaModal className="tw:w-full tw:cursor-auto tw:will-change-transform">
                            <AriaDialog className="tw:h-dvh tw:outline-hidden tw:focus:outline-hidden">{children}</AriaDialog>
                        </AriaModal>
                    </>
                )}
            </AriaModalOverlay>
        </AriaDialogTrigger>
    );
};
