import type { CSSProperties, FC, HTMLAttributes, ReactNode } from "react";
import React, { cloneElement, createContext, isValidElement, useCallback, useContext, useEffect, useState } from "react";

type PaginationPage = {
    /** The type of the pagination item. */
    type: "page";
    /** The value of the pagination item. */
    value: number;
    /** Whether the pagination item is the current page. */
    isCurrent: boolean;
};

type PaginationEllipsisType = {
    type: "ellipsis";
    key: number;
};

type PaginationItemType = PaginationPage | PaginationEllipsisType;

interface PaginationContextType {
    /** The pages of the pagination. */
    pages: PaginationItemType[];
    /** The current page of the pagination. */
    currentPage: number;
    /** The total number of pages. */
    total: number;
    /** The function to call when the page changes. */
    onPageChange: (page: number) => void;
}

const PaginationContext = createContext<PaginationContextType | undefined>(undefined);

export interface PaginationRootProps {
    /** Number of sibling pages to show on each side of the current page */
    siblingCount?: number;
    /** Current active page number */
    page: number;
    /** Total number of pages */
    total: number;
    children: ReactNode;
    /** The style of the pagination root. */
    style?: CSSProperties;
    /** The class name of the pagination root. */
    className?: string;
    /** Callback function that's called when the page changes with the new page number. */
    onPageChange?: (page: number) => void;
}

const PaginationRoot = ({ total, siblingCount = 1, page, onPageChange, children, style, className }: PaginationRootProps) => {
    const [pages, setPages] = useState<PaginationItemType[]>([]);

    const createPaginationItems = useCallback((): PaginationItemType[] => {
        const items: PaginationItemType[] = [];
        // Calculate the maximum number of pagination elements (pages, potential ellipsis, first and last) to show
        const totalPageNumbers = siblingCount * 2 + 5;

        // If the total number of items to show is greater than or equal to the total pages,
        // we can simply list all pages without needing to collapse with ellipsis
        if (totalPageNumbers >= total) {
            for (let i = 1; i <= total; i++) {
                items.push({
                    type: "page",
                    value: i,
                    isCurrent: i === page,
                });
            }
        } else {
            // Calculate left and right sibling boundaries around the current page
            const leftSiblingIndex = Math.max(page - siblingCount, 1);
            const rightSiblingIndex = Math.min(page + siblingCount, total);

            // Determine if we need to show ellipsis on either side
            const showLeftEllipsis = leftSiblingIndex > 2;
            const showRightEllipsis = rightSiblingIndex < total - 1;

            // Case 1: No left ellipsis, but right ellipsis is needed
            if (!showLeftEllipsis && showRightEllipsis) {
                // Calculate how many page numbers to show starting from the beginning
                const leftItemCount = siblingCount * 2 + 3;
                const leftRange = range(1, leftItemCount);

                leftRange.forEach((pageNum) =>
                    items.push({
                        type: "page",
                        value: pageNum,
                        isCurrent: pageNum === page,
                    }),
                );

                // Insert ellipsis after the left range and add the last page
                items.push({ type: "ellipsis", key: leftItemCount + 1 });
                items.push({
                    type: "page",
                    value: total,
                    isCurrent: total === page,
                });
            }
            // Case 2: Left ellipsis needed, but right ellipsis is not needed
            else if (showLeftEllipsis && !showRightEllipsis) {
                // Determine how many items from the end should be shown
                const rightItemCount = siblingCount * 2 + 3;
                const rightRange = range(total - rightItemCount + 1, total);

                // Always show the first page, then add an ellipsis to indicate skipped pages
                items.push({
                    type: "page",
                    value: 1,
                    isCurrent: page === 1,
                });
                items.push({ type: "ellipsis", key: total - rightItemCount });
                rightRange.forEach((pageNum) =>
                    items.push({
                        type: "page",
                        value: pageNum,
                        isCurrent: pageNum === page,
                    }),
                );
            }
            // Case 3: Both left and right ellipsis are needed
            else if (showLeftEllipsis && showRightEllipsis) {
                // Always show the first page
                items.push({
                    type: "page",
                    value: 1,
                    isCurrent: page === 1,
                });
                // Insert left ellipsis after the first page
                items.push({ type: "ellipsis", key: leftSiblingIndex - 1 });

                // Show a range of pages around the current page
                const middleRange = range(leftSiblingIndex, rightSiblingIndex);
                middleRange.forEach((pageNum) =>
                    items.push({
                        type: "page",
                        value: pageNum,
                        isCurrent: pageNum === page,
                    }),
                );

                // Insert right ellipsis and finally the last page
                items.push({ type: "ellipsis", key: rightSiblingIndex + 1 });
                items.push({
                    type: "page",
                    value: total,
                    isCurrent: total === page,
                });
            }
        }

        return items;
    }, [total, siblingCount, page]);

    useEffect(() => {
        const paginationItems = createPaginationItems();
        setPages(paginationItems);
    }, [createPaginationItems]);

    const onPageChangeHandler = (newPage: number) => {
        onPageChange?.(newPage);
    };

    const paginationContextValue: PaginationContextType = {
        pages,
        currentPage: page,
        total,
        onPageChange: onPageChangeHandler,
    };

    return (
        <PaginationContext.Provider value={paginationContextValue}>
            <nav aria-label="Pagination Navigation" style={style} className={className}>
                {children}
            </nav>
        </PaginationContext.Provider>
    );
};

/**
 * Creates an array of numbers from start to end.
 * @param start - The start number.
 * @param end - The end number.
 * @returns An array of numbers from start to end.
 */
const range = (start: number, end: number): number[] => {
    const length = end - start + 1;

    return Array.from({ length }, (_, index) => index + start);
};

interface TriggerRenderProps {
    isDisabled: boolean;
    onClick: () => void;
}

interface TriggerProps {
    /** The children of the trigger. Can be a render prop or a valid element. */
    children: ReactNode | ((props: TriggerRenderProps) => ReactNode);
    /** The style of the trigger. */
    style?: CSSProperties;
    /** The class name of the trigger. */
    className?: string | ((args: { isDisabled: boolean }) => string);
    /** If true, the child element will be cloned and passed down the prop of the trigger. */
    asChild?: boolean;
    /** The direction of the trigger. */
    direction: "prev" | "next";
    /** The aria label of the trigger. */
    ariaLabel?: string;
}

const Trigger: FC<TriggerProps> = ({ children, style, className, asChild = false, direction, ariaLabel }) => {
    const context = useContext(PaginationContext);
    if (!context) {
        throw new Error("Pagination components must be used within a Pagination.Root");
    }

    const { currentPage, total, onPageChange } = context;

    const isDisabled = direction === "prev" ? currentPage <= 1 : currentPage >= total;

    const handleClick = () => {
        if (isDisabled) return;

        const newPage = direction === "prev" ? currentPage - 1 : currentPage + 1;
        onPageChange?.(newPage);
    };

    const computedClassName = typeof className === "function" ? className({ isDisabled }) : className;

    const defaultAriaLabel = direction === "prev" ? "Previous Page" : "Next Page";

    // If the children is a render prop, we need to pass the isDisabled and onClick to the render prop.
    if (typeof children === "function") {
        return <>{children({ isDisabled, onClick: handleClick })}</>;
    }

    // If the children is a valid element, we need to clone it and pass the isDisabled and onClick to the cloned element.
    if (asChild && isValidElement(children)) {
        return cloneElement(children, {
            onClick: handleClick,
            disabled: isDisabled,
            isDisabled,
            "aria-label": ariaLabel || defaultAriaLabel,
            style: { ...(children.props as HTMLAttributes<HTMLElement>).style, ...style },
            className: [computedClassName, (children.props as HTMLAttributes<HTMLElement>).className].filter(Boolean).join(" ") || undefined,
        } as HTMLAttributes<HTMLElement>);
    }

    return (
        <button aria-label={ariaLabel || defaultAriaLabel} onClick={handleClick} disabled={isDisabled} style={style} className={computedClassName}>
            {children}
        </button>
    );
};

const PaginationPrevTrigger: FC<Omit<TriggerProps, "direction">> = (props) => <Trigger {...props} direction="prev" />;

const PaginationNextTrigger: FC<Omit<TriggerProps, "direction">> = (props) => <Trigger {...props} direction="next" />;

interface PaginationItemRenderProps {
    isSelected: boolean;
    onClick: () => void;
    value: number;
    "aria-current"?: "page";
    "aria-label"?: string;
}

export interface PaginationItemProps {
    /** The value of the pagination item. */
    value: number;
    /** Whether the pagination item is the current page. */
    isCurrent: boolean;
    /** The children of the pagination item. Can be a render prop or a valid element. */
    children?: ReactNode | ((props: PaginationItemRenderProps) => ReactNode);
    /** The style object of the pagination item. */
    style?: CSSProperties;
    /** The class name of the pagination item. */
    className?: string | ((args: { isSelected: boolean }) => string);
    /** The aria label of the pagination item. */
    ariaLabel?: string;
    /** If true, the child element will be cloned and passed down the prop of the item. */
    asChild?: boolean;
}

const PaginationItem = ({ value, isCurrent, children, style, className, ariaLabel, asChild = false }: PaginationItemProps) => {
    const context = useContext(PaginationContext);
    if (!context) {
        throw new Error("Pagination components must be used within a <Pagination.Root />");
    }

    const { onPageChange } = context;

    const isSelected = isCurrent;

    const handleClick = () => {
        onPageChange?.(value);
    };

    const computedClassName = typeof className === "function" ? className({ isSelected }) : className;

    // If the children is a render prop, we need to pass the necessary props to the render prop.
    if (typeof children === "function") {
        return (
            <>
                {children({
                    isSelected,
                    onClick: handleClick,
                    value,
                    "aria-current": isCurrent ? "page" : undefined,
                    "aria-label": ariaLabel || `Page ${value}`,
                })}
            </>
        );
    }

    // If the children is a valid element, we need to clone it and pass the necessary props to the cloned element.
    if (asChild && isValidElement(children)) {
        return cloneElement(children, {
            onClick: handleClick,
            "aria-current": isCurrent ? "page" : undefined,
            "aria-label": ariaLabel || `Page ${value}`,
            style: { ...(children.props as HTMLAttributes<HTMLElement>).style, ...style },
            className: [computedClassName, (children.props as HTMLAttributes<HTMLElement>).className].filter(Boolean).join(" ") || undefined,
        } as HTMLAttributes<HTMLElement>);
    }

    return (
        <button
            onClick={handleClick}
            style={style}
            className={computedClassName}
            aria-current={isCurrent ? "page" : undefined}
            aria-label={ariaLabel || `Page ${value}`}
            role="listitem"
        >
            {children}
        </button>
    );
};
interface PaginationEllipsisProps {
    key: number;
    children?: ReactNode;
    style?: CSSProperties;
    className?: string | (() => string);
}

const PaginationEllipsis: FC<PaginationEllipsisProps> = ({ children, style, className }) => {
    const computedClassName = typeof className === "function" ? className() : className;

    return (
        <span style={style} className={computedClassName} aria-hidden="true">
            {children}
        </span>
    );
};

interface PaginationContextComponentProps {
    children: (pagination: PaginationContextType) => ReactNode;
}

const PaginationContextComponent: FC<PaginationContextComponentProps> = ({ children }) => {
    const context = useContext(PaginationContext);
    if (!context) {
        throw new Error("Pagination components must be used within a Pagination.Root");
    }

    return <>{children(context)}</>;
};

export const Pagination = {
    Root: PaginationRoot,
    PrevTrigger: PaginationPrevTrigger,
    NextTrigger: PaginationNextTrigger,
    Item: PaginationItem,
    Ellipsis: PaginationEllipsis,
    Context: PaginationContextComponent,
};
