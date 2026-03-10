import { type FC, type ReactNode, useState } from "react";
import { User01 } from "@untitledui/icons";
import { cx } from "@/utils/cx";
import { AvatarOnlineIndicator, VerifiedTick } from "./base-components";

type AvatarSize = "xxs" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

export interface AvatarProps {
    size?: AvatarSize;
    className?: string;
    src?: string | null;
    alt?: string;
    /**
     * Display a contrast border around the avatar.
     */
    contrastBorder?: boolean;
    /**
     * Display a badge (i.e. company logo).
     */
    badge?: ReactNode;
    /**
     * Display a status indicator.
     */
    status?: "online" | "offline";
    /**
     * Display a verified tick icon.
     *
     * @default false
     */
    verified?: boolean;

    /**
     * The initials of the user to display if no image is available.
     */
    initials?: string;
    /**
     * An icon to display if no image is available.
     */
    placeholderIcon?: FC<{ className?: string }>;
    /**
     * A placeholder to display if no image is available.
     */
    placeholder?: ReactNode;

    /**
     * Whether the avatar should show a focus ring when the parent group is in focus.
     * For example, when the avatar is wrapped inside a link.
     *
     * @default false
     */
    focusable?: boolean;
}

const styles = {
    xxs: { root: "tw:size-4 tw:outline-[0.5px] tw:-outline-offset-[0.5px]", initials: "tw:text-xs tw:font-semibold", icon: "tw:size-3" },
    xs: { root: "tw:size-6 tw:outline-[0.5px] tw:-outline-offset-[0.5px]", initials: "tw:text-xs tw:font-semibold", icon: "tw:size-4" },
    sm: { root: "tw:size-8 tw:outline-[0.75px] tw:-outline-offset-[0.75px]", initials: "tw:text-sm tw:font-semibold", icon: "tw:size-5" },
    md: { root: "tw:size-10 tw:outline-1 tw:-outline-offset-1", initials: "tw:text-md tw:font-semibold", icon: "tw:size-6" },
    lg: { root: "tw:size-12 tw:outline-1 tw:-outline-offset-1", initials: "tw:text-lg tw:font-semibold", icon: "tw:size-7" },
    xl: { root: "tw:size-14 tw:outline-1 tw:-outline-offset-1", initials: "tw:text-xl tw:font-semibold", icon: "tw:size-8" },
    "2xl": { root: "tw:size-16 tw:outline-1 tw:-outline-offset-1", initials: "tw:text-display-xs tw:font-semibold", icon: "tw:size-8" },
};

export const Avatar = ({
    contrastBorder = true,
    size = "md",
    src,
    alt,
    initials,
    placeholder,
    placeholderIcon: PlaceholderIcon,
    badge,
    status,
    verified,
    focusable = false,
    className,
}: AvatarProps) => {
    const [isFailed, setIsFailed] = useState(false);

    const renderMainContent = () => {
        if (src && !isFailed) {
            return <img data-avatar-img className="tw:size-full tw:rounded-full tw:object-cover" src={src} alt={alt} onError={() => setIsFailed(true)} />;
        }

        if (initials) {
            return <span className={cx("tw:text-quaternary", styles[size].initials)}>{initials}</span>;
        }

        if (PlaceholderIcon) {
            return <PlaceholderIcon className={cx("tw:text-fg-quaternary", styles[size].icon)} />;
        }

        return placeholder || <User01 className={cx("tw:text-fg-quaternary", styles[size].icon)} />;
    };

    const renderBadgeContent = () => {
        if (status) {
            return <AvatarOnlineIndicator status={status} size={size === "xxs" ? "xs" : size} />;
        }

        if (verified) {
            return (
                <VerifiedTick
                    size={size === "xxs" ? "xs" : size}
                    className={cx("tw:absolute tw:right-0 tw:bottom-0", (size === "xxs" || size === "xs") && "tw:-right-px tw:-bottom-px")}
                />
            );
        }

        return badge;
    };

    return (
        <div
            data-avatar
            className={cx(
                "tw:relative tw:inline-flex tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:bg-avatar-bg tw:outline-transparent",
                // Focus styles
                focusable && "tw:group-outline-focus-ring tw:group-focus-visible:outline-2 tw:group-focus-visible:outline-offset-2",
                contrastBorder && "tw:outline tw:outline-avatar-contrast-border",
                styles[size].root,
                className,
            )}
        >
            {renderMainContent()}
            {renderBadgeContent()}
        </div>
    );
};
