import type { MouseEventHandler, ReactNode } from "react";
import { X as CloseX } from "@untitledui/icons";
import { Dot } from "@/components/foundations/dot-icon";
import { cx } from "@/utils/cx";
import type { BadgeColors, BadgeTypeToColorMap, BadgeTypes, FlagTypes, IconComponentType, Sizes } from "./badge-types";
import { badgeTypes } from "./badge-types";

export const filledColors: Record<BadgeColors, { root: string; addon: string; addonButton: string }> = {
    gray: {
        root: "tw:bg-utility-gray-50 tw:text-utility-gray-700 tw:ring-utility-gray-200",
        addon: "tw:text-utility-gray-500",
        addonButton: "tw:hover:bg-utility-gray-100 tw:text-utility-gray-400 tw:hover:text-utility-gray-500",
    },
    brand: {
        root: "tw:bg-utility-brand-50 tw:text-utility-brand-700 tw:ring-utility-brand-200",
        addon: "tw:text-utility-brand-500",
        addonButton: "tw:hover:bg-utility-brand-100 tw:text-utility-brand-400 tw:hover:text-utility-brand-500",
    },
    error: {
        root: "tw:bg-utility-error-50 tw:text-utility-error-700 tw:ring-utility-error-200",
        addon: "tw:text-utility-error-500",
        addonButton: "tw:hover:bg-utility-error-100 tw:text-utility-error-400 tw:hover:text-utility-error-500",
    },
    warning: {
        root: "tw:bg-utility-warning-50 tw:text-utility-warning-700 tw:ring-utility-warning-200",
        addon: "tw:text-utility-warning-500",
        addonButton: "tw:hover:bg-utility-warning-100 tw:text-utility-warning-400 tw:hover:text-utility-warning-500",
    },
    success: {
        root: "tw:bg-utility-success-50 tw:text-utility-success-700 tw:ring-utility-success-200",
        addon: "tw:text-utility-success-500",
        addonButton: "tw:hover:bg-utility-success-100 tw:text-utility-success-400 tw:hover:text-utility-success-500",
    },
    "gray-blue": {
        root: "tw:bg-utility-gray-blue-50 tw:text-utility-gray-blue-700 tw:ring-utility-gray-blue-200",
        addon: "tw:text-utility-gray-blue-500",
        addonButton: "tw:hover:bg-utility-gray-blue-100 tw:text-utility-gray-blue-400 tw:hover:text-utility-gray-blue-500",
    },
    "blue-light": {
        root: "tw:bg-utility-blue-light-50 tw:text-utility-blue-light-700 tw:ring-utility-blue-light-200",
        addon: "tw:text-utility-blue-light-500",
        addonButton: "tw:hover:bg-utility-blue-light-100 tw:text-utility-blue-light-400 tw:hover:text-utility-blue-light-500",
    },
    blue: {
        root: "tw:bg-utility-blue-50 tw:text-utility-blue-700 tw:ring-utility-blue-200",
        addon: "tw:text-utility-blue-500",
        addonButton: "tw:hover:bg-utility-blue-100 tw:text-utility-blue-400 tw:hover:text-utility-blue-500",
    },
    indigo: {
        root: "tw:bg-utility-indigo-50 tw:text-utility-indigo-700 tw:ring-utility-indigo-200",
        addon: "tw:text-utility-indigo-500",
        addonButton: "tw:hover:bg-utility-indigo-100 tw:text-utility-indigo-400 tw:hover:text-utility-indigo-500",
    },
    purple: {
        root: "tw:bg-utility-purple-50 tw:text-utility-purple-700 tw:ring-utility-purple-200",
        addon: "tw:text-utility-purple-500",
        addonButton: "tw:hover:bg-utility-purple-100 tw:text-utility-purple-400 tw:hover:text-utility-purple-500",
    },
    pink: {
        root: "tw:bg-utility-pink-50 tw:text-utility-pink-700 tw:ring-utility-pink-200",
        addon: "tw:text-utility-pink-500",
        addonButton: "tw:hover:bg-utility-pink-100 tw:text-utility-pink-400 tw:hover:text-utility-pink-500",
    },
    orange: {
        root: "tw:bg-utility-orange-50 tw:text-utility-orange-700 tw:ring-utility-orange-200",
        addon: "tw:text-utility-orange-500",
        addonButton: "tw:hover:bg-utility-orange-100 tw:text-utility-orange-400 tw:hover:text-utility-orange-500",
    },
};

const addonOnlyColors = Object.fromEntries(Object.entries(filledColors).map(([key, value]) => [key, { root: "", addon: value.addon }])) as Record<
    BadgeColors,
    { root: string; addon: string }
>;

const withPillTypes = {
    [badgeTypes.pillColor]: {
        common: "tw:size-max tw:flex tw:items-center tw:whitespace-nowrap tw:rounded-full tw:ring-1 tw:ring-inset",
        styles: filledColors,
    },
    [badgeTypes.badgeColor]: {
        common: "tw:size-max tw:flex tw:items-center tw:whitespace-nowrap tw:rounded-md tw:ring-1 tw:ring-inset",
        styles: filledColors,
    },
    [badgeTypes.badgeModern]: {
        common: "tw:size-max tw:flex tw:items-center tw:whitespace-nowrap tw:rounded-md tw:ring-1 tw:ring-inset tw:shadow-xs",
        styles: {
            gray: {
                root: "tw:bg-primary tw:text-secondary tw:ring-primary",
                addon: "tw:text-gray-500",
                addonButton: "tw:hover:bg-utility-gray-100 tw:text-utility-gray-400 tw:hover:text-utility-gray-500",
            },
        },
    },
};

const withBadgeTypes = {
    [badgeTypes.pillColor]: {
        common: "tw:size-max tw:flex tw:items-center tw:whitespace-nowrap tw:rounded-full tw:ring-1 tw:ring-inset",
        styles: filledColors,
    },
    [badgeTypes.badgeColor]: {
        common: "tw:size-max tw:flex tw:items-center tw:whitespace-nowrap tw:rounded-md tw:ring-1 tw:ring-inset",
        styles: filledColors,
    },
    [badgeTypes.badgeModern]: {
        common: "tw:size-max tw:flex tw:items-center tw:whitespace-nowrap tw:rounded-md tw:ring-1 tw:ring-inset tw:bg-primary tw:text-secondary tw:ring-primary tw:shadow-xs",
        styles: addonOnlyColors,
    },
};

export type BadgeColor<T extends BadgeTypes> = BadgeTypeToColorMap<typeof withPillTypes>[T];

interface BadgeProps<T extends BadgeTypes> {
    type?: T;
    size?: Sizes;
    color?: BadgeColor<T>;
    children: ReactNode;
    className?: string;
}

export const Badge = <T extends BadgeTypes>(props: BadgeProps<T>) => {
    const { type = "pill-color", size = "md", color = "gray", children } = props;
    const colors = withPillTypes[type];

    const pillSizes = {
        sm: "tw:py-0.5 tw:px-2 tw:text-xs tw:font-medium",
        md: "tw:py-0.5 tw:px-2.5 tw:text-sm tw:font-medium",
        lg: "tw:py-1 tw:px-3 tw:text-sm tw:font-medium",
    };
    const badgeSizes = {
        sm: "tw:py-0.5 tw:px-1.5 tw:text-xs tw:font-medium",
        md: "tw:py-0.5 tw:px-2 tw:text-sm tw:font-medium",
        lg: "tw:py-1 tw:px-2.5 tw:text-sm tw:font-medium tw:rounded-lg",
    };

    const sizes = {
        [badgeTypes.pillColor]: pillSizes,
        [badgeTypes.badgeColor]: badgeSizes,
        [badgeTypes.badgeModern]: badgeSizes,
    };

    return <span className={cx(colors.common, sizes[type][size], colors.styles[color].root, props.className)}>{children}</span>;
};

interface BadgeWithDotProps<T extends BadgeTypes> {
    type?: T;
    size?: Sizes;
    color?: BadgeTypeToColorMap<typeof withBadgeTypes>[T];
    className?: string;
    children: ReactNode;
}

export const BadgeWithDot = <T extends BadgeTypes>(props: BadgeWithDotProps<T>) => {
    const { size = "md", color = "gray", type = "pill-color", className, children } = props;

    const colors = withBadgeTypes[type];

    const pillSizes = {
        sm: "tw:gap-1 tw:py-0.5 tw:pl-1.5 tw:pr-2 tw:text-xs tw:font-medium",
        md: "tw:gap-1.5 tw:py-0.5 tw:pl-2 tw:pr-2.5 tw:text-sm tw:font-medium",
        lg: "tw:gap-1.5 tw:py-1 tw:pl-2.5 tw:pr-3 tw:text-sm tw:font-medium",
    };

    const badgeSizes = {
        sm: "tw:gap-1 tw:py-0.5 tw:px-1.5 tw:text-xs tw:font-medium",
        md: "tw:gap-1.5 tw:py-0.5 tw:px-2 tw:text-sm tw:font-medium",
        lg: "tw:gap-1.5 tw:py-1 tw:px-2.5 tw:text-sm tw:font-medium tw:rounded-lg",
    };

    const sizes = {
        [badgeTypes.pillColor]: pillSizes,
        [badgeTypes.badgeColor]: badgeSizes,
        [badgeTypes.badgeModern]: badgeSizes,
    };

    return (
        <span className={cx(colors.common, sizes[type][size], colors.styles[color].root, className)}>
            <Dot className={colors.styles[color].addon} size="sm" />
            {children}
        </span>
    );
};

interface BadgeWithIconProps<T extends BadgeTypes> {
    type?: T;
    size?: Sizes;
    color?: BadgeTypeToColorMap<typeof withBadgeTypes>[T];
    iconLeading?: IconComponentType;
    iconTrailing?: IconComponentType;
    children: ReactNode;
    className?: string;
}

export const BadgeWithIcon = <T extends BadgeTypes>(props: BadgeWithIconProps<T>) => {
    const { size = "md", color = "gray", type = "pill-color", iconLeading: IconLeading, iconTrailing: IconTrailing, children, className } = props;

    const colors = withBadgeTypes[type];

    const icon = IconLeading ? "leading" : "trailing";

    const pillSizes = {
        sm: {
            trailing: "tw:gap-0.5 tw:py-0.5 tw:pl-2 tw:pr-1.5 tw:text-xs tw:font-medium",
            leading: "tw:gap-0.5 tw:py-0.5 tw:pr-2 tw:pl-1.5 tw:text-xs tw:font-medium",
        },
        md: {
            trailing: "tw:gap-1 tw:py-0.5 tw:pl-2.5 tw:pr-2 tw:text-sm tw:font-medium",
            leading: "tw:gap-1 tw:py-0.5 tw:pr-2.5 tw:pl-2 tw:text-sm tw:font-medium",
        },
        lg: {
            trailing: "tw:gap-1 tw:py-1 tw:pl-3 tw:pr-2.5 tw:text-sm tw:font-medium",
            leading: "tw:gap-1 tw:py-1 tw:pr-3 tw:pl-2.5 tw:text-sm tw:font-medium",
        },
    };
    const badgeSizes = {
        sm: {
            trailing: "tw:gap-0.5 tw:py-0.5 tw:pl-2 tw:pr-1.5 tw:text-xs tw:font-medium",
            leading: "tw:gap-0.5 tw:py-0.5 tw:pr-2 tw:pl-1.5 tw:text-xs tw:font-medium",
        },
        md: {
            trailing: "tw:gap-1 tw:py-0.5 tw:pl-2 tw:pr-1.5 tw:text-sm tw:font-medium",
            leading: "tw:gap-1 tw:py-0.5 tw:pr-2 tw:pl-1.5 tw:text-sm tw:font-medium",
        },
        lg: {
            trailing: "tw:gap-1 tw:py-1 tw:pl-2.5 tw:pr-2 tw:text-sm tw:font-medium tw:rounded-lg",
            leading: "tw:gap-1 tw:py-1 tw:pr-2.5 tw:pl-2 tw:text-sm tw:font-medium tw:rounded-lg",
        },
    };

    const sizes = {
        [badgeTypes.pillColor]: pillSizes,
        [badgeTypes.badgeColor]: badgeSizes,
        [badgeTypes.badgeModern]: badgeSizes,
    };

    return (
        <span className={cx(colors.common, sizes[type][size][icon], colors.styles[color].root, className)}>
            {IconLeading && <IconLeading className={cx(colors.styles[color].addon, "tw:size-3 tw:stroke-3")} />}
            {children}
            {IconTrailing && <IconTrailing className={cx(colors.styles[color].addon, "tw:size-3 tw:stroke-3")} />}
        </span>
    );
};

interface BadgeWithFlagProps<T extends BadgeTypes> {
    type?: T;
    size?: Sizes;
    flag?: FlagTypes;
    color?: BadgeTypeToColorMap<typeof withPillTypes>[T];
    children: ReactNode;
}

export const BadgeWithFlag = <T extends BadgeTypes>(props: BadgeWithFlagProps<T>) => {
    const { size = "md", color = "gray", flag = "AU", type = "pill-color", children } = props;

    const colors = withPillTypes[type];

    const pillSizes = {
        sm: "tw:gap-1 tw:py-0.5 tw:pl-0.75 tw:pr-2 tw:text-xs tw:font-medium",
        md: "tw:gap-1.5 tw:py-0.5 tw:pl-1 tw:pr-2.5 tw:text-sm tw:font-medium",
        lg: "tw:gap-1.5 tw:py-1 tw:pl-1.5 tw:pr-3 tw:text-sm tw:font-medium",
    };
    const badgeSizes = {
        sm: "tw:gap-1 tw:py-0.5 tw:pl-1 tw:pr-1.5 tw:text-xs tw:font-medium",
        md: "tw:gap-1.5 tw:py-0.5 tw:pl-1.5 tw:pr-2 tw:text-sm tw:font-medium",
        lg: "tw:gap-1.5 tw:py-1 tw:pl-2 tw:pr-2.5 tw:text-sm tw:font-medium tw:rounded-lg",
    };

    const sizes = {
        [badgeTypes.pillColor]: pillSizes,
        [badgeTypes.badgeColor]: badgeSizes,
        [badgeTypes.badgeModern]: badgeSizes,
    };

    return (
        <span className={cx(colors.common, sizes[type][size], colors.styles[color].root)}>
            <img src={`https://www.untitledui.com/images/flags/${flag}.svg`} className="tw:size-4 tw:max-w-none tw:rounded-full" alt={`${flag} flag`} />
            {children}
        </span>
    );
};

interface BadgeWithImageProps<T extends BadgeTypes> {
    type?: T;
    size?: Sizes;
    imgSrc: string;
    color?: BadgeTypeToColorMap<typeof withPillTypes>[T];
    children: ReactNode;
}

export const BadgeWithImage = <T extends BadgeTypes>(props: BadgeWithImageProps<T>) => {
    const { size = "md", color = "gray", type = "pill-color", imgSrc, children } = props;

    const colors = withPillTypes[type];

    const pillSizes = {
        sm: "tw:gap-1 tw:py-0.5 tw:pl-0.75 tw:pr-2 tw:text-xs tw:font-medium",
        md: "tw:gap-1.5 tw:py-0.5 tw:pl-1 tw:pr-2.5 tw:text-sm tw:font-medium",
        lg: "tw:gap-1.5 tw:py-1 tw:pl-1.5 tw:pr-3 tw:text-sm tw:font-medium",
    };
    const badgeSizes = {
        sm: "tw:gap-1 tw:py-0.5 tw:pl-1 tw:pr-1.5 tw:text-xs tw:font-medium",
        md: "tw:gap-1.5 tw:py-0.5 tw:pl-1.5 tw:pr-2 tw:text-sm tw:font-medium",
        lg: "tw:gap-1.5 tw:py-1 tw:pl-2 tw:pr-2.5 tw:text-sm tw:font-medium tw:rounded-lg",
    };

    const sizes = {
        [badgeTypes.pillColor]: pillSizes,
        [badgeTypes.badgeColor]: badgeSizes,
        [badgeTypes.badgeModern]: badgeSizes,
    };

    return (
        <span className={cx(colors.common, sizes[type][size], colors.styles[color].root)}>
            <img src={imgSrc} className="tw:size-4 tw:max-w-none tw:rounded-full" alt="Badge image" />
            {children}
        </span>
    );
};

interface BadgeWithButtonProps<T extends BadgeTypes> {
    type?: T;
    size?: Sizes;
    icon?: IconComponentType;
    color?: BadgeTypeToColorMap<typeof withPillTypes>[T];
    children: ReactNode;
    /**
     * The label for the button.
     */
    buttonLabel?: string;
    /**
     * The click event handler for the button.
     */
    onButtonClick?: MouseEventHandler<HTMLButtonElement>;
}

export const BadgeWithButton = <T extends BadgeTypes>(props: BadgeWithButtonProps<T>) => {
    const { size = "md", color = "gray", type = "pill-color", icon: Icon = CloseX, buttonLabel, children } = props;

    const colors = withPillTypes[type];

    const pillSizes = {
        sm: "tw:gap-0.5 tw:py-0.5 tw:pl-2 tw:pr-0.75 tw:text-xs tw:font-medium",
        md: "tw:gap-0.5 tw:py-0.5 tw:pl-2.5 tw:pr-1 tw:text-sm tw:font-medium",
        lg: "tw:gap-0.5 tw:py-1 tw:pl-3 tw:pr-1.5 tw:text-sm tw:font-medium",
    };
    const badgeSizes = {
        sm: "tw:gap-0.5 tw:py-0.5 tw:pl-1.5 tw:pr-0.75 tw:text-xs tw:font-medium",
        md: "tw:gap-0.5 tw:py-0.5 tw:pl-2 tw:pr-1 tw:text-sm tw:font-medium",
        lg: "tw:gap-0.5 tw:py-1 tw:pl-2.5 tw:pr-1.5 tw:text-sm tw:font-medium tw:rounded-lg",
    };

    const sizes = {
        [badgeTypes.pillColor]: pillSizes,
        [badgeTypes.badgeColor]: badgeSizes,
        [badgeTypes.badgeModern]: badgeSizes,
    };

    return (
        <span className={cx(colors.common, sizes[type][size], colors.styles[color].root)}>
            {children}
            <button
                type="button"
                aria-label={buttonLabel}
                onClick={props.onButtonClick}
                className={cx(
                    "tw:flex tw:cursor-pointer tw:items-center tw:justify-center tw:p-0.5 tw:outline-focus-ring tw:transition tw:duration-100 tw:ease-linear tw:focus-visible:outline-2",
                    colors.styles[color].addonButton,
                    type === "pill-color" ? "tw:rounded-full" : "tw:rounded-[3px]",
                )}
            >
                <Icon className="tw:size-3 tw:stroke-[3px] tw:transition-inherit-all" />
            </button>
        </span>
    );
};

interface BadgeIconProps<T extends BadgeTypes> {
    type?: T;
    size?: Sizes;
    icon: IconComponentType;
    color?: BadgeTypeToColorMap<typeof withPillTypes>[T];
    children?: ReactNode;
}

export const BadgeIcon = <T extends BadgeTypes>(props: BadgeIconProps<T>) => {
    const { size = "md", color = "gray", type = "pill-color", icon: Icon } = props;

    const colors = withPillTypes[type];

    const pillSizes = {
        sm: "tw:p-1.25",
        md: "tw:p-1.5",
        lg: "tw:p-2",
    };

    const badgeSizes = {
        sm: "tw:p-1.25",
        md: "tw:p-1.5",
        lg: "tw:p-2 tw:rounded-lg",
    };

    const sizes = {
        [badgeTypes.pillColor]: pillSizes,
        [badgeTypes.badgeColor]: badgeSizes,
        [badgeTypes.badgeModern]: badgeSizes,
    };

    return (
        <span className={cx(colors.common, sizes[type][size], colors.styles[color].root)}>
            <Icon className={cx("tw:size-3 tw:stroke-[3px]", colors.styles[color].addon)} />
        </span>
    );
};
