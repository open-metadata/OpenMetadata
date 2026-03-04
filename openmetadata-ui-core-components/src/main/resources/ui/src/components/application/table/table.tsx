import type { ComponentPropsWithRef, HTMLAttributes, ReactNode, Ref, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { createContext, isValidElement, useContext } from "react";
import { ArrowDown, ChevronSelectorVertical, Copy01, Edit01, HelpCircle, Trash01 } from "@untitledui/icons";
import type {
    CellProps as AriaCellProps,
    ColumnProps as AriaColumnProps,
    RowProps as AriaRowProps,
    TableHeaderProps as AriaTableHeaderProps,
    TableProps as AriaTableProps,
} from "react-aria-components";
import {
    Cell as AriaCell,
    Collection as AriaCollection,
    Column as AriaColumn,
    Group as AriaGroup,
    Row as AriaRow,
    Table as AriaTable,
    TableBody as AriaTableBody,
    TableHeader as AriaTableHeader,
    useTableOptions,
} from "react-aria-components";
import { Badge } from "@/components/base/badges/badges";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { cx } from "@/utils/cx";

export const TableRowActionsDropdown = () => (
    <Dropdown.Root>
        <Dropdown.DotsButton />

        <Dropdown.Popover className="tw:w-min">
            <Dropdown.Menu>
                <Dropdown.Item icon={Edit01}>
                    <span className="tw:pr-4">Edit</span>
                </Dropdown.Item>
                <Dropdown.Item icon={Copy01}>
                    <span className="tw:pr-4">Copy link</span>
                </Dropdown.Item>
                <Dropdown.Item icon={Trash01}>
                    <span className="tw:pr-4">Delete</span>
                </Dropdown.Item>
            </Dropdown.Menu>
        </Dropdown.Popover>
    </Dropdown.Root>
);

const TableContext = createContext<{ size: "sm" | "md" }>({ size: "md" });

const TableCardRoot = ({ children, className, size = "md", ...props }: HTMLAttributes<HTMLDivElement> & { size?: "sm" | "md" }) => {
    return (
        <TableContext.Provider value={{ size }}>
            <div {...props} className={cx("tw:overflow-hidden tw:rounded-xl tw:bg-primary tw:shadow-xs tw:ring-1 tw:ring-secondary", className)}>
                {children}
            </div>
        </TableContext.Provider>
    );
};

interface TableCardHeaderProps {
    /** The title of the table card header. */
    title: string;
    /** The badge displayed next to the title. */
    badge?: ReactNode;
    /** The description of the table card header. */
    description?: string;
    /** The content displayed after the title and badge. */
    contentTrailing?: ReactNode;
    /** The class name of the table card header. */
    className?: string;
}

const TableCardHeader = ({ title, badge, description, contentTrailing, className }: TableCardHeaderProps) => {
    const { size } = useContext(TableContext);

    return (
        <div
            className={cx(
                "tw:relative tw:flex tw:flex-col tw:items-start tw:gap-4 tw:border-b tw:border-secondary tw:bg-primary tw:px-4 tw:md:flex-row",
                size === "sm" ? "tw:py-4 tw:md:px-5" : "tw:py-5 tw:md:px-6",
                className,
            )}
        >
            <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-0.5">
                <div className="tw:flex tw:items-center tw:gap-2">
                    <h2 className={cx("tw:font-semibold tw:text-primary", size === "sm" ? "tw:text-md" : "tw:text-lg")}>{title}</h2>
                    {badge ? (
                        isValidElement(badge) ? (
                            badge
                        ) : (
                            <Badge color="brand" size="sm">
                                {badge}
                            </Badge>
                        )
                    ) : null}
                </div>
                {description && <p className="tw:text-sm tw:text-tertiary">{description}</p>}
            </div>
            {contentTrailing}
        </div>
    );
};

interface TableRootProps extends AriaTableProps, Omit<ComponentPropsWithRef<"table">, "className" | "slot" | "style"> {
    size?: "sm" | "md";
}

const TableRoot = ({ className, size = "md", ...props }: TableRootProps) => {
    const context = useContext(TableContext);

    return (
        <TableContext.Provider value={{ size: context?.size ?? size }}>
            <div className="tw:overflow-x-auto">
                <AriaTable className={(state) => cx("tw:w-full tw:overflow-x-hidden", typeof className === "function" ? className(state) : className)} {...props} />
            </div>
        </TableContext.Provider>
    );
};
TableRoot.displayName = "Table";

interface TableHeaderProps<T extends object>
    extends AriaTableHeaderProps<T>,
        Omit<ComponentPropsWithRef<"thead">, "children" | "className" | "slot" | "style"> {
    bordered?: boolean;
}

const TableHeader = <T extends object>({ columns, children, bordered = true, className, ...props }: TableHeaderProps<T>) => {
    const { size } = useContext(TableContext);
    const { selectionBehavior, selectionMode } = useTableOptions();

    return (
        <AriaTableHeader
            {...props}
            className={(state) =>
                cx(
                    "tw:relative tw:bg-secondary",
                    size === "sm" ? "tw:h-9" : "tw:h-11",

                    // Row border—using an "after" pseudo-element to avoid the border taking up space.
                    bordered &&
                        "tw:[&>tr>th]:after:pointer-events-none tw:[&>tr>th]:after:absolute tw:[&>tr>th]:after:inset-x-0 tw:[&>tr>th]:after:bottom-0 tw:[&>tr>th]:after:h-px tw:[&>tr>th]:after:bg-border-secondary tw:[&>tr>th]:focus-visible:after:bg-transparent",

                    typeof className === "function" ? className(state) : className,
                )
            }
        >
            {selectionBehavior === "toggle" && (
                <AriaColumn className={cx("tw:relative tw:py-2 tw:pr-0 tw:pl-4", size === "sm" ? "tw:w-9 tw:md:pl-5" : "tw:w-11 tw:md:pl-6")}>
                    {selectionMode === "multiple" && (
                        <div className="tw:flex tw:items-start">
                            <Checkbox slot="selection" size={size} />
                        </div>
                    )}
                </AriaColumn>
            )}
            <AriaCollection items={columns}>{children}</AriaCollection>
        </AriaTableHeader>
    );
};

TableHeader.displayName = "TableHeader";

interface TableHeadProps extends AriaColumnProps, Omit<ThHTMLAttributes<HTMLTableCellElement>, "children" | "className" | "style" | "id"> {
    label?: string;
    tooltip?: string;
}

const TableHead = ({ className, tooltip, label, children, ...props }: TableHeadProps) => {
    const { selectionBehavior } = useTableOptions();

    return (
        <AriaColumn
            {...props}
            className={(state) =>
                cx(
                    "tw:relative tw:p-0 tw:px-6 tw:py-2 tw:outline-hidden tw:focus-visible:z-1 tw:focus-visible:ring-2 tw:focus-visible:ring-focus-ring tw:focus-visible:ring-offset-bg-primary tw:focus-visible:ring-inset",
                    selectionBehavior === "toggle" && "tw:nth-2:pl-3",
                    state.allowsSorting && "tw:cursor-pointer",
                    typeof className === "function" ? className(state) : className,
                )
            }
        >
            {(state) => (
                <AriaGroup className="tw:flex tw:items-center tw:gap-1">
                    <div className="tw:flex tw:items-center tw:gap-1">
                        {label && <span className="tw:text-xs tw:font-semibold tw:whitespace-nowrap tw:text-quaternary">{label}</span>}
                        {typeof children === "function" ? children(state) : children}
                    </div>

                    {tooltip && (
                        <Tooltip title={tooltip} placement="top">
                            <TooltipTrigger className="tw:cursor-pointer tw:text-fg-quaternary tw:transition tw:duration-100 tw:ease-linear tw:hover:text-fg-quaternary_hover tw:focus:text-fg-quaternary_hover">
                                <HelpCircle className="tw:size-4" />
                            </TooltipTrigger>
                        </Tooltip>
                    )}

                    {state.allowsSorting &&
                        (state.sortDirection ? (
                            <ArrowDown className={cx("tw:size-3 tw:stroke-[3px] tw:text-fg-quaternary", state.sortDirection === "ascending" && "tw:rotate-180")} />
                        ) : (
                            <ChevronSelectorVertical size={12} strokeWidth={3} className="tw:text-fg-quaternary" />
                        ))}
                </AriaGroup>
            )}
        </AriaColumn>
    );
};
TableHead.displayName = "TableHead";

interface TableRowProps<T extends object>
    extends AriaRowProps<T>,
        Omit<ComponentPropsWithRef<"tr">, "children" | "className" | "onClick" | "slot" | "style" | "id"> {
    highlightSelectedRow?: boolean;
}

const TableRow = <T extends object>({ columns, children, className, highlightSelectedRow = true, ...props }: TableRowProps<T>) => {
    const { size } = useContext(TableContext);
    const { selectionBehavior } = useTableOptions();

    return (
        <AriaRow
            {...props}
            className={(state) =>
                cx(
                    "tw:relative tw:outline-focus-ring tw:transition-colors tw:after:pointer-events-none tw:hover:bg-secondary tw:focus-visible:outline-2 tw:focus-visible:-outline-offset-2",
                    size === "sm" ? "tw:h-14" : "tw:h-18",
                    highlightSelectedRow && "tw:selected:bg-secondary",

                    // Row border—using an "after" pseudo-element to avoid the border taking up space.
                    "tw:[&>td]:after:absolute tw:[&>td]:after:inset-x-0 tw:[&>td]:after:bottom-0 tw:[&>td]:after:h-px tw:[&>td]:after:w-full tw:[&>td]:after:bg-border-secondary tw:last:[&>td]:after:hidden tw:[&>td]:focus-visible:after:opacity-0 tw:focus-visible:[&>td]:after:opacity-0",

                    typeof className === "function" ? className(state) : className,
                )
            }
        >
            {selectionBehavior === "toggle" && (
                <AriaCell className={cx("tw:relative tw:py-2 tw:pr-0 tw:pl-4", size === "sm" ? "tw:md:pl-5" : "tw:md:pl-6")}>
                    <div className="tw:flex tw:items-end">
                        <Checkbox slot="selection" size={size} />
                    </div>
                </AriaCell>
            )}
            <AriaCollection items={columns}>{children}</AriaCollection>
        </AriaRow>
    );
};

TableRow.displayName = "TableRow";

interface TableCellProps extends AriaCellProps, Omit<TdHTMLAttributes<HTMLTableCellElement>, "children" | "className" | "style" | "id"> {
    ref?: Ref<HTMLTableCellElement>;
}

const TableCell = ({ className, children, ...props }: TableCellProps) => {
    const { size } = useContext(TableContext);
    const { selectionBehavior } = useTableOptions();

    return (
        <AriaCell
            {...props}
            className={(state) =>
                cx(
                    "tw:relative tw:text-sm tw:text-tertiary tw:outline-focus-ring tw:focus-visible:z-1 tw:focus-visible:outline-2 tw:focus-visible:-outline-offset-2",
                    size === "sm" && "tw:px-5 tw:py-3",
                    size === "md" && "tw:px-6 tw:py-4",

                    selectionBehavior === "toggle" && "tw:nth-2:pl-3",

                    typeof className === "function" ? className(state) : className,
                )
            }
        >
            {children}
        </AriaCell>
    );
};
TableCell.displayName = "TableCell";

const TableCard = {
    Root: TableCardRoot,
    Header: TableCardHeader,
};

const Table = TableRoot as typeof TableRoot & {
    Body: typeof AriaTableBody;
    Cell: typeof TableCell;
    Head: typeof TableHead;
    Header: typeof TableHeader;
    Row: typeof TableRow;
};
Table.Body = AriaTableBody;
Table.Cell = TableCell;
Table.Head = TableHead;
Table.Header = TableHeader;
Table.Row = TableRow;

export { Table, TableCard };
