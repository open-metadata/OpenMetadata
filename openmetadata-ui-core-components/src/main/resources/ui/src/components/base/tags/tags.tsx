import { type PropsWithChildren, type RefAttributes, createContext, useContext } from "react";
import {
    Tag as AriaTag,
    TagGroup as AriaTagGroup,
    type TagGroupProps as AriaTagGroupProps,
    TagList as AriaTagList,
    type TagProps as AriaTagProps,
} from "react-aria-components";
import { Avatar } from "@/components/base/avatar/avatar";
import { Dot } from "@/components/foundations/dot-icon";
import { cx } from "@/utils/cx";
import { TagCheckbox } from "./base-components/tag-checkbox";
import { TagCloseX } from "./base-components/tag-close-x";

export interface TagItem {
    id: string;
    label: string;
    count?: number;
    avatarSrc?: string;
    avatarContrastBorder?: boolean;
    dot?: boolean;
    dotClassName?: string;
    isDisabled?: boolean;
    onClose?: (id: string) => void;
}

const TagGroupContext = createContext<{
    selectionMode: "none" | "single" | "multiple";
    size: "sm" | "md" | "lg";
}>({
    selectionMode: "none",
    size: "sm",
});

interface TagGroupProps extends AriaTagGroupProps, RefAttributes<HTMLDivElement> {
    label: string;
    size?: "sm" | "md" | "lg";
}

export const TagGroup = ({ label, selectionMode = "none", size = "sm", children, ...otherProps }: TagGroupProps) => {
    return (
        <TagGroupContext.Provider value={{ selectionMode, size }}>
            <AriaTagGroup aria-label={label} selectionMode={selectionMode} disallowEmptySelection={selectionMode === "single"} {...otherProps}>
                {children}
            </AriaTagGroup>
        </TagGroupContext.Provider>
    );
};

export const TagList = AriaTagList;

const styles = {
    sm: {
        root: {
            base: "tw:px-2 tw:py-0.75 tw:text-xs tw:font-medium",
            withCheckbox: "tw:pl-1.25",
            withAvatar: "tw:pl-1",
            withDot: "tw:pl-1.5",
            withCount: "tw:pr-1",
            withClose: "tw:pr-1",
        },
        content: "tw:gap-1",
        count: "tw:px-1 tw:text-xs tw:font-medium",
    },
    md: {
        root: {
            base: "tw:px-2.25 tw:py-0.5 tw:text-sm tw:font-medium",
            withCheckbox: "tw:pl-1",
            withAvatar: "tw:pl-1.25",
            withDot: "tw:pl-1.75",
            withCount: "tw:pr-0.75",
            withClose: "tw:pr-1",
        },
        content: "tw:gap-1.25",
        count: "tw:px-1.25 tw:text-xs tw:font-medium",
    },
    lg: {
        root: {
            base: "tw:px-2.5 tw:py-1 tw:text-sm tw:font-medium",
            withCheckbox: "tw:pl-1.25",
            withAvatar: "tw:pl-1.75",
            withDot: "tw:pl-2.25",
            withCount: "tw:pr-1",
            withClose: "tw:pr-1",
        },
        content: "tw:gap-1.5",
        count: "tw:px-1.5 tw:text-sm tw:font-medium",
    },
};

interface TagProps extends AriaTagProps, RefAttributes<object>, Omit<TagItem, "label" | "id"> {}

export const Tag = ({
    id,
    avatarSrc,
    avatarContrastBorder,
    dot,
    dotClassName,
    isDisabled,
    count,
    className,
    children,
    onClose,
}: PropsWithChildren<TagProps>) => {
    const context = useContext(TagGroupContext);

    const leadingContent = avatarSrc ? (
        <Avatar size="xxs" src={avatarSrc} alt="Avatar" contrastBorder={avatarContrastBorder} />
    ) : dot ? (
        <Dot className={cx("tw:text-fg-success-secondary", dotClassName)} size="sm" />
    ) : null;

    return (
        <AriaTag
            id={id}
            isDisabled={isDisabled}
            textValue={typeof children === "string" ? children : undefined}
            className={(state) =>
                cx(
                    "tw:flex tw:cursor-default tw:items-center tw:gap-0.75 tw:rounded-md tw:bg-primary tw:text-secondary tw:ring-1 tw:ring-primary tw:ring-inset tw:focus:outline-hidden tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-focus-ring",
                    styles[context.size].root.base,

                    // With avatar
                    avatarSrc && styles[context.size].root.withAvatar,
                    // With X button
                    (onClose || state.allowsRemoving) && styles[context.size].root.withClose,
                    // With dot
                    dot && styles[context.size].root.withDot,
                    // With count
                    typeof count === "number" && styles[context.size].root.withCount,
                    // With checkbox
                    context.selectionMode !== "none" && styles[context.size].root.withCheckbox,
                    // Disabled
                    isDisabled && "tw:cursor-not-allowed",

                    typeof className === "function" ? className(state) : className,
                )
            }
        >
            {({ isSelected, isDisabled, allowsRemoving }) => (
                <>
                    <div className={cx("tw:flex tw:items-center tw:gap-1", styles[context.size].content)}>
                        {context.selectionMode !== "none" && <TagCheckbox size={context.size} isSelected={isSelected} isDisabled={isDisabled} />}

                        {leadingContent}

                        {children}

                        {typeof count === "number" && (
                            <span className={cx("tw:flex tw:items-center tw:justify-center tw:rounded-[3px] tw:bg-tertiary tw:text-center", styles[context.size].count)}>
                                {count}
                            </span>
                        )}
                    </div>

                    {(onClose || allowsRemoving) && <TagCloseX size={context.size} onPress={() => id && onClose?.(id.toString())} />}
                </>
            )}
        </AriaTag>
    );
};
