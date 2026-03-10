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
        root: "tw:rounded-full tw:ring-1 tw:ring-inset",
        addon: "tw:rounded-full tw:ring-1 tw:ring-inset",
    },
    modern: {
        root: "tw:rounded-[10px] tw:bg-primary tw:text-secondary tw:shadow-xs tw:ring-1 tw:ring-inset tw:ring-primary tw:hover:bg-secondary",
        addon: "tw:flex tw:items-center tw:rounded-md tw:bg-primary tw:shadow-xs tw:ring-1 tw:ring-inset tw:ring-primary",
        icon: "tw:text-utility-gray-500",
    },
};

const getSizeClasses = (
    theme?: Theme,
    text?: boolean,
    icon?: boolean,
): Record<Align, Record<Size, { root?: string; addon?: string; icon?: string; dot?: string }>> => ({
    leading: {
        md: {
            root: cx("tw:py-1 tw:pr-2 tw:pl-1 tw:text-xs tw:font-medium", !text && !icon && "tw:pr-1"),
            addon: cx("tw:px-2 tw:py-0.5", theme === "modern" && "tw:gap-1 tw:px-1.5", text && "tw:mr-2"),
            icon: "tw:ml-1 tw:size-4",
        },
        lg: {
            root: cx("tw:py-1 tw:pr-2 tw:pl-1 tw:text-sm tw:font-medium", !text && !icon && "tw:pr-1"),
            addon: cx("tw:px-2.5 tw:py-0.5", theme === "modern" && "tw:gap-1.5 tw:px-2", text && "tw:mr-2"),
            icon: "tw:ml-1 tw:size-4",
        },
    },
    trailing: {
        md: {
            root: cx("tw:py-1 tw:pr-1 tw:pl-3 tw:text-xs tw:font-medium", theme === "modern" && "tw:pl-2.5"),
            addon: cx("tw:py-0.5 tw:pr-1.5 tw:pl-2", theme === "modern" && "tw:pr-1.5 tw:pl-2", text && "tw:ml-2"),
            icon: "tw:ml-0.5 tw:size-3 tw:stroke-[3px]",
            dot: "tw:mr-1.5",
        },
        lg: {
            root: "tw:py-1 tw:pr-1 tw:pl-3 tw:text-sm tw:font-medium",
            addon: cx("tw:py-0.5 tw:pr-2 tw:pl-2.5", theme === "modern" && "tw:pr-1.5 tw:pl-2", text && "tw:ml-2"),
            icon: "tw:ml-1 tw:size-3 tw:stroke-[3px]",
            dot: "tw:mr-2",
        },
    },
});

const colorClasses: Record<Theme, Record<Color, { root?: string; addon?: string; icon?: string; dot?: string }>> = sortCx({
    light: {
        brand: {
            root: "tw:bg-utility-brand-50 tw:text-utility-brand-700 tw:ring-utility-brand-200 tw:hover:bg-utility-brand-100",
            addon: "tw:bg-primary tw:text-current tw:ring-utility-brand-200",
            icon: "tw:text-utility-brand-500",
        },
        gray: {
            root: "tw:bg-utility-gray-50 tw:text-utility-gray-700 tw:ring-utility-gray-200 tw:hover:bg-utility-gray-100",
            addon: "tw:bg-primary tw:text-current tw:ring-utility-gray-200",
            icon: "tw:text-utility-gray-500",
        },
        error: {
            root: "tw:bg-utility-error-50 tw:text-utility-error-700 tw:ring-utility-error-200 tw:hover:bg-utility-error-100",
            addon: "tw:bg-primary tw:text-current tw:ring-utility-error-200",
            icon: "tw:text-utility-error-500",
        },
        warning: {
            root: "tw:bg-utility-warning-50 tw:text-utility-warning-700 tw:ring-utility-warning-200 tw:hover:bg-utility-warning-100",
            addon: "tw:bg-primary tw:text-current tw:ring-utility-warning-200",
            icon: "tw:text-utility-warning-500",
        },
        success: {
            root: "tw:bg-utility-success-50 tw:text-utility-success-700 tw:ring-utility-success-200 tw:hover:bg-utility-success-100",
            addon: "tw:bg-primary tw:text-current tw:ring-utility-success-200",
            icon: "tw:text-utility-success-500",
        },
    },
    modern: {
        brand: {
            dot: "tw:bg-utility-brand-500 tw:outline-3 tw:-outline-offset-1 tw:outline-utility-brand-100",
        },
        gray: {
            dot: "tw:bg-utility-gray-500 tw:outline-3 tw:-outline-offset-1 tw:outline-utility-gray-100",
        },
        error: {
            dot: "tw:bg-utility-error-500 tw:outline-3 tw:-outline-offset-1 tw:outline-utility-error-100",
        },
        warning: {
            dot: "tw:bg-utility-warning-500 tw:outline-3 tw:-outline-offset-1 tw:outline-utility-warning-100",
        },
        success: {
            dot: "tw:bg-utility-success-500 tw:outline-3 tw:-outline-offset-1 tw:outline-utility-success-100",
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
        "tw:inline-flex tw:w-max tw:cursor-pointer tw:items-center tw:transition tw:duration-100 tw:ease-linear",
        baseClasses[theme].root,
        sizes.root,
        colors.root,
        className,
    );
    const addonClasses = cx("tw:inline-flex tw:items-center", baseClasses[theme].addon, sizes.addon, colors.addon);
    const dotClasses = cx("tw:inline-block tw:size-2 tw:shrink-0 tw:rounded-full", sizes.dot, colors.dot);
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
