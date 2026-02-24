import { cx } from "@/utils/cx";

const sizes = {
    xs: "size-1.5",
    sm: "size-2",
    md: "size-2.5",
    lg: "size-3",
    xl: "size-3.5",
    "2xl": "size-4",
    "3xl": "size-4.5",
    "4xl": "size-5",
};

interface AvatarOnlineIndicatorProps {
    size: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
    status: "online" | "offline";
    className?: string;
}

export const AvatarOnlineIndicator = ({ size, status, className }: AvatarOnlineIndicatorProps) => (
    <span
        className={cx(
            "tw:absolute tw:right-0 tw:bottom-0 tw:rounded-full tw:ring-[1.5px] tw:ring-bg-primary",
            status === "online" ? "tw:bg-fg-success-secondary" : "tw:bg-fg-disabled_subtle",
            sizes[size],
            className,
        )}
    />
);
