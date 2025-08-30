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
                "flex cursor-pointer appearance-none items-center justify-center rounded bg-primary ring-1 ring-primary ring-inset",
                size === "sm" && "size-3.5",
                size === "md" && "size-4",
                size === "lg" && "size-4.5",
                isSelected && "bg-brand-solid ring-bg-brand-solid",
                isDisabled && "cursor-not-allowed bg-disabled_subtle ring-disabled",
                isFocused && "outline-2 outline-offset-2 outline-focus-ring",
                className,
            )}
        >
            <svg
                aria-hidden="true"
                viewBox="0 0 14 14"
                fill="none"
                className={cx(
                    "pointer-events-none absolute text-fg-white opacity-0 transition-inherit-all",
                    size === "sm" && "size-2.5",
                    size === "md" && "size-3",
                    size === "lg" && "size-3.5",
                    isSelected && "opacity-100",
                    isDisabled && "text-fg-disabled_subtle",
                )}
            >
                <path d="M11.6666 3.5L5.24992 9.91667L2.33325 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </div>
    );
};
TagCheckbox.displayName = "TagCheckbox";
