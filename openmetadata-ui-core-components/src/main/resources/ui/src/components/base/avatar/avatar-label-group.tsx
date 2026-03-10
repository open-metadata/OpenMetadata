import { type ReactNode } from "react";
import { cx } from "@/utils/cx";
import { Avatar, type AvatarProps } from "./avatar";

const styles = {
    sm: { root: "tw:gap-2", title: "tw:text-sm tw:font-semibold", subtitle: "tw:text-xs" },
    md: { root: "tw:gap-2", title: "tw:text-sm tw:font-semibold", subtitle: "tw:text-sm" },
    lg: { root: "tw:gap-3", title: "tw:text-md tw:font-semibold", subtitle: "tw:text-md" },
    xl: { root: "tw:gap-4", title: "tw:text-lg tw:font-semibold", subtitle: "tw:text-md" },
};

interface AvatarLabelGroupProps extends AvatarProps {
    size: "sm" | "md" | "lg" | "xl";
    title: string | ReactNode;
    subtitle: string | ReactNode;
}

export const AvatarLabelGroup = ({ title, subtitle, className, ...props }: AvatarLabelGroupProps) => {
    return (
        <figure className={cx("tw:group tw:flex tw:min-w-0 tw:flex-1 tw:items-center", styles[props.size].root, className)}>
            <Avatar {...props} />
            <figcaption className="tw:min-w-0 tw:flex-1">
                <p className={cx("tw:text-primary", styles[props.size].title)}>{title}</p>
                <p className={cx("tw:truncate tw:text-tertiary", styles[props.size].subtitle)}>{subtitle}</p>
            </figcaption>
        </figure>
    );
};
