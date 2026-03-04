import { cx } from "@/utils/cx";
import type { PaginationRootProps } from "./pagination-base";
import { Pagination } from "./pagination-base";

interface PaginationLineProps extends Omit<PaginationRootProps, "children"> {
    /** The size of the pagination line. */
    size?: "md" | "lg";
    /** Whether the pagination is displayed in a card. */
    framed?: boolean;
}

export const PaginationLine = ({ framed, className, size = "md", ...props }: PaginationLineProps) => {
    const sizes = {
        md: {
            root: cx("tw:gap-2", framed && "tw:p-2"),
            button: "tw:h-1.5 tw:w-full tw:after:-inset-x-1.5 tw:after:-inset-y-2",
        },
        lg: {
            root: cx("tw:gap-3", framed && "tw:p-3"),
            button: "tw:h-2 tw:w-full tw:after:-inset-x-2 tw:after:-inset-y-3",
        },
    };

    return (
        <Pagination.Root {...props} className={cx("tw:flex tw:h-max tw:w-max", sizes[size].root, framed && "tw:rounded-full tw:bg-alpha-white/90 tw:backdrop-blur", className)}>
            <Pagination.Context>
                {({ pages }) =>
                    pages.map((page, index) =>
                        page.type === "page" ? (
                            <Pagination.Item
                                {...page}
                                asChild
                                key={index}
                                className={cx(
                                    "tw:relative tw:cursor-pointer tw:rounded-full tw:bg-quaternary tw:outline-focus-ring tw:after:absolute tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2",
                                    sizes[size].button,
                                    page.isCurrent && "tw:bg-fg-brand-primary_alt",
                                )}
                            />
                        ) : (
                            <Pagination.Ellipsis {...page} key={index} />
                        ),
                    )
                }
            </Pagination.Context>
        </Pagination.Root>
    );
};
