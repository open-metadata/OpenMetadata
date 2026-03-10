import type { FocusEventHandler, KeyboardEvent, PointerEventHandler, RefAttributes } from "react";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { SearchLg } from "@untitledui/icons";
import { FocusScope, useFilter, useFocusManager } from "react-aria";
import type { ComboBoxProps as AriaComboBoxProps, GroupProps as AriaGroupProps, ListBoxProps as AriaListBoxProps, Key } from "react-aria-components";
import { ComboBox as AriaComboBox, Group as AriaGroup, Input as AriaInput, ListBox as AriaListBox, ComboBoxStateContext } from "react-aria-components";
import type { ListData } from "react-stately";
import { useListData } from "react-stately";
import { Avatar } from "@/components/base/avatar/avatar";
import type { IconComponentType } from "@/components/base/badges/badge-types";
import { HintText } from "@/components/base/input/hint-text";
import { Label } from "@/components/base/input/label";
import { Popover } from "@/components/base/select/popover";
import { type SelectItemType, sizes } from "@/components/base/select/select";
import { TagCloseX } from "@/components/base/tags/base-components/tag-close-x";
import { useResizeObserver } from "@/hooks/use-resize-observer";
import { cx } from "@/utils/cx";
import { SelectItem } from "./select-item";

interface ComboBoxValueProps extends AriaGroupProps, RefAttributes<HTMLDivElement> {
    size: "sm" | "md";
    shortcut?: boolean;
    isDisabled?: boolean;
    placeholder?: string;
    shortcutClassName?: string;
    placeholderIcon?: IconComponentType | null;
    onFocus?: FocusEventHandler;
    onPointerEnter?: PointerEventHandler;
}

const ComboboxContext = createContext<{
    size: "sm" | "md";
    selectedKeys: Key[];
    selectedItems: ListData<SelectItemType>;
    onRemove: (keys: Set<Key>) => void;
    onInputChange: (value: string) => void;
}>({
    size: "sm",
    selectedKeys: [],
    selectedItems: {} as ListData<SelectItemType>,
    onRemove: () => {},
    onInputChange: () => {},
});

interface MultiSelectProps extends Omit<AriaComboBoxProps<SelectItemType>, "children" | "items">, RefAttributes<HTMLDivElement> {
    hint?: string;
    label?: string;
    tooltip?: string;
    size?: "sm" | "md";
    placeholder?: string;
    shortcut?: boolean;
    items?: SelectItemType[];
    popoverClassName?: string;
    shortcutClassName?: string;
    selectedItems: ListData<SelectItemType>;
    placeholderIcon?: IconComponentType | null;
    children: AriaListBoxProps<SelectItemType>["children"];
    onItemCleared?: (key: Key) => void;
    onItemInserted?: (key: Key) => void;
}

export const MultiSelectBase = ({
    items,
    children,
    size = "sm",
    selectedItems,
    onItemCleared,
    onItemInserted,
    shortcut,
    placeholder = "Search",
    // Omit these props to avoid conflicts with the `Select` component
    name: _name,
    className: _className,
    ...props
}: MultiSelectProps) => {
    const { contains } = useFilter({ sensitivity: "base" });
    const selectedKeys = selectedItems.items.map((item) => item.id);

    const filter = useCallback(
        (item: SelectItemType, filterText: string) => {
            return !selectedKeys.includes(item.id) && contains(item.label || item.supportingText || "", filterText);
        },
        [contains, selectedKeys],
    );

    const accessibleList = useListData({
        initialItems: items,
        filter,
    });

    const onRemove = useCallback(
        (keys: Set<Key>) => {
            const key = keys.values().next().value;

            if (!key) return;

            selectedItems.remove(key);
            onItemCleared?.(key);
        },
        [selectedItems, onItemCleared],
    );

    const onSelectionChange = (id: Key | null) => {
        if (!id) {
            return;
        }

        const item = accessibleList.getItem(id);

        if (!item) {
            return;
        }

        if (!selectedKeys.includes(id as string)) {
            selectedItems.append(item);
            onItemInserted?.(id);
        }

        accessibleList.setFilterText("");
    };

    const onInputChange = (value: string) => {
        accessibleList.setFilterText(value);
    };

    const placeholderRef = useRef<HTMLDivElement>(null);
    const [popoverWidth, setPopoverWidth] = useState("");

    // Resize observer for popover width
    const onResize = useCallback(() => {
        if (!placeholderRef.current) return;
        let divRect = placeholderRef.current?.getBoundingClientRect();
        setPopoverWidth(divRect.width + "px");
    }, [placeholderRef, setPopoverWidth]);

    useResizeObserver({
        ref: placeholderRef,
        onResize: onResize,
        box: "border-box",
    });

    return (
        <ComboboxContext.Provider
            value={{
                size,
                selectedKeys,
                selectedItems,
                onInputChange,
                onRemove,
            }}
        >
            <AriaComboBox
                allowsEmptyCollection
                menuTrigger="focus"
                items={accessibleList.items}
                onInputChange={onInputChange}
                inputValue={accessibleList.filterText}
                // This keeps the combobox popover open and the input value unchanged when an item is selected.
                selectedKey={null}
                onSelectionChange={onSelectionChange}
                {...props}
            >
                {(state) => (
                    <div className="tw:flex tw:flex-col tw:gap-1.5">
                        {props.label && (
                            <Label isRequired={state.isRequired} tooltip={props.tooltip}>
                                {props.label}
                            </Label>
                        )}

                        <MultiSelectTagsValue
                            size={size}
                            shortcut={shortcut}
                            ref={placeholderRef}
                            placeholder={placeholder}
                            // This is a workaround to correctly calculating the trigger width
                            // while using ResizeObserver wasn't 100% reliable.
                            onFocus={onResize}
                            onPointerEnter={onResize}
                        />

                        <Popover size={"md"} triggerRef={placeholderRef} style={{ width: popoverWidth }} className={props?.popoverClassName}>
                            <AriaListBox selectionMode="multiple" className="tw:size-full tw:outline-hidden">
                                {children}
                            </AriaListBox>
                        </Popover>

                        {props.hint && <HintText isInvalid={state.isInvalid}>{props.hint}</HintText>}
                    </div>
                )}
            </AriaComboBox>
        </ComboboxContext.Provider>
    );
};

const InnerMultiSelect = ({ isDisabled, shortcut, shortcutClassName, placeholder }: Omit<MultiSelectProps, "selectedItems" | "children">) => {
    const focusManager = useFocusManager();
    const comboBoxContext = useContext(ComboboxContext);
    const comboBoxStateContext = useContext(ComboBoxStateContext);

    const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        const isCaretAtStart = event.currentTarget.selectionStart === 0 && event.currentTarget.selectionEnd === 0;

        if (!isCaretAtStart && event.currentTarget.value !== "") {
            return;
        }

        switch (event.key) {
            case "Backspace":
            case "ArrowLeft":
                focusManager?.focusPrevious({ wrap: false, tabbable: false });
                break;
            case "ArrowRight":
                focusManager?.focusNext({ wrap: false, tabbable: false });
                break;
        }
    };

    // Ensure dropdown opens on click even if input is already focused
    const handleInputMouseDown = (_event: React.MouseEvent<HTMLInputElement>) => {
        if (comboBoxStateContext && !comboBoxStateContext.isOpen) {
            comboBoxStateContext.open();
        }
    };

    const handleTagKeyDown = (event: KeyboardEvent<HTMLButtonElement>, value: Key) => {
        // Do nothing when tab is clicked to move focus from the tag to the input element.
        if (event.key === "Tab") {
            return;
        }

        event.preventDefault();

        const isFirstTag = comboBoxContext?.selectedItems?.items?.[0]?.id === value;

        switch (event.key) {
            case " ":
            case "Enter":
            case "Backspace":
                if (isFirstTag) {
                    focusManager?.focusNext({ wrap: false, tabbable: false });
                } else {
                    focusManager?.focusPrevious({ wrap: false, tabbable: false });
                }

                comboBoxContext.onRemove(new Set([value]));
                break;

            case "ArrowLeft":
                focusManager?.focusPrevious({ wrap: false, tabbable: false });
                break;
            case "ArrowRight":
                focusManager?.focusNext({ wrap: false, tabbable: false });
                break;
            case "Escape":
                comboBoxStateContext?.close();
                break;
        }
    };

    const isSelectionEmpty = comboBoxContext?.selectedItems?.items?.length === 0;

    return (
        <div className="tw:relative tw:flex tw:w-full tw:flex-1 tw:flex-row tw:flex-wrap tw:items-center tw:justify-start tw:gap-1.5">
            {!isSelectionEmpty &&
                comboBoxContext?.selectedItems?.items?.map((value) => (
                    <span key={value.id} className="tw:flex tw:items-center tw:rounded-md tw:bg-primary tw:py-0.5 tw:pr-1 tw:pl-1.25 tw:ring-1 tw:ring-primary tw:ring-inset">
                        <Avatar size="xxs" alt={value?.label} src={value?.avatarUrl} />

                        <p className="tw:ml-1.25 tw:truncate tw:text-sm tw:font-medium tw:whitespace-nowrap tw:text-secondary tw:select-none">{value?.label}</p>

                        <TagCloseX
                            size="md"
                            isDisabled={isDisabled}
                            className="tw:ml-0.75"
                            // For workaround, onKeyDown is added to the button
                            onKeyDown={(event) => handleTagKeyDown(event, value.id)}
                            onPress={() => comboBoxContext.onRemove(new Set([value.id]))}
                        />
                    </span>
                ))}

            <div className={cx("tw:relative tw:flex tw:min-w-[20%] tw:flex-1 tw:flex-row tw:items-center", !isSelectionEmpty && "tw:ml-0.5", shortcut && "tw:min-w-[30%]")}>
                <AriaInput
                    placeholder={placeholder}
                    onKeyDown={handleInputKeyDown}
                    onMouseDown={handleInputMouseDown}
                    className="tw:w-full tw:flex-[1_0_0] tw:appearance-none tw:bg-transparent tw:text-md tw:text-ellipsis tw:text-primary tw:caret-alpha-black/90 tw:outline-none tw:placeholder:text-placeholder tw:focus:outline-hidden tw:disabled:cursor-not-allowed tw:disabled:text-disabled tw:disabled:placeholder:text-disabled"
                />

                {shortcut && (
                    <div
                        aria-hidden="true"
                        className={cx(
                            "tw:absolute tw:inset-y-0.5 tw:right-0.5 tw:z-10 tw:flex tw:items-center tw:rounded-r-[inherit] tw:bg-linear-to-r tw:from-transparent tw:to-bg-primary tw:to-40% tw:pl-8",
                            shortcutClassName,
                        )}
                    >
                        <span
                            className={cx(
                                "tw:pointer-events-none tw:rounded tw:px-1 tw:py-px tw:text-xs tw:font-medium tw:text-quaternary tw:ring-1 tw:ring-secondary tw:select-none tw:ring-inset",
                                isDisabled && "tw:bg-transparent tw:text-disabled",
                            )}
                        >
                            ⌘K
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export const MultiSelectTagsValue = ({
    size,
    shortcut,
    placeholder,
    shortcutClassName,
    placeholderIcon: Icon = SearchLg,
    // Omit this prop to avoid invalid HTML attribute warning
    isDisabled: _isDisabled,
    ...otherProps
}: ComboBoxValueProps) => {
    return (
        <AriaGroup
            {...otherProps}
            className={({ isFocusWithin, isDisabled }) =>
                cx(
                    "tw:relative tw:flex tw:w-full tw:items-center tw:gap-2 tw:rounded-lg tw:bg-primary tw:shadow-xs tw:ring-1 tw:ring-primary tw:outline-hidden tw:transition tw:duration-100 tw:ease-linear tw:ring-inset",
                    isDisabled && "tw:cursor-not-allowed tw:bg-disabled_subtle",
                    isFocusWithin && "tw:ring-2 tw:ring-brand",
                    sizes[size].root,
                )
            }
        >
            {({ isDisabled }) => (
                <>
                    {Icon && <Icon className="tw:pointer-events-none tw:size-5 tw:text-fg-quaternary" />}
                    <FocusScope contain={false} autoFocus={false} restoreFocus={false}>
                        <InnerMultiSelect
                            isDisabled={isDisabled}
                            size={size}
                            shortcut={shortcut}
                            shortcutClassName={shortcutClassName}
                            placeholder={placeholder}
                        />
                    </FocusScope>
                </>
            )}
        </AriaGroup>
    );
};

const MultiSelect = MultiSelectBase as typeof MultiSelectBase & {
    Item: typeof SelectItem;
};

MultiSelect.Item = SelectItem;

export { MultiSelect as MultiSelect };
