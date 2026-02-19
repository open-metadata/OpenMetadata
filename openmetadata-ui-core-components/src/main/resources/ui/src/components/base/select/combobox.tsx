import type { FocusEventHandler, PointerEventHandler, RefAttributes } from "react";
import { useCallback, useContext, useRef, useState } from "react";
import { SearchLg as SearchIcon } from "@untitledui/icons";
import type { ComboBoxProps as AriaComboBoxProps, GroupProps as AriaGroupProps, ListBoxProps as AriaListBoxProps } from "react-aria-components";
import { ComboBox as AriaComboBox, Group as AriaGroup, Input as AriaInput, ListBox as AriaListBox, ComboBoxStateContext } from "react-aria-components";
import { HintText } from "@/components/base/input/hint-text";
import { Label } from "@/components/base/input/label";
import { Popover } from "@/components/base/select/popover";
import { type SelectCommonProps, SelectContext, type SelectItemType, sizes } from "@/components/base/select/select";
import { useResizeObserver } from "@/hooks/use-resize-observer";
import { cx } from "@/utils/cx";

interface ComboBoxProps extends Omit<AriaComboBoxProps<SelectItemType>, "children" | "items">, RefAttributes<HTMLDivElement>, SelectCommonProps {
    shortcut?: boolean;
    items?: SelectItemType[];
    popoverClassName?: string;
    shortcutClassName?: string;
    children: AriaListBoxProps<SelectItemType>["children"];
}

interface ComboBoxValueProps extends AriaGroupProps, RefAttributes<HTMLDivElement> {
    size: "sm" | "md";
    shortcut: boolean;
    placeholder?: string;
    shortcutClassName?: string;
    onFocus?: FocusEventHandler;
    onPointerEnter?: PointerEventHandler;
}

const ComboBoxValue = ({ size, shortcut, placeholder, shortcutClassName, ...otherProps }: ComboBoxValueProps) => {
    const state = useContext(ComboBoxStateContext);

    const value = state?.selectedItem?.value || null;
    const inputValue = state?.inputValue || null;

    const first = inputValue?.split(value?.supportingText)?.[0] || "";
    const last = inputValue?.split(first)[1];

    return (
        <AriaGroup
            {...otherProps}
            className={({ isFocusWithin, isDisabled }) =>
                cx(
                    "tw:relative tw:flex tw:w-full tw:items-center tw:gap-2 tw:rounded-lg tw:bg-primary tw:shadow-xs tw:ring-1 tw:ring-primary tw:outline-hidden tw:transition-shadow tw:duration-100 tw:ease-linear tw:ring-inset",
                    isDisabled && "tw:cursor-not-allowed tw:bg-disabled_subtle",
                    isFocusWithin && "tw:ring-2 tw:ring-brand",
                    sizes[size].root,
                )
            }
        >
            {({ isDisabled }) => (
                <>
                    <SearchIcon className="tw:pointer-events-none tw:size-5 tw:shrink-0 tw:text-fg-quaternary" />

                    <div className="tw:relative tw:flex tw:w-full tw:items-center tw:gap-2">
                        {inputValue && (
                            <span className="tw:absolute tw:top-1/2 tw:z-0 tw:inline-flex tw:w-full tw:-translate-y-1/2 tw:gap-2 tw:truncate" aria-hidden="true">
                                <p className={cx("tw:text-md tw:font-medium tw:text-primary", isDisabled && "tw:text-disabled")}>{first}</p>
                                {last && <p className={cx("tw:-ml-0.75 tw:text-md tw:text-tertiary", isDisabled && "tw:text-disabled")}>{last}</p>}
                            </span>
                        )}

                        <AriaInput
                            placeholder={placeholder}
                            className="tw:z-10 tw:w-full tw:appearance-none tw:bg-transparent tw:text-md tw:text-transparent tw:caret-alpha-black/90 tw:placeholder:text-placeholder tw:focus:outline-hidden tw:disabled:cursor-not-allowed tw:disabled:text-disabled tw:disabled:placeholder:text-disabled"
                        />
                    </div>

                    {shortcut && (
                        <div
                            className={cx(
                                "tw:absolute tw:inset-y-0.5 tw:right-0.5 tw:z-10 tw:flex tw:items-center tw:rounded-r-[inherit] tw:bg-linear-to-r tw:from-transparent tw:to-bg-primary tw:to-40% tw:pl-8",
                                isDisabled && "tw:to-bg-disabled_subtle",
                                sizes[size].shortcut,
                                shortcutClassName,
                            )}
                        >
                            <span
                                className={cx(
                                    "tw:pointer-events-none tw:rounded tw:px-1 tw:py-px tw:text-xs tw:font-medium tw:text-quaternary tw:ring-1 tw:ring-secondary tw:select-none tw:ring-inset",
                                    isDisabled && "tw:bg-transparent tw:text-disabled",
                                )}
                                aria-hidden="true"
                            >
                                ⌘K
                            </span>
                        </div>
                    )}
                </>
            )}
        </AriaGroup>
    );
};

export const ComboBox = ({ placeholder = "Search", shortcut = true, size = "sm", children, items, shortcutClassName, ...otherProps }: ComboBoxProps) => {
    const placeholderRef = useRef<HTMLDivElement>(null);
    const [popoverWidth, setPopoverWidth] = useState("");

    // Resize observer for popover width
    const onResize = useCallback(() => {
        if (!placeholderRef.current) return;

        const divRect = placeholderRef.current?.getBoundingClientRect();

        setPopoverWidth(divRect.width + "px");
    }, [placeholderRef, setPopoverWidth]);

    useResizeObserver({
        ref: placeholderRef,
        box: "border-box",
        onResize,
    });

    return (
        <SelectContext.Provider value={{ size }}>
            <AriaComboBox menuTrigger="focus" {...otherProps}>
                {(state) => (
                    <div className="tw:flex tw:flex-col tw:gap-1.5">
                        {otherProps.label && (
                            <Label isRequired={state.isRequired} tooltip={otherProps.tooltip}>
                                {otherProps.label}
                            </Label>
                        )}

                        <ComboBoxValue
                            ref={placeholderRef}
                            placeholder={placeholder}
                            shortcut={shortcut}
                            shortcutClassName={shortcutClassName}
                            size={size}
                            // This is a workaround to correctly calculating the trigger width
                            // while using ResizeObserver wasn't 100% reliable.
                            onFocus={onResize}
                            onPointerEnter={onResize}
                        />

                        <Popover size={size} triggerRef={placeholderRef} style={{ width: popoverWidth }} className={otherProps.popoverClassName}>
                            <AriaListBox items={items} className="tw:size-full tw:outline-hidden">
                                {children}
                            </AriaListBox>
                        </Popover>

                        {otherProps.hint && <HintText isInvalid={state.isInvalid}>{otherProps.hint}</HintText>}
                    </div>
                )}
            </AriaComboBox>
        </SelectContext.Provider>
    );
};
