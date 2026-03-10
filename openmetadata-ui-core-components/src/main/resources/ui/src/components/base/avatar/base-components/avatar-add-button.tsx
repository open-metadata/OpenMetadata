import { Plus } from "@untitledui/icons";
import type { ButtonProps as AriaButtonProps } from "react-aria-components";
import { Tooltip as AriaTooltip, TooltipTrigger as AriaTooltipTrigger } from "@/components/base/tooltip/tooltip";
import { cx } from "@/utils/cx";

const sizes = {
    xs: { root: "size-6", icon: "size-4" },
    sm: { root: "size-8", icon: "size-4" },
    md: { root: "size-10", icon: "size-5" },
};

interface AvatarAddButtonProps extends AriaButtonProps {
    size: "xs" | "sm" | "md";
    title?: string;
    className?: string;
}

export const AvatarAddButton = ({ size, className, title = "Add user", ...props }: AvatarAddButtonProps) => (
    <AriaTooltip title={title}>
        <AriaTooltipTrigger
            {...props}
            aria-label={title}
            className={cx(
                "tw:flex tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-full tw:border tw:border-dashed tw:border-primary tw:bg-primary tw:text-fg-quaternary tw:outline-focus-ring tw:transition tw:duration-100 tw:ease-linear tw:hover:bg-primary_hover tw:hover:text-fg-quaternary_hover tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:disabled:border-gray-200 tw:disabled:bg-secondary tw:disabled:text-gray-200",
                sizes[size].root,
                className,
            )}
        >
            <Plus className={cx("tw:text-current tw:transition-inherit-all", sizes[size].icon)} />
        </AriaTooltipTrigger>
    </AriaTooltip>
);
