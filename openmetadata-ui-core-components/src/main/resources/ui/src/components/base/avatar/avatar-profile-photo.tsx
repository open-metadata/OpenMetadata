import { useState } from "react";
import { User01 } from "@untitledui/icons";
import { cx } from "@/utils/cx";
import { type AvatarProps } from "./avatar";
import { AvatarOnlineIndicator, VerifiedTick } from "./base-components";

const styles = {
    sm: {
        root: "tw:size-18 tw:p-0.75",
        rootWithPlaceholder: "tw:p-1",
        content: "",
        icon: "tw:size-9",
        initials: "tw:text-display-sm tw:font-semibold",
        badge: "tw:bottom-0.5 tw:right-0.5",
    },
    md: {
        root: "tw:size-24 tw:p-1",
        rootWithPlaceholder: "tw:p-1.25",
        content: "tw:shadow-xl",
        icon: "tw:size-12",
        initials: "tw:text-display-md tw:font-semibold",
        badge: "tw:bottom-1 tw:right-1",
    },
    lg: {
        root: "tw:size-40 tw:p-1.5",
        rootWithPlaceholder: "tw:p-1.75",
        content: "tw:shadow-2xl",
        icon: "tw:size-20",
        initials: "tw:text-display-xl tw:font-semibold",
        badge: "tw:bottom-2 tw:right-2",
    },
};

const tickSizeMap = {
    sm: "2xl",
    md: "3xl",
    lg: "4xl",
} as const;

interface AvatarProfilePhotoProps extends AvatarProps {
    size: "sm" | "md" | "lg";
}

export const AvatarProfilePhoto = ({
    contrastBorder = true,
    size = "md",
    src,
    alt,
    initials,
    placeholder,
    placeholderIcon: PlaceholderIcon,
    verified,
    badge,
    status,
    className,
}: AvatarProfilePhotoProps) => {
    const [isFailed, setIsFailed] = useState(false);

    const renderMainContent = () => {
        if (src && !isFailed) {
            return (
                <img
                    src={src}
                    alt={alt}
                    onError={() => setIsFailed(true)}
                    className={cx(
                        "tw:size-full tw:rounded-full tw:object-cover",
                        contrastBorder && "tw:outline-1 tw:-outline-offset-1 tw:outline-avatar-contrast-border",
                        styles[size].content,
                    )}
                />
            );
        }

        if (initials) {
            return (
                <div className={cx("tw:flex tw:size-full tw:items-center tw:justify-center tw:rounded-full tw:bg-tertiary tw:ring-1 tw:ring-secondary_alt", styles[size].content)}>
                    <span className={cx("tw:text-quaternary", styles[size].initials)}>{initials}</span>
                </div>
            );
        }

        if (PlaceholderIcon) {
            return (
                <div className={cx("tw:flex tw:size-full tw:items-center tw:justify-center tw:rounded-full tw:bg-tertiary tw:ring-1 tw:ring-secondary_alt", styles[size].content)}>
                    <PlaceholderIcon className={cx("tw:text-fg-quaternary", styles[size].icon)} />
                </div>
            );
        }

        return (
            <div className={cx("tw:flex tw:size-full tw:items-center tw:justify-center tw:rounded-full tw:bg-tertiary tw:ring-1 tw:ring-secondary_alt", styles[size].content)}>
                {placeholder || <User01 className={cx("tw:text-fg-quaternary", styles[size].icon)} />}
            </div>
        );
    };

    const renderBadgeContent = () => {
        if (status) {
            return <AvatarOnlineIndicator status={status} size={tickSizeMap[size]} className={styles[size].badge} />;
        }

        if (verified) {
            return <VerifiedTick size={tickSizeMap[size]} className={cx("tw:absolute", styles[size].badge)} />;
        }

        return badge;
    };

    return (
        <div
            className={cx(
                "tw:relative tw:flex tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:bg-primary tw:ring-1 tw:ring-secondary_alt",
                styles[size].root,
                (!src || isFailed) && styles[size].rootWithPlaceholder,
                className,
            )}
        >
            {renderMainContent()}
            {renderBadgeContent()}
        </div>
    );
};
