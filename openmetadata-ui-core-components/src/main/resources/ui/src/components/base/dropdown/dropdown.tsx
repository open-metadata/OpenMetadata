import type { FC, HTMLAttributes, RefAttributes } from "react";
import { DotsVertical } from "@untitledui/icons";
import type {
    ButtonProps as AriaButtonProps,
    MenuItemProps as AriaMenuItemProps,
    MenuProps as AriaMenuProps,
    PopoverProps as AriaPopoverProps,
    SeparatorProps as AriaSeparatorProps,
} from "react-aria-components";
import {
    Button as AriaButton,
    Header as AriaHeader,
    Menu as AriaMenu,
    MenuItem as AriaMenuItem,
    MenuSection as AriaMenuSection,
    MenuTrigger as AriaMenuTrigger,
    Popover as AriaPopover,
    Separator as AriaSeparator,
} from "react-aria-components";
import { cx } from "@/utils/cx";

interface DropdownItemProps extends AriaMenuItemProps {
    /** The label of the item to be displayed. */
    label?: string;
    /** An addon to be displayed on the right side of the item. */
    addon?: string;
    /** If true, the item will not have any styles. */
    unstyled?: boolean;
    /** An icon to be displayed on the left side of the item. */
    icon?: FC<{ className?: string }>;
}

const DropdownItem = ({ label, children, addon, icon: Icon, unstyled, ...props }: DropdownItemProps) => {
    if (unstyled) {
        return <AriaMenuItem id={label} textValue={label} {...props} />;
    }

    return (
        <AriaMenuItem
            {...props}
            className={(state) =>
                cx(
                    "tw:group tw:block tw:cursor-pointer tw:px-1.5 tw:py-px tw:outline-hidden",
                    state.isDisabled && "tw:cursor-not-allowed",
                    typeof props.className === "function" ? props.className(state) : props.className,
                )
            }
        >
            {(state) => (
                <div
                    className={cx(
                        "tw:relative tw:flex tw:items-center tw:rounded-md tw:px-2.5 tw:py-2 tw:outline-focus-ring tw:transition tw:duration-100 tw:ease-linear",
                        !state.isDisabled && "tw:group-hover:bg-primary_hover",
                        state.isFocused && "tw:bg-primary_hover",
                        state.isFocusVisible && "tw:outline-2 tw:-outline-offset-2",
                    )}
                >
                    {Icon && (
                        <Icon
                            aria-hidden="true"
                            className={cx("tw:mr-2 tw:size-4 tw:shrink-0 tw:stroke-[2.25px]", state.isDisabled ? "tw:text-fg-disabled" : "tw:text-fg-quaternary")}
                        />
                    )}

                    <span
                        className={cx(
                            "tw:grow tw:truncate tw:text-sm tw:font-semibold",
                            state.isDisabled ? "tw:text-disabled" : "tw:text-secondary",
                            state.isFocused && "tw:text-secondary_hover",
                        )}
                    >
                        {label || (typeof children === "function" ? children(state) : children)}
                    </span>

                    {addon && (
                        <span
                            className={cx(
                                "tw:ml-3 tw:shrink-0 tw:rounded tw:px-1 tw:py-px tw:text-xs tw:font-medium tw:ring-1 tw:ring-secondary tw:ring-inset",
                                state.isDisabled ? "tw:text-disabled" : "tw:text-quaternary",
                            )}
                        >
                            {addon}
                        </span>
                    )}
                </div>
            )}
        </AriaMenuItem>
    );
};

interface DropdownMenuProps<T extends object> extends AriaMenuProps<T> {}

const DropdownMenu = <T extends object>(props: DropdownMenuProps<T>) => {
    return (
        <AriaMenu
            disallowEmptySelection
            selectionMode="single"
            {...props}
            className={(state) =>
                cx("tw:h-min tw:overflow-y-auto tw:py-1 tw:outline-hidden tw:select-none", typeof props.className === "function" ? props.className(state) : props.className)
            }
        />
    );
};

interface DropdownPopoverProps extends AriaPopoverProps {}

const DropdownPopover = (props: DropdownPopoverProps) => {
    return (
        <AriaPopover
            placement="bottom right"
            {...props}
            className={(state) =>
                cx(
                    "tw:w-62 tw:origin-(--trigger-anchor-point) tw:overflow-auto tw:rounded-lg tw:bg-primary tw:shadow-lg tw:ring-1 tw:ring-secondary_alt tw:will-change-transform",
                    state.isEntering &&
                        "tw:duration-150 tw:ease-out tw:animate-in tw:fade-in tw:placement-right:slide-in-from-left-0.5 tw:placement-top:slide-in-from-bottom-0.5 tw:placement-bottom:slide-in-from-top-0.5",
                    state.isExiting &&
                        "tw:duration-100 tw:ease-in tw:animate-out tw:fade-out tw:placement-right:slide-out-to-left-0.5 tw:placement-top:slide-out-to-bottom-0.5 tw:placement-bottom:slide-out-to-top-0.5",
                    typeof props.className === "function" ? props.className(state) : props.className,
                )
            }
        >
            {props.children}
        </AriaPopover>
    );
};

const DropdownSeparator = (props: AriaSeparatorProps) => {
    return <AriaSeparator {...props} className={cx("tw:my-1 tw:h-px tw:w-full tw:bg-border-secondary", props.className)} />;
};

const DropdownDotsButton = (props: AriaButtonProps & RefAttributes<HTMLButtonElement>) => {
    return (
        <AriaButton
            {...props}
            aria-label="Open menu"
            className={(state) =>
                cx(
                    "tw:cursor-pointer tw:rounded-md tw:text-fg-quaternary tw:outline-focus-ring tw:transition tw:duration-100 tw:ease-linear",
                    (state.isPressed || state.isHovered) && "tw:text-fg-quaternary_hover",
                    (state.isPressed || state.isFocusVisible) && "tw:outline-2 tw:outline-offset-2",
                    typeof props.className === "function" ? props.className(state) : props.className,
                )
            }
        >
            <DotsVertical className="tw:size-5 tw:transition-inherit-all" />
        </AriaButton>
    );
};

export type DropdownSectionHeaderProps = HTMLAttributes<HTMLElement> & RefAttributes<HTMLElement>;

export const Dropdown = {
    Root: AriaMenuTrigger,
    Popover: DropdownPopover,
    Menu: DropdownMenu,
    Section: AriaMenuSection,
    SectionHeader: AriaHeader as FC<DropdownSectionHeaderProps>,
    Item: DropdownItem,
    Separator: DropdownSeparator,
    DotsButton: DropdownDotsButton,
};
