import { isValidElement, useContext } from "react";
import { Check } from "@untitledui/icons";
import type { ListBoxItemProps as AriaListBoxItemProps } from "react-aria-components";
import { ListBoxItem as AriaListBoxItem, Text as AriaText } from "react-aria-components";
import { Avatar } from "@/components/base/avatar/avatar";
import { cx } from "@/utils/cx";
import { isReactComponent } from "@/utils/is-react-component";
import type { SelectItemType } from "./select";
import { SelectContext } from "./select";

const sizes = {
    sm: "tw:p-2 tw:pr-2.5",
    md: "tw:p-2.5 tw:pl-2",
};

interface SelectItemProps extends Omit<AriaListBoxItemProps<SelectItemType>, "id">, SelectItemType {}

export const SelectItem = ({ label, id, value, avatarUrl, supportingText, isDisabled, icon: Icon, className, children, ...props }: SelectItemProps) => {
    const { size } = useContext(SelectContext);

    const labelOrChildren = label || (typeof children === "string" ? children : "");
    const textValue = supportingText ? labelOrChildren + " " + supportingText : labelOrChildren;

    return (
        <AriaListBoxItem
            id={id}
            value={
                value ?? {
                    id,
                    label: labelOrChildren,
                    avatarUrl,
                    supportingText,
                    isDisabled,
                    icon: Icon,
                }
            }
            textValue={textValue}
            isDisabled={isDisabled}
            {...props}
            className={(state) => cx("tw:w-full tw:px-1.5 tw:py-px tw:outline-hidden", typeof className === "function" ? className(state) : className)}
        >
            {(state) => (
                <div
                    className={cx(
                        "tw:flex tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-md tw:outline-hidden tw:select-none",
                        state.isSelected && "tw:bg-active",
                        state.isDisabled && "tw:cursor-not-allowed",
                        state.isFocused && "tw:bg-primary_hover",
                        state.isFocusVisible && "tw:ring-2 tw:ring-focus-ring tw:ring-inset",

                        // Icon styles
                        "tw:*:data-icon:size-5 tw:*:data-icon:shrink-0 tw:*:data-icon:text-fg-quaternary",
                        state.isDisabled && "tw:*:data-icon:text-fg-disabled",

                        sizes[size],
                    )}
                >
                    {avatarUrl ? (
                        <Avatar aria-hidden="true" size="xs" src={avatarUrl} alt={label} />
                    ) : isReactComponent(Icon) ? (
                        <Icon data-icon aria-hidden="true" />
                    ) : isValidElement(Icon) ? (
                        Icon
                    ) : null}

                    <div className="tw:flex tw:w-full tw:min-w-0 tw:flex-1 tw:flex-wrap tw:gap-x-2">
                        <AriaText
                            slot="label"
                            className={cx("tw:truncate tw:text-md tw:font-medium tw:whitespace-nowrap tw:text-primary", state.isDisabled && "tw:text-disabled")}
                        >
                            {label || (typeof children === "function" ? children(state) : children)}
                        </AriaText>

                        {supportingText && (
                            <AriaText slot="description" className={cx("tw:text-md tw:whitespace-nowrap tw:text-tertiary", state.isDisabled && "tw:text-disabled")}>
                                {supportingText}
                            </AriaText>
                        )}
                    </div>

                    {state.isSelected && (
                        <Check
                            aria-hidden="true"
                            className={cx(
                                "tw:ml-auto tw:text-fg-brand-primary",
                                size === "sm" ? "tw:size-4 tw:stroke-[2.5px]" : "tw:size-5",
                                state.isDisabled && "tw:text-fg-disabled",
                            )}
                        />
                    )}
                </div>
            )}
        </AriaListBoxItem>
    );
};
