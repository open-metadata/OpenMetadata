import { ArrowLeft, ArrowRight } from "@untitledui/icons";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";
import { Button } from "@/components/base/buttons/button";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { cx } from "@/utils/cx";
import type { PaginationRootProps } from "./pagination-base";
import { Pagination } from "./pagination-base";

interface PaginationProps extends Partial<Omit<PaginationRootProps, "children">> {
    /** Whether the pagination buttons are rounded. */
    rounded?: boolean;
}

const PaginationItem = ({ value, rounded, isCurrent }: { value: number; rounded?: boolean; isCurrent: boolean }) => {
    return (
        <Pagination.Item
            value={value}
            isCurrent={isCurrent}
            className={({ isSelected }) =>
                cx(
                    "tw:flex tw:size-10 tw:cursor-pointer tw:items-center tw:justify-center tw:p-3 tw:text-sm tw:font-medium tw:text-quaternary tw:outline-focus-ring tw:transition tw:duration-100 tw:ease-linear tw:hover:bg-primary_hover tw:hover:text-secondary tw:focus-visible:z-10 tw:focus-visible:bg-primary_hover tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2",
                    rounded ? "tw:rounded-full" : "tw:rounded-lg",
                    isSelected && "tw:bg-primary_hover tw:text-secondary",
                )
            }
        >
            {value}
        </Pagination.Item>
    );
};

interface MobilePaginationProps {
    /** The current page. */
    page?: number;
    /** The total number of pages. */
    total?: number;
    /** The class name of the pagination component. */
    className?: string;
    /** The function to call when the page changes. */
    onPageChange?: (page: number) => void;
}

const MobilePagination = ({ page = 1, total = 10, className, onPageChange }: MobilePaginationProps) => {
    return (
        <nav aria-label="Pagination" className={cx("tw:flex tw:items-center tw:justify-between tw:md:hidden", className)}>
            <Button
                aria-label="Go to previous page"
                iconLeading={ArrowLeft}
                color="secondary"
                size="sm"
                onClick={() => onPageChange?.(Math.max(0, page - 1))}
            />

            <span className="tw:text-sm tw:text-fg-secondary">
                Page <span className="tw:font-medium">{page}</span> of <span className="tw:font-medium">{total}</span>
            </span>

            <Button
                aria-label="Go to next page"
                iconLeading={ArrowRight}
                color="secondary"
                size="sm"
                onClick={() => onPageChange?.(Math.min(total, page + 1))}
            />
        </nav>
    );
};

export const PaginationPageDefault = ({ rounded, page = 1, total = 10, className, ...props }: PaginationProps) => {
    const isDesktop = useBreakpoint("md");

    return (
        <Pagination.Root
            {...props}
            page={page}
            total={total}
            className={cx("tw:flex tw:w-full tw:items-center tw:justify-between tw:gap-3 tw:border-t tw:border-secondary tw:pt-4 tw:md:pt-5", className)}
        >
            <div className="tw:hidden tw:flex-1 tw:justify-start tw:md:flex">
                <Pagination.PrevTrigger asChild>
                    <Button iconLeading={ArrowLeft} color="link-gray" size="sm">
                        {isDesktop ? "Previous" : undefined}{" "}
                    </Button>
                </Pagination.PrevTrigger>
            </div>

            <Pagination.PrevTrigger asChild className="tw:md:hidden">
                <Button iconLeading={ArrowLeft} color="secondary" size="sm">
                    {isDesktop ? "Previous" : undefined}
                </Button>
            </Pagination.PrevTrigger>

            <Pagination.Context>
                {({ pages, currentPage, total }) => (
                    <>
                        <div className="tw:hidden tw:justify-center tw:gap-0.5 tw:md:flex">
                            {pages.map((page, index) =>
                                page.type === "page" ? (
                                    <PaginationItem key={index} rounded={rounded} {...page} />
                                ) : (
                                    <Pagination.Ellipsis key={index} className="tw:flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:text-tertiary">
                                        &#8230;
                                    </Pagination.Ellipsis>
                                ),
                            )}
                        </div>

                        <div className="tw:flex tw:justify-center tw:text-sm tw:whitespace-pre tw:text-fg-secondary tw:md:hidden">
                            Page <span className="tw:font-medium">{currentPage}</span> of <span className="tw:font-medium">{total}</span>
                        </div>
                    </>
                )}
            </Pagination.Context>

            <div className="tw:hidden tw:flex-1 tw:justify-end tw:md:flex">
                <Pagination.NextTrigger asChild>
                    <Button iconTrailing={ArrowRight} color="link-gray" size="sm">
                        {isDesktop ? "Next" : undefined}
                    </Button>
                </Pagination.NextTrigger>
            </div>
            <Pagination.NextTrigger asChild className="tw:md:hidden">
                <Button iconTrailing={ArrowRight} color="secondary" size="sm">
                    {isDesktop ? "Next" : undefined}
                </Button>
            </Pagination.NextTrigger>
        </Pagination.Root>
    );
};

export const PaginationPageMinimalCenter = ({ rounded, page = 1, total = 10, className, ...props }: PaginationProps) => {
    const isDesktop = useBreakpoint("md");

    return (
        <Pagination.Root
            {...props}
            page={page}
            total={total}
            className={cx("tw:flex tw:w-full tw:items-center tw:justify-between tw:gap-3 tw:border-t tw:border-secondary tw:pt-4 tw:md:pt-5", className)}
        >
            <div className="tw:flex tw:flex-1 tw:justify-start">
                <Pagination.PrevTrigger asChild>
                    <Button iconLeading={ArrowLeft} color="secondary" size="sm">
                        {isDesktop ? "Previous" : undefined}
                    </Button>
                </Pagination.PrevTrigger>
            </div>

            <Pagination.Context>
                {({ pages, currentPage, total }) => (
                    <>
                        <div className="tw:hidden tw:justify-center tw:gap-0.5 tw:md:flex">
                            {pages.map((page, index) =>
                                page.type === "page" ? (
                                    <PaginationItem key={index} rounded={rounded} {...page} />
                                ) : (
                                    <Pagination.Ellipsis key={index} className="tw:flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:text-tertiary">
                                        &#8230;
                                    </Pagination.Ellipsis>
                                ),
                            )}
                        </div>

                        <div className="tw:flex tw:justify-center tw:text-sm tw:whitespace-pre tw:text-fg-secondary tw:md:hidden">
                            Page <span className="tw:font-medium">{currentPage}</span> of <span className="tw:font-medium">{total}</span>
                        </div>
                    </>
                )}
            </Pagination.Context>

            <div className="tw:flex tw:flex-1 tw:justify-end">
                <Pagination.NextTrigger asChild>
                    <Button iconTrailing={ArrowRight} color="secondary" size="sm">
                        {isDesktop ? "Next" : undefined}
                    </Button>
                </Pagination.NextTrigger>
            </div>
        </Pagination.Root>
    );
};

export const PaginationCardDefault = ({ rounded, page = 1, total = 10, ...props }: PaginationProps) => {
    const isDesktop = useBreakpoint("md");

    return (
        <Pagination.Root
            {...props}
            page={page}
            total={total}
            className="tw:flex tw:w-full tw:items-center tw:justify-between tw:gap-3 tw:border-t tw:border-secondary tw:px-4 tw:py-3 tw:md:px-6 tw:md:pt-3 tw:md:pb-4"
        >
            <div className="tw:flex tw:flex-1 tw:justify-start">
                <Pagination.PrevTrigger asChild>
                    <Button iconLeading={ArrowLeft} color="secondary" size="sm">
                        {isDesktop ? "Previous" : undefined}
                    </Button>
                </Pagination.PrevTrigger>
            </div>

            <Pagination.Context>
                {({ pages, currentPage, total }) => (
                    <>
                        <div className="tw:hidden tw:justify-center tw:gap-0.5 tw:md:flex">
                            {pages.map((page, index) =>
                                page.type === "page" ? (
                                    <PaginationItem key={index} rounded={rounded} {...page} />
                                ) : (
                                    <Pagination.Ellipsis key={index} className="tw:flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:text-tertiary">
                                        &#8230;
                                    </Pagination.Ellipsis>
                                ),
                            )}
                        </div>

                        <div className="tw:flex tw:justify-center tw:text-sm tw:whitespace-pre tw:text-fg-secondary tw:md:hidden">
                            Page <span className="tw:font-medium">{currentPage}</span> of <span className="tw:font-medium">{total}</span>
                        </div>
                    </>
                )}
            </Pagination.Context>

            <div className="tw:flex tw:flex-1 tw:justify-end">
                <Pagination.NextTrigger asChild>
                    <Button iconTrailing={ArrowRight} color="secondary" size="sm">
                        {isDesktop ? "Next" : undefined}
                    </Button>
                </Pagination.NextTrigger>
            </div>
        </Pagination.Root>
    );
};

interface PaginationCardMinimalProps {
    /** The current page. */
    page?: number;
    /** The total number of pages. */
    total?: number;
    /** The alignment of the pagination. */
    align?: "left" | "center" | "right";
    /** The class name of the pagination component. */
    className?: string;
    /** The function to call when the page changes. */
    onPageChange?: (page: number) => void;
}

export const PaginationCardMinimal = ({ page = 1, total = 10, align = "left", onPageChange, className }: PaginationCardMinimalProps) => {
    return (
        <div className={cx("tw:border-t tw:border-secondary tw:px-4 tw:py-3 tw:md:px-6 tw:md:pt-3 tw:md:pb-4", className)}>
            <MobilePagination page={page} total={total} onPageChange={onPageChange} />

            <nav aria-label="Pagination" className={cx("tw:hidden tw:items-center tw:gap-3 tw:md:flex", align === "center" && "tw:justify-between")}>
                <div className={cx(align === "center" && "tw:flex tw:flex-1 tw:justify-start")}>
                    <Button isDisabled={page === 1} color="secondary" size="sm" onClick={() => onPageChange?.(Math.max(0, page - 1))}>
                        Previous
                    </Button>
                </div>

                <span
                    className={cx(
                        "tw:text-sm tw:font-medium tw:text-fg-secondary",
                        align === "right" && "tw:order-first tw:mr-auto",
                        align === "left" && "tw:order-last tw:ml-auto",
                    )}
                >
                    Page {page} of {total}
                </span>

                <div className={cx(align === "center" && "tw:flex tw:flex-1 tw:justify-end")}>
                    <Button isDisabled={page === total} color="secondary" size="sm" onClick={() => onPageChange?.(Math.min(total, page + 1))}>
                        Next
                    </Button>
                </div>
            </nav>
        </div>
    );
};

interface PaginationButtonGroupProps extends Partial<Omit<PaginationRootProps, "children">> {
    /** The alignment of the pagination. */
    align?: "left" | "center" | "right";
}

export const PaginationButtonGroup = ({ align = "left", page = 1, total = 10, ...props }: PaginationButtonGroupProps) => {
    const isDesktop = useBreakpoint("md");

    return (
        <div
            className={cx(
                "tw:flex tw:border-t tw:border-secondary tw:px-4 tw:py-3 tw:md:px-6 tw:md:pt-3 tw:md:pb-4",
                align === "left" && "tw:justify-start",
                align === "center" && "tw:justify-center",
                align === "right" && "tw:justify-end",
            )}
        >
            <Pagination.Root {...props} page={page} total={total}>
                <Pagination.Context>
                    {({ pages }) => (
                        <ButtonGroup size="md">
                            <Pagination.PrevTrigger asChild>
                                <ButtonGroupItem iconLeading={ArrowLeft}>{isDesktop ? "Previous" : undefined}</ButtonGroupItem>
                            </Pagination.PrevTrigger>

                            {pages.map((page, index) =>
                                page.type === "page" ? (
                                    <Pagination.Item key={index} {...page} asChild>
                                        <ButtonGroupItem isSelected={page.isCurrent} className="tw:size-10 tw:items-center tw:justify-center">
                                            {page.value}
                                        </ButtonGroupItem>
                                    </Pagination.Item>
                                ) : (
                                    <Pagination.Ellipsis key={index}>
                                        <ButtonGroupItem className="tw:pointer-events-none tw:size-10 tw:items-center tw:justify-center tw:rounded-none!">
                                            &#8230;
                                        </ButtonGroupItem>
                                    </Pagination.Ellipsis>
                                ),
                            )}

                            <Pagination.NextTrigger asChild>
                                <ButtonGroupItem iconTrailing={ArrowRight}>{isDesktop ? "Next" : undefined}</ButtonGroupItem>
                            </Pagination.NextTrigger>
                        </ButtonGroup>
                    )}
                </Pagination.Context>
            </Pagination.Root>
        </div>
    );
};
