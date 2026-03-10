import type { FC, ReactNode, Ref, RefAttributes } from "react";
import { createContext, isValidElement } from "react";
import { ChevronDown } from "@untitledui/icons";
import type { SelectProps as AriaSelectProps } from "react-aria-components";
import { Button as AriaButton, ListBox as AriaListBox, Select as AriaSelect, SelectValue as AriaSelectValue } from "react-aria-components";
import { Avatar } from "@/components/base/avatar/avatar";
import { HintText } from "@/components/base/input/hint-text";
import { Label } from "@/components/base/input/label";
import { cx } from "@/utils/cx";
import { isReactComponent } from "@/utils/is-react-component";
import { ComboBox } from "./combobox";
import { Popover } from "./popover";
import { SelectItem } from "./select-item";

export type SelectItemType = {
    id: string;
    label?: string;
    avatarUrl?: string;
    isDisabled?: boolean;
    supportingText?: string;
    icon?: FC | ReactNode;
};

export interface SelectCommonProps {
    hint?: string;
    label?: string;
    tooltip?: string;
    size?: "sm" | "md";
    placeholder?: string;
}

interface SelectProps extends Omit<AriaSelectProps<SelectItemType>, "children" | "items">, RefAttributes<HTMLDivElement>, SelectCommonProps {
    items?: SelectItemType[];
    popoverClassName?: string;
    placeholderIcon?: FC | ReactNode;
    children: ReactNode | ((item: SelectItemType) => ReactNode);
}

interface SelectValueProps {
    isOpen: boolean;
    size: "sm" | "md";
    isFocused: boolean;
    isDisabled: boolean;
    placeholder?: string;
    ref?: Ref<HTMLButtonElement>;
    placeholderIcon?: FC | ReactNode;
}

export const sizes = {
    sm: { root: "tw:py-2 tw:px-3", shortcut: "tw:pr-2.5" },
    md: { root: "tw:py-2.5 tw:px-3.5", shortcut: "tw:pr-3" },
};

const SelectValue = ({ isOpen, isFocused, isDisabled, size, placeholder, placeholderIcon, ref }: SelectValueProps) => {
    return (
        <AriaButton
            ref={ref}
            className={cx(
                "tw:relative tw:flex tw:w-full tw:cursor-pointer tw:items-center tw:rounded-lg tw:bg-primary tw:shadow-xs tw:ring-1 tw:ring-primary tw:outline-hidden tw:transition tw:duration-100 tw:ease-linear tw:ring-inset",
                (isFocused || isOpen) && "tw:ring-2 tw:ring-brand",
                isDisabled && "tw:cursor-not-allowed tw:bg-disabled_subtle tw:text-disabled",
            )}
        >
            <AriaSelectValue<SelectItemType>
                className={cx(
                    "tw:flex tw:h-max tw:w-full tw:items-center tw:justify-start tw:gap-2 tw:truncate tw:text-left tw:align-middle",

                    // Icon styles
                    "tw:*:data-icon:size-5 tw:*:data-icon:shrink-0 tw:*:data-icon:text-fg-quaternary tw:in-disabled:*:data-icon:text-fg-disabled",

                    sizes[size].root,
                )}
            >
                {(state) => {
                    const Icon = state.selectedItem?.icon || placeholderIcon;
                    return (
                        <>
                            {state.selectedItem?.avatarUrl ? (
                                <Avatar size="xs" src={state.selectedItem.avatarUrl} alt={state.selectedItem.label} />
                            ) : isReactComponent(Icon) ? (
                                <Icon data-icon aria-hidden="true" />
                            ) : isValidElement(Icon) ? (
                                Icon
                            ) : null}

                            {state.selectedItem ? (
                                <section className="tw:flex tw:w-full tw:gap-2 tw:truncate">
                                    <p className="tw:truncate tw:text-md tw:font-medium tw:text-primary">{state.selectedItem?.label}</p>
                                    {state.selectedItem?.supportingText && <p className="tw:text-md tw:text-tertiary">{state.selectedItem?.supportingText}</p>}
                                </section>
                            ) : (
                                <p className={cx("tw:text-md tw:text-placeholder", isDisabled && "tw:text-disabled")}>{placeholder}</p>
                            )}

                            <ChevronDown
                                aria-hidden="true"
                                className={cx("tw:ml-auto tw:shrink-0 tw:text-fg-quaternary", size === "sm" ? "tw:size-4 tw:stroke-[2.5px]" : "tw:size-5")}
                            />
                        </>
                    );
                }}
            </AriaSelectValue>
        </AriaButton>
    );
};

export const SelectContext = createContext<{ size: "sm" | "md" }>({ size: "sm" });

const Select = ({ placeholder = "Select", placeholderIcon, size = "sm", children, items, label, hint, tooltip, className, ...rest }: SelectProps) => {
    return (
        <SelectContext.Provider value={{ size }}>
            <AriaSelect {...rest} className={(state) => cx("tw:flex tw:flex-col tw:gap-1.5", typeof className === "function" ? className(state) : className)}>
                {(state) => (
                    <>
                        {label && (
                            <Label isRequired={state.isRequired} tooltip={tooltip}>
                                {label}
                            </Label>
                        )}

                        <SelectValue {...state} {...{ size, placeholder }} placeholderIcon={placeholderIcon} />

                        <Popover size={size} className={rest.popoverClassName}>
                            <AriaListBox items={items} className="tw:size-full tw:outline-hidden">
                                {children}
                            </AriaListBox>
                        </Popover>

                        {hint && <HintText isInvalid={state.isInvalid}>{hint}</HintText>}
                    </>
                )}
            </AriaSelect>
        </SelectContext.Provider>
    );
};

const _Select = Select as typeof Select & {
    ComboBox: typeof ComboBox;
    Item: typeof SelectItem;
};
_Select.ComboBox = ComboBox;
_Select.Item = SelectItem;

export { _Select as Select };
