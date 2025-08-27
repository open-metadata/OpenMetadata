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
            root: cx("gap-2", framed && "p-2"),
            button: "h-1.5 w-full after:-inset-x-1.5 after:-inset-y-2",
        },
        lg: {
            root: cx("gap-3", framed && "p-3"),
            button: "h-2 w-full after:-inset-x-2 after:-inset-y-3",
        },
    };

    return (
        <Pagination.Root {...props} className={cx("flex h-max w-max", sizes[size].root, framed && "rounded-full bg-alpha-white/90 backdrop-blur", className)}>
            <Pagination.Context>
                {({ pages }) =>
                    pages.map((page, index) =>
                        page.type === "page" ? (
                            <Pagination.Item
                                {...page}
                                asChild
                                key={index}
                                className={cx(
                                    "relative cursor-pointer rounded-full bg-quaternary outline-focus-ring after:absolute focus-visible:outline-2 focus-visible:outline-offset-2",
                                    sizes[size].button,
                                    page.isCurrent && "bg-fg-brand-primary_alt",
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
