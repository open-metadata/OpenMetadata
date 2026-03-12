import { Avatar } from "@/components/base/avatar/avatar";
import { SelectContext } from "@/components/base/select/select";
import type { SelectItemType } from "@/components/base/select/select";
import { cx } from "@/utils/cx";
import { isReactComponent } from "@/utils/is-react-component";
import { Check } from "@untitledui/icons";
import type { ReactNode } from "react";
import { isValidElement, useContext } from "react";
import type { ListBoxItemProps as AriaListBoxItemProps, ListBoxItemRenderProps } from "react-aria-components";
import { ListBoxItem as AriaListBoxItem, Text as AriaText } from "react-aria-components";

const sizes = {
    sm: "tw:p-2 tw:pr-2.5",
    md: "tw:p-2.5 tw:pl-2",
};

const itemWrapperBase = "tw:flex tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-md tw:outline-hidden tw:select-none";

const itemWrapperClass = (state: ListBoxItemRenderProps, size: "sm" | "md", extraClass?: string) =>
    cx(
        itemWrapperBase,
        state.isSelected && "tw:bg-active",
        state.isDisabled && "tw:cursor-not-allowed",
        state.isFocused && "tw:bg-primary_hover",
        state.isFocusVisible && "tw:ring-2 tw:ring-focus-ring tw:ring-inset",
        sizes[size],
        extraClass,
    );

const checkClass = (size: "sm" | "md", isDisabled: boolean) =>
    cx(
        "tw:ml-auto tw:shrink-0 tw:text-fg-brand-primary",
        size === "sm" ? "tw:size-4 tw:stroke-[2.5px]" : "tw:size-5",
        isDisabled && "tw:text-fg-disabled",
    );

interface AutocompleteItemProps extends Omit<AriaListBoxItemProps<SelectItemType>, "id" | "children">, Omit<SelectItemType, "id"> {
    id: string;
    "data-testid"?: string;
    children?: ReactNode | ((state: ListBoxItemRenderProps) => ReactNode);
}

const renderItemIcon = (avatarUrl: string | undefined, Icon: SelectItemType["icon"], label: string | undefined) => {
    if (avatarUrl) {
        return <Avatar aria-hidden="true" size="xs" src={avatarUrl} alt={label} />;
    }
    if (isReactComponent(Icon)) {
        return <Icon data-icon aria-hidden="true" />;
    }
    if (isValidElement(Icon)) {
        return Icon;
    }
    return null;
};

interface DefaultItemContentProps {
    state: ListBoxItemRenderProps;
    size: "sm" | "md";
    label: string | undefined;
    avatarUrl: string | undefined;
    supportingText: string | undefined;
    icon: SelectItemType["icon"];
    dataTestId: string | undefined;
    stringChild: string;
}

const DefaultItemContent = ({ state, size, label, avatarUrl, supportingText, icon, dataTestId, stringChild }: DefaultItemContentProps) => (
    <div
        data-testid={dataTestId}
        className={itemWrapperClass(state, size, cx(
            "tw:*:data-icon:size-5 tw:*:data-icon:shrink-0 tw:*:data-icon:text-fg-quaternary",
            state.isDisabled && "tw:*:data-icon:text-fg-disabled",
        ))}
    >
        {renderItemIcon(avatarUrl, icon, label)}

        <div className="tw:flex tw:w-full tw:min-w-0 tw:flex-1 tw:flex-wrap tw:gap-x-2">
            <AriaText
                slot="label"
                className={cx("tw:truncate tw:text-md tw:font-medium tw:whitespace-nowrap tw:text-primary", state.isDisabled && "tw:text-disabled")}
            >
                {label || stringChild}
            </AriaText>

            {supportingText && (
                <AriaText slot="description" className={cx("tw:text-md tw:whitespace-nowrap tw:text-tertiary", state.isDisabled && "tw:text-disabled")}>
                    {supportingText}
                </AriaText>
            )}
        </div>

        {state.isSelected && <Check aria-hidden="true" className={checkClass(size, state.isDisabled)} />}
    </div>
);

interface CustomItemContentProps {
    state: ListBoxItemRenderProps;
    size: "sm" | "md";
    dataTestId: string | undefined;
    children: ReactNode | ((state: ListBoxItemRenderProps) => ReactNode);
}

const CustomItemContent = ({ state, size, dataTestId, children }: CustomItemContentProps) => (
    <div data-testid={dataTestId} className={itemWrapperClass(state, size)}>
        {typeof children === "function" ? children(state) : children}
        {state.isSelected && <Check aria-hidden="true" className={checkClass(size, state.isDisabled)} />}
    </div>
);

export const AutocompleteItem = ({ label, id, value, avatarUrl, supportingText, isDisabled, icon: Icon, className, children, "data-testid": dataTestId, ...props }: AutocompleteItemProps) => {
    const { size } = useContext(SelectContext);

    const stringChild = typeof children === "string" ? children : "";
    const labelOrChildren = label || stringChild;
    const textValue = supportingText ? labelOrChildren + " " + supportingText : labelOrChildren;
    const hasCustomChildren = Boolean(children) && typeof children !== "string";

    return (
        <AriaListBoxItem
            id={id}
            value={value ?? { id, label: labelOrChildren, avatarUrl, supportingText, isDisabled, icon: Icon }}
            textValue={textValue}
            isDisabled={isDisabled}
            {...props}
            className={(state) => cx("tw:w-full tw:px-1.5 tw:py-px tw:outline-hidden", typeof className === "function" ? className(state) : className)}
        >
            {(state) =>
                hasCustomChildren ? (
                    <CustomItemContent dataTestId={dataTestId} size={size} state={state}>
                        {children as ReactNode | ((state: ListBoxItemRenderProps) => ReactNode)}
                    </CustomItemContent>
                ) : (
                    <DefaultItemContent
                        avatarUrl={avatarUrl}
                        dataTestId={dataTestId}
                        icon={Icon}
                        label={label}
                        size={size}
                        state={state}
                        stringChild={stringChild}
                        supportingText={supportingText}
                    />
                )
            }
        </AriaListBoxItem>
    );
};
