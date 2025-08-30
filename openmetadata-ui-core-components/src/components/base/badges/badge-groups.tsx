import type { FC, ReactNode } from "react";
import { isValidElement } from "react";
import { ArrowRight } from "@untitledui/icons";
import { cx, sortCx } from "@/utils/cx";
import { isReactComponent } from "@/utils/is-react-component";

type Size = "md" | "lg";
type Color = "brand" | "warning" | "error" | "gray" | "success";
type Theme = "light" | "modern";
type Align = "leading" | "trailing";

const baseClasses: Record<Theme, { root?: string; addon?: string; icon?: string }> = {
    light: {
        root: "rounded-full ring-1 ring-inset",
        addon: "rounded-full ring-1 ring-inset",
    },
    modern: {
        root: "rounded-[10px] bg-primary text-secondary shadow-xs ring-1 ring-inset ring-primary hover:bg-secondary",
        addon: "flex items-center rounded-md bg-primary shadow-xs ring-1 ring-inset ring-primary",
        icon: "text-utility-gray-500",
    },
};

const getSizeClasses = (
    theme?: Theme,
    text?: boolean,
    icon?: boolean,
): Record<Align, Record<Size, { root?: string; addon?: string; icon?: string; dot?: string }>> => ({
    leading: {
        md: {
            root: cx("py-1 pr-2 pl-1 text-xs font-medium", !text && !icon && "pr-1"),
            addon: cx("px-2 py-0.5", theme === "modern" && "gap-1 px-1.5", text && "mr-2"),
            icon: "ml-1 size-4",
        },
        lg: {
            root: cx("py-1 pr-2 pl-1 text-sm font-medium", !text && !icon && "pr-1"),
            addon: cx("px-2.5 py-0.5", theme === "modern" && "gap-1.5 px-2", text && "mr-2"),
            icon: "ml-1 size-4",
        },
    },
    trailing: {
        md: {
            root: cx("py-1 pr-1 pl-3 text-xs font-medium", theme === "modern" && "pl-2.5"),
            addon: cx("py-0.5 pr-1.5 pl-2", theme === "modern" && "pr-1.5 pl-2", text && "ml-2"),
            icon: "ml-0.5 size-3 stroke-[3px]",
            dot: "mr-1.5",
        },
        lg: {
            root: "py-1 pr-1 pl-3 text-sm font-medium",
            addon: cx("py-0.5 pr-2 pl-2.5", theme === "modern" && "pr-1.5 pl-2", text && "ml-2"),
            icon: "ml-1 size-3 stroke-[3px]",
            dot: "mr-2",
        },
    },
});

const colorClasses: Record<Theme, Record<Color, { root?: string; addon?: string; icon?: string; dot?: string }>> = sortCx({
    light: {
        brand: {
            root: "bg-utility-brand-50 text-utility-brand-700 ring-utility-brand-200 hover:bg-utility-brand-100",
            addon: "bg-primary text-current ring-utility-brand-200",
            icon: "text-utility-brand-500",
        },
        gray: {
            root: "bg-utility-gray-50 text-utility-gray-700 ring-utility-gray-200 hover:bg-utility-gray-100",
            addon: "bg-primary text-current ring-utility-gray-200",
            icon: "text-utility-gray-500",
        },
        error: {
            root: "bg-utility-error-50 text-utility-error-700 ring-utility-error-200 hover:bg-utility-error-100",
            addon: "bg-primary text-current ring-utility-error-200",
            icon: "text-utility-error-500",
        },
        warning: {
            root: "bg-utility-warning-50 text-utility-warning-700 ring-utility-warning-200 hover:bg-utility-warning-100",
            addon: "bg-primary text-current ring-utility-warning-200",
            icon: "text-utility-warning-500",
        },
        success: {
            root: "bg-utility-success-50 text-utility-success-700 ring-utility-success-200 hover:bg-utility-success-100",
            addon: "bg-primary text-current ring-utility-success-200",
            icon: "text-utility-success-500",
        },
    },
    modern: {
        brand: {
            dot: "bg-utility-brand-500 outline-3 -outline-offset-1 outline-utility-brand-100",
        },
        gray: {
            dot: "bg-utility-gray-500 outline-3 -outline-offset-1 outline-utility-gray-100",
        },
        error: {
            dot: "bg-utility-error-500 outline-3 -outline-offset-1 outline-utility-error-100",
        },
        warning: {
            dot: "bg-utility-warning-500 outline-3 -outline-offset-1 outline-utility-warning-100",
        },
        success: {
            dot: "bg-utility-success-500 outline-3 -outline-offset-1 outline-utility-success-100",
        },
    },
});

interface BadgeGroupProps {
    children?: string | ReactNode;
    addonText: string;
    size?: Size;
    color: Color;
    theme?: Theme;
    /**
     * Alignment of the badge addon element.
     */
    align?: Align;
    iconTrailing?: FC<{ className?: string }> | ReactNode;
    className?: string;
}

export const BadgeGroup = ({
    children,
    addonText,
    size = "md",
    color = "brand",
    theme = "light",
    align = "leading",
    className,
    iconTrailing: IconTrailing = ArrowRight,
}: BadgeGroupProps) => {
    const colors = colorClasses[theme][color];
    const sizes = getSizeClasses(theme, !!children, !!IconTrailing)[align][size];

    const rootClasses = cx(
        "inline-flex w-max cursor-pointer items-center transition duration-100 ease-linear",
        baseClasses[theme].root,
        sizes.root,
        colors.root,
        className,
    );
    const addonClasses = cx("inline-flex items-center", baseClasses[theme].addon, sizes.addon, colors.addon);
    const dotClasses = cx("inline-block size-2 shrink-0 rounded-full", sizes.dot, colors.dot);
    const iconClasses = cx(baseClasses[theme].icon, sizes.icon, colors.icon);

    if (align === "trailing") {
        return (
            <div className={rootClasses}>
                {theme === "modern" && <span className={dotClasses} />}

                {children}

                <span className={addonClasses}>
                    {addonText}

                    {/* Trailing icon */}
                    {isReactComponent(IconTrailing) && <IconTrailing className={iconClasses} />}
                    {isValidElement(IconTrailing) && IconTrailing}
                </span>
            </div>
        );
    }

    return (
        <div className={rootClasses}>
            <span className={addonClasses}>
                {theme === "modern" && <span className={dotClasses} />}
                {addonText}
            </span>

            {children}

            {/* Trailing icon */}
            {isReactComponent(IconTrailing) && <IconTrailing className={iconClasses} />}
            {isValidElement(IconTrailing) && IconTrailing}
        </div>
    );
};
