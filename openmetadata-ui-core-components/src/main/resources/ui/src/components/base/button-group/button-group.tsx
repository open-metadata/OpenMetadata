import { type FC, type PropsWithChildren, type ReactNode, type RefAttributes, createContext, isValidElement, useContext } from "react";
import {
    ToggleButton as AriaToggleButton,
    ToggleButtonGroup as AriaToggleButtonGroup,
    type ToggleButtonGroupProps,
    type ToggleButtonProps,
} from "react-aria-components";
import { cx, sortCx } from "@/utils/cx";
import { isReactComponent } from "@/utils/is-react-component";

export const styles = sortCx({
    common: {
        root: [
            "tw:group/button-group tw:inline-flex tw:h-max tw:cursor-pointer tw:items-center tw:bg-primary tw:font-semibold tw:whitespace-nowrap tw:text-secondary tw:shadow-skeumorphic tw:ring-1 tw:ring-primary tw:outline-brand tw:transition tw:duration-100 tw:ease-linear tw:ring-inset",
            // Hover and focus styles
            "tw:hover:bg-primary_hover tw:hover:text-secondary_hover tw:focus-visible:z-10 tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2",
            // Disabled styles
            "tw:disabled:cursor-not-allowed tw:disabled:bg-primary tw:disabled:text-disabled",
            // Selected styles
            "tw:selected:bg-active tw:selected:text-secondary_hover tw:selected:disabled:bg-disabled_subtle",
        ].join(" "),
        icon: "tw:pointer-events-none tw:text-fg-quaternary tw:transition-[inherit] group-hover/button-group:tw:text-fg-quaternary_hover group-disabled/button-group:tw:text-fg-disabled_subtle",
    },

    sizes: {
        sm: {
            root: "tw:gap-1.5 tw:px-3.5 tw:py-2 tw:text-sm tw:not-last:pr-[calc(calc(var(--spacing)*3.5)+1px)] tw:first:rounded-l-lg tw:last:rounded-r-lg tw:data-icon-leading:pl-3 tw:data-icon-only:p-2",
            icon: "tw:size-5",
        },
        md: {
            root: "tw:gap-1.5 tw:px-4 tw:py-2.5 tw:text-sm tw:not-last:pr-[calc(calc(var(--spacing)*4)+1px)] tw:first:rounded-l-lg tw:last:rounded-r-lg tw:data-icon-leading:pl-3.5 tw:data-icon-only:px-3",
            icon: "tw:size-5",
        },
        lg: {
            root: "tw:gap-2 tw:px-4.5 tw:py-2.5 tw:text-md tw:not-last:pr-[calc(calc(var(--spacing)*4.5)+1px)] tw:first:rounded-l-lg tw:last:rounded-r-lg tw:data-icon-leading:pl-4 tw:data-icon-only:p-3",
            icon: "tw:size-5",
        },
    },
});

type ButtonSize = keyof typeof styles.sizes;

const ButtonGroupContext = createContext<{ size: ButtonSize }>({ size: "md" });

interface ButtonGroupItemProps extends ToggleButtonProps, RefAttributes<HTMLButtonElement> {
    iconLeading?: FC<{ className?: string }> | ReactNode;
    iconTrailing?: FC<{ className?: string }> | ReactNode;
    onClick?: () => void;
    className?: string;
}

export const ButtonGroupItem = ({
    iconLeading: IconLeading,
    iconTrailing: IconTrailing,
    children,
    className,
    ...otherProps
}: PropsWithChildren<ButtonGroupItemProps>) => {
    const context = useContext(ButtonGroupContext);

    if (!context) {
        throw new Error("ButtonGroupItem must be used within a ButtonGroup component");
    }

    const { size } = context;

    const isIcon = (IconLeading || IconTrailing) && !children;

    return (
        <AriaToggleButton
            {...otherProps}
            data-icon-only={isIcon ? true : undefined}
            data-icon-leading={IconLeading ? true : undefined}
            className={cx(styles.common.root, styles.sizes[size].root, className)}
        >
            {isReactComponent(IconLeading) && <IconLeading className={cx(styles.common.icon, styles.sizes[size].icon)} />}
            {isValidElement(IconLeading) && IconLeading}

            {children}

            {isReactComponent(IconTrailing) && <IconTrailing className={cx(styles.common.icon, styles.sizes[size].icon)} />}
            {isValidElement(IconTrailing) && IconTrailing}
        </AriaToggleButton>
    );
};

interface ButtonGroupProps extends Omit<ToggleButtonGroupProps, "orientation">, RefAttributes<HTMLDivElement> {
    size?: ButtonSize;
    className?: string;
}

export const ButtonGroup = ({ children, size = "md", className, ...otherProps }: ButtonGroupProps) => {
    return (
        <ButtonGroupContext.Provider value={{ size }}>
            <AriaToggleButtonGroup
                selectionMode="single"
                className={cx("tw:relative tw:z-0 tw:inline-flex tw:w-max tw:-space-x-px tw:rounded-lg tw:shadow-xs", className)}
                {...otherProps}
            >
                {children}
            </AriaToggleButtonGroup>
        </ButtonGroupContext.Provider>
    );
};
