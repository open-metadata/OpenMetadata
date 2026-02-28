import { cx } from "@/utils/cx";

interface TagCheckboxProps {
    size?: "sm" | "md" | "lg";
    className?: string;
    isFocused?: boolean;
    isSelected?: boolean;
    isDisabled?: boolean;
}

export const TagCheckbox = ({ className, isFocused, isSelected, isDisabled, size = "sm" }: TagCheckboxProps) => {
    return (
        <div
            className={cx(
                "tw:flex tw:cursor-pointer tw:appearance-none tw:items-center tw:justify-center tw:rounded tw:bg-primary tw:ring-1 tw:ring-primary tw:ring-inset",
                size === "sm" && "tw:size-3.5",
                size === "md" && "tw:size-4",
                size === "lg" && "tw:size-4.5",
                isSelected && "tw:bg-brand-solid tw:ring-bg-brand-solid",
                isDisabled && "tw:cursor-not-allowed tw:bg-disabled_subtle tw:ring-disabled",
                isFocused && "tw:outline-2 tw:outline-offset-2 tw:outline-focus-ring",
                className,
            )}
        >
            <svg
                aria-hidden="true"
                viewBox="0 0 14 14"
                fill="none"
                className={cx(
                    "tw:pointer-events-none tw:absolute tw:text-fg-white tw:opacity-0 tw:transition-inherit-all",
                    size === "sm" && "tw:size-2.5",
                    size === "md" && "tw:size-3",
                    size === "lg" && "tw:size-3.5",
                    isSelected && "tw:opacity-100",
                    isDisabled && "tw:text-fg-disabled_subtle",
                )}
            >
                <path d="M11.6666 3.5L5.24992 9.91667L2.33325 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </div>
    );
};
TagCheckbox.displayName = "TagCheckbox";
