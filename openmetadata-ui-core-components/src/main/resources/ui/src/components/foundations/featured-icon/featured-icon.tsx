import type { FC, ReactNode, Ref } from "react";
import { isValidElement } from "react";
import { cx, sortCx } from "@/utils/cx";
import { isReactComponent } from "@/utils/is-react-component";

const iconsSizes = {
    sm: "tw:*:data-icon:size-4",
    md: "tw:*:data-icon:size-5",
    lg: "tw:*:data-icon:size-6",
    xl: "tw:*:data-icon:size-7",
};

const styles = sortCx({
    light: {
        base: "tw:rounded-full",
        sizes: {
            sm: "tw:size-8",
            md: "tw:size-10",
            lg: "tw:size-12",
            xl: "tw:size-14",
        },
        colors: {
            brand: "tw:bg-brand-secondary tw:text-featured-icon-light-fg-brand",
            gray: "tw:bg-tertiary tw:text-featured-icon-light-fg-gray",
            error: "tw:bg-error-secondary tw:text-featured-icon-light-fg-error",
            warning: "tw:bg-warning-secondary tw:text-featured-icon-light-fg-warning",
            success: "tw:bg-success-secondary tw:text-featured-icon-light-fg-success",
        },
    },

    gradient: {
        base: "tw:rounded-full tw:text-fg-white before:tw:absolute before:tw:inset-0 before:tw:size-full before:tw:rounded-full before:tw:border before:tw:mask-b-from-0% after:tw:absolute after:tw:block after:tw:rounded-full",
        sizes: {
            sm: "tw:size-8 after:tw:size-6 tw:*:data-icon:size-4",
            md: "tw:size-10 after:tw:size-7 tw:*:data-icon:size-4",
            lg: "tw:size-12 after:tw:size-8 tw:*:data-icon:size-5",
            xl: "tw:size-14 after:tw:size-10 tw:*:data-icon:size-5",
        },
        colors: {
            brand: "before:tw:border-utility-brand-200 before:tw:bg-utility-brand-50 after:tw:bg-brand-solid",
            gray: "before:tw:border-utility-gray-200 before:tw:bg-utility-gray-50 after:tw:bg-secondary-solid",
            error: "before:tw:border-utility-error-200 before:tw:bg-utility-error-50 after:tw:bg-error-solid",
            warning: "before:tw:border-utility-warning-200 before:tw:bg-utility-warning-50 after:tw:bg-warning-solid",
            success: "before:tw:border-utility-success-200 before:tw:bg-utility-success-50 after:tw:bg-success-solid",
        },
    },

    dark: {
        base: "tw:text-fg-white tw:shadow-xs-skeumorphic before:tw:absolute before:tw:inset-px before:tw:border before:tw:border-white/12 before:tw:mask-b-from-0%",
        sizes: {
            sm: "tw:size-8 tw:rounded-md before:tw:rounded-[5px]",
            md: "tw:size-10 tw:rounded-lg before:tw:rounded-[7px]",
            lg: "tw:size-12 tw:rounded-[10px] before:tw:rounded-[9px]",
            xl: "tw:size-14 tw:rounded-xl before:tw:rounded-[11px]",
        },
        colors: {
            brand: "tw:bg-brand-solid before:tw:border-utility-brand-200/12",
            gray: "tw:bg-secondary-solid before:tw:border-utility-gray-200/12",
            error: "tw:bg-error-solid before:tw:border-utility-error-200/12",
            warning: "tw:bg-warning-solid before:tw:border-utility-warning-200/12",
            success: "tw:bg-success-solid before:tw:border-utility-success-200/12",
        },
    },

    modern: {
        base: "tw:bg-primary tw:shadow-xs-skeumorphic tw:ring-1 tw:ring-inset",
        sizes: {
            sm: "tw:size-8 tw:rounded-md",
            md: "tw:size-10 tw:rounded-lg",
            lg: "tw:size-12 tw:rounded-[10px]",
            xl: "tw:size-14 tw:rounded-xl",
        },
        colors: {
            brand: "",
            gray: "tw:text-fg-secondary tw:ring-primary",
            error: "",
            warning: "",
            success: "",
        },
    },
    "modern-neue": {
        base: [
            "tw:bg-primary_alt tw:ring-1 tw:ring-inset before:tw:absolute before:tw:inset-1",
            // Shadow
            "before:tw:shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1),0px_3px_3px_0px_rgba(0,0,0,0.09),1px_8px_5px_0px_rgba(0,0,0,0.05),2px_21px_6px_0px_rgba(0,0,0,0),0px_0px_0px_1px_rgba(0,0,0,0.08),1px_13px_5px_0px_rgba(0,0,0,0.01),0px_-2px_2px_0px_rgba(0,0,0,0.13)_inset] before:tw:ring-1 before:tw:ring-secondary_alt",
        ].join(" "),
        sizes: {
            sm: "tw:size-8 tw:rounded-[8px] before:tw:rounded-[4px]",
            md: "tw:size-10 tw:rounded-[10px] before:tw:rounded-[6px]",
            lg: "tw:size-12 tw:rounded-[12px] before:tw:rounded-[8px]",
            xl: "tw:size-14 tw:rounded-[14px] before:tw:rounded-[10px]",
        },
        colors: {
            brand: "",
            gray: "tw:text-fg-secondary tw:ring-primary",
            error: "",
            warning: "",
            success: "",
        },
    },

    outline: {
        base: "before:tw:absolute before:tw:rounded-full before:tw:border-2 after:tw:absolute after:tw:rounded-full after:tw:border-2",
        sizes: {
            sm: "tw:size-4 before:tw:size-6 after:tw:size-8.5",
            md: "tw:size-5 before:tw:size-7 after:tw:size-9.5",
            lg: "tw:size-6 before:tw:size-8 after:tw:size-10.5",
            xl: "tw:size-7 before:tw:size-9 after:tw:size-11.5",
        },
        colors: {
            brand: "tw:text-fg-brand-primary before:tw:border-fg-brand-primary/30 after:tw:border-fg-brand-primary/10",
            gray: "tw:text-fg-tertiary before:tw:border-fg-tertiary/30 after:tw:border-fg-tertiary/10",
            error: "tw:text-fg-error-primary before:tw:border-fg-error-primary/30 after:tw:border-fg-error-primary/10",
            warning: "tw:text-fg-warning-primary before:tw:border-fg-warning-primary/30 after:tw:border-fg-warning-primary/10",
            success: "tw:text-fg-success-primary before:tw:border-fg-success-primary/30 after:tw:border-fg-success-primary/10",
        },
    },
});

interface FeaturedIconProps {
    ref?: Ref<HTMLDivElement>;
    children?: ReactNode;
    className?: string;
    icon?: FC<{ className?: string }> | ReactNode;
    size?: "sm" | "md" | "lg" | "xl";
    color: "brand" | "gray" | "success" | "warning" | "error";
    theme?: "light" | "gradient" | "dark" | "outline" | "modern" | "modern-neue";
}

export const FeaturedIcon = (props: FeaturedIconProps) => {
    const { size = "sm", theme: variant = "light", color = "brand", icon: Icon, ...otherProps } = props;

    return (
        <div
            {...otherProps}
            data-featured-icon
            className={cx(
                "tw:relative tw:flex tw:shrink-0 tw:items-center tw:justify-center",

                iconsSizes[size],
                styles[variant].base,
                styles[variant].sizes[size],
                styles[variant].colors[color],

                props.className,
            )}
        >
            {isReactComponent(Icon) && <Icon data-icon className="tw:z-1" />}
            {isValidElement(Icon) && <div className="tw:z-1">{Icon}</div>}

            {props.children}
        </div>
    );
};
