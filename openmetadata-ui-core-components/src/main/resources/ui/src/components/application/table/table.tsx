import type {
  ComponentPropsWithRef,
  HTMLAttributes,
  ReactNode,
  Ref,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react';
import { createContext, isValidElement, useContext } from 'react';
import { useCoreTranslation } from '@/i18n/useCoreTranslation';
import {
  ArrowDown,
  ChevronSelectorVertical,
  Copy01,
  Edit01,
  HelpCircle,
  Trash01,
} from '@untitledui/icons';
import type {
  CellProps as AriaCellProps,
  ColumnProps as AriaColumnProps,
  RowProps as AriaRowProps,
  TableHeaderProps as AriaTableHeaderProps,
  TableProps as AriaTableProps,
} from 'react-aria-components';
import {
  Checkbox as AriaCheckbox,
  Cell as AriaCell,
  Collection as AriaCollection,
  Column as AriaColumn,
  Row as AriaRow,
  Table as AriaTable,
  TableBody as AriaTableBody,
  TableHeader as AriaTableHeader,
  useTableOptions,
} from 'react-aria-components';
import { Badge } from '@/components/base/badges/badges';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { RadioButtonBase } from '@/components/base/radio-buttons/radio-buttons';
import { Dropdown } from '@/components/base/dropdown/dropdown';
import { Tooltip } from '@/components/base/tooltip/tooltip';
import { cx, sortCx } from '@/utils/cx';

export const TableRowActionsDropdown = () => {
  const { t } = useCoreTranslation();

  return (
    <Dropdown.Root>
      <Dropdown.DotsButton />

      <Dropdown.Popover className="tw:w-min">
        <Dropdown.Menu>
          <Dropdown.Item icon={Edit01}>
            <span className="tw:pr-4">{t('label.edit', 'Edit')}</span>
          </Dropdown.Item>
          <Dropdown.Item icon={Copy01}>
            <span className="tw:pr-4">{t('label.copy-link', 'Copy link')}</span>
          </Dropdown.Item>
          <Dropdown.Item icon={Trash01}>
            <span className="tw:pr-4">{t('label.delete', 'Delete')}</span>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

/**
 * `compact` matches the density of the AntD tables this component replaces —
 * entity pages show 20+ rows at a time and the `sm`/`md` heights push a third of
 * them below the fold. See docs/antd-migration/table.md.
 */
type TableSize = 'compact' | 'sm' | 'md';

const DEFAULT_TABLE_SIZE: TableSize = 'md';

/**
 * Every size-dependent class in one place, keyed by size rather than derived
 * through a chain of ternaries at each use. Adding `lg` is then a matter of one
 * more entry here — with the compiler naming any slot left unfilled — instead of
 * hunting down each `size === …` and guessing which branch the new size wants.
 * Same shape as `input.tsx`'s `sizes` map.
 */
/**
 * Kept out of `TABLE_SIZES`: `sortCx` widens its values to `string`, which would
 * lose the literal union the control's own prop expects.
 */
const SELECTION_CONTROL_SIZE: Record<TableSize, 'sm' | 'md'> = {
  compact: 'sm',
  sm: 'sm',
  md: 'md',
};

interface TableSizeStyles {
  cardHeader: string;
  cardTitle: string;
  headerHeight: string;
  headerSelectionColumn: string;
  headPadding: string;
  rowHeight: string;
  rowSelectionCell: string;
  cellPadding: string;
}

const TABLE_SIZES: Record<TableSize, TableSizeStyles> = sortCx({
  compact: {
    cardHeader: 'tw:py-5 tw:md:px-6',
    cardTitle: 'tw:text-lg',
    headerHeight: 'tw:h-8',
    headerSelectionColumn: 'tw:w-9 tw:md:pl-5',
    headPadding: 'tw:px-4',
    rowHeight: 'tw:h-10',
    rowSelectionCell: 'tw:md:pl-5',
    cellPadding: 'tw:px-4 tw:py-2',
  },
  sm: {
    cardHeader: 'tw:py-4 tw:md:px-5',
    cardTitle: 'tw:text-md',
    headerHeight: 'tw:h-9',
    headerSelectionColumn: 'tw:w-9 tw:md:pl-5',
    headPadding: 'tw:px-6',
    rowHeight: 'tw:h-14',
    rowSelectionCell: 'tw:md:pl-5',
    cellPadding: 'tw:px-5 tw:py-3',
  },
  md: {
    cardHeader: 'tw:py-5 tw:md:px-6',
    cardTitle: 'tw:text-lg',
    headerHeight: 'tw:h-11',
    headerSelectionColumn: 'tw:w-11 tw:md:pl-6',
    headPadding: 'tw:px-6',
    rowHeight: 'tw:h-18',
    rowSelectionCell: 'tw:md:pl-6',
    cellPadding: 'tw:px-6 tw:py-4',
  },
});

/**
 * Defaults to `null` rather than a filled-in object: a non-null default would
 * make `useContext` always return a size, and an explicit `size` prop could
 * never win over it.
 */
const TableContext = createContext<{
  size: TableSize;
  stickyHeader: boolean;
} | null>(null);

const TableCardRoot = ({
  children,
  className,
  size = 'md',
  ...props
}: HTMLAttributes<HTMLDivElement> & { size?: TableSize }) => {
  return (
    <TableContext.Provider value={{ size, stickyHeader: false }}>
      <div
        {...props}
        className={cx(
          'tw:overflow-hidden tw:rounded-xl tw:bg-primary tw:shadow-xs tw:outline-1 tw:outline-secondary',
          className
        )}>
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

const TableCardHeader = ({
  title,
  badge,
  description,
  contentTrailing,
  className,
}: TableCardHeaderProps) => {
  const { size } = useContext(TableContext) ?? { size: DEFAULT_TABLE_SIZE };

  return (
    <div
      className={cx(
        'tw:relative tw:flex tw:flex-col tw:items-start tw:gap-4 tw:border-b tw:border-secondary tw:bg-primary tw:px-4 tw:md:flex-row',
        TABLE_SIZES[size].cardHeader,
        className
      )}>
      <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-0.5">
        <div className="tw:flex tw:items-center tw:gap-2">
          <h2
            className={cx(
              'tw:font-semibold tw:text-primary',
              TABLE_SIZES[size].cardTitle
            )}>
            {title}
          </h2>
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
        {description && (
          <p className="tw:text-sm tw:text-tertiary">{description}</p>
        )}
      </div>
      {contentTrailing}
    </div>
  );
};

interface TableRootProps
  extends AriaTableProps,
    Omit<ComponentPropsWithRef<'table'>, 'className' | 'slot' | 'style'> {
  size?: TableSize;
  stickyHeader?: boolean;
  containerStyle?: React.CSSProperties;
  containerClassName?: string;
}

const TableRoot = ({
  className,
  size,
  stickyHeader = false,
  containerStyle,
  containerClassName,
  ...props
}: TableRootProps) => {
  const context = useContext(TableContext);
  // An explicit prop wins; otherwise inherit an enclosing TableCard's size.
  const resolvedSize = size ?? context?.size ?? DEFAULT_TABLE_SIZE;

  return (
    <TableContext.Provider value={{ size: resolvedSize, stickyHeader }}>
      <div
        className={cx('tw:overflow-x-auto', containerClassName)}
        style={containerStyle}>
        <AriaTable
          className={(state) =>
            cx(
              'tw:w-full tw:overflow-x-hidden',
              typeof className === 'function' ? className(state) : className
            )
          }
          {...props}
        />
      </div>
    </TableContext.Provider>
  );
};
TableRoot.displayName = 'Table';

interface TableHeaderProps<T extends object>
  extends AriaTableHeaderProps<T>,
    Omit<
      ComponentPropsWithRef<'thead'>,
      'children' | 'className' | 'slot' | 'style'
    > {
  bordered?: boolean;
}

const TableHeader = <T extends object>({
  columns,
  children,
  bordered = true,
  className,
  ...props
}: TableHeaderProps<T>) => {
  const { size, stickyHeader } = useContext(TableContext) ?? {
    size: DEFAULT_TABLE_SIZE,
    stickyHeader: false,
  };
  const { selectionBehavior, selectionMode } = useTableOptions();

  return (
    <AriaTableHeader
      {...props}
      className={(state) =>
        cx(
          'tw:bg-secondary',
          stickyHeader ? 'tw:sticky tw:top-0 tw:z-10' : 'tw:relative',
          TABLE_SIZES[size].headerHeight,

          // Row border—using an "after" pseudo-element to avoid the border taking up space.
          bordered &&
            'tw:[&>tr>th]:after:pointer-events-none tw:[&>tr>th]:after:absolute tw:[&>tr>th]:after:inset-x-0 tw:[&>tr>th]:after:bottom-0 tw:[&>tr>th]:after:h-px tw:[&>tr>th]:after:bg-border-secondary tw:[&>tr>th]:focus-visible:after:bg-transparent',

          typeof className === 'function' ? className(state) : className
        )
      }>
      {selectionBehavior === 'toggle' && (
        <AriaColumn
          className={cx(
            'tw:relative tw:py-2 tw:pr-0 tw:pl-4',
            TABLE_SIZES[size].headerSelectionColumn
          )}>
          {selectionMode === 'multiple' && (
            <div className="tw:flex tw:items-start">
              <Checkbox size={SELECTION_CONTROL_SIZE[size]} slot="selection" />
            </div>
          )}
        </AriaColumn>
      )}
      <AriaCollection items={columns}>{children}</AriaCollection>
    </AriaTableHeader>
  );
};

TableHeader.displayName = 'TableHeader';

interface TableHeadProps
  extends AriaColumnProps,
    Omit<
      ThHTMLAttributes<HTMLTableCellElement>,
      'children' | 'className' | 'style' | 'id'
    > {
  label?: string;
  tooltip?: string;
}

const TableHead = ({
  className,
  tooltip,
  label,
  children,
  ...props
}: TableHeadProps) => {
  const { selectionBehavior } = useTableOptions();
  const { size } = useContext(TableContext) ?? { size: DEFAULT_TABLE_SIZE };

  return (
    <AriaColumn
      {...props}
      className={(state) =>
        cx(
          // Focus indicator drawn with outline, not a ring (WebKit does not pixel-snap
          // box-shadow). `outline-hidden` is gone — it would suppress this indicator.
          // `ring-offset-bg-primary` is dropped: it set an offset *colour* while
          // --tw-ring-offset-width defaults to 0px, so it never rendered.
          'tw:relative tw:p-0 tw:py-2 tw:focus-visible:z-1 tw:focus-visible:outline-2 tw:focus-visible:-outline-offset-2 tw:focus-visible:outline-focus-ring',
          TABLE_SIZES[size].headPadding,
          selectionBehavior === 'toggle' && 'tw:nth-2:pl-3',
          state.allowsSorting && 'tw:cursor-pointer',
          typeof className === 'function' ? className(state) : className
        )
      }>
      {(state) => (
        // Layout only — a real Group (role="group") here makes Chromium
        // compute an EMPTY accessible name for the columnheader, breaking
        // every getByRole('columnheader', { name }) locator.
        <div className="tw:flex tw:items-center tw:gap-1">
          <div className="tw:flex tw:items-center tw:gap-1">
            {label && (
              <span className="tw:text-xs tw:font-semibold tw:whitespace-nowrap tw:text-quaternary">
                {label}
              </span>
            )}
            {typeof children === 'function' ? children(state) : children}
          </div>

          {tooltip && (
            <Tooltip
              placement="top"
              title={tooltip}
              triggerClassName="tw:cursor-pointer tw:text-fg-quaternary tw:transition tw:duration-100 tw:ease-linear tw:hover:text-fg-quaternary_hover tw:focus:text-fg-quaternary_hover">
              <HelpCircle className="tw:size-4" />
            </Tooltip>
          )}

          {state.allowsSorting &&
            (state.sortDirection ? (
              <ArrowDown
                className={cx(
                  'tw:size-3 tw:stroke-[3px] tw:text-fg-quaternary',
                  state.sortDirection === 'ascending' && 'tw:rotate-180'
                )}
              />
            ) : (
              <ChevronSelectorVertical
                className="tw:text-fg-quaternary"
                size={12}
                strokeWidth={3}
              />
            ))}
        </div>
      )}
    </AriaColumn>
  );
};
TableHead.displayName = 'TableHead';

interface TableRowProps<T extends object>
  extends AriaRowProps<T>,
    Omit<
      ComponentPropsWithRef<'tr'>,
      'children' | 'className' | 'onClick' | 'slot' | 'style' | 'id'
    > {
  highlightSelectedRow?: boolean;
}

const TableRow = <T extends object>({
  columns,
  children,
  className,
  highlightSelectedRow = true,
  ...props
}: TableRowProps<T>) => {
  const { size } = useContext(TableContext) ?? { size: DEFAULT_TABLE_SIZE };
  const { selectionBehavior, selectionMode } = useTableOptions();
  const { t } = useCoreTranslation();

  return (
    <AriaRow
      {...props}
      className={(state) =>
        cx(
          // No `after:` utilities on the row itself: the variant injects
          // `content: ''`, and a content box inside a table-row is wrapped in
          // an anonymous table cell — a phantom column that Chrome 151's
          // fixed-layout algorithm counts when splitting leftover width, so
          // every table came up one column-share short of its own right edge.
          'tw:relative tw:outline-focus-ring tw:transition-colors tw:hover:bg-secondary tw:focus-visible:outline-2 tw:focus-visible:-outline-offset-2',
          TABLE_SIZES[size].rowHeight,
          highlightSelectedRow && 'tw:selected:bg-secondary',

          // Row border—using an "after" pseudo-element to avoid the border taking up space.
          'tw:[&>td]:after:pointer-events-none tw:[&>td]:after:absolute tw:[&>td]:after:inset-x-0 tw:[&>td]:after:bottom-0 tw:[&>td]:after:h-px tw:[&>td]:after:w-full tw:[&>td]:after:bg-border-secondary tw:last:[&>td]:after:hidden tw:[&>td]:focus-visible:after:opacity-0 tw:focus-visible:[&>td]:after:opacity-0',

          typeof className === 'function' ? className(state) : className
        )
      }>
      {selectionBehavior === 'toggle' && (
        <AriaCell
          className={cx(
            'tw:relative tw:py-2 tw:pr-0 tw:pl-4',
            TABLE_SIZES[size].rowSelectionCell
          )}>
          <div className="tw:flex tw:items-end">
            {selectionMode === 'single' ? (
              // A single-selection table reads as a radio group: picking a row
              // clears the previous pick. React Aria still wires the control
              // through the `selection` slot, so the visual is swapped rather
              // than the behaviour.
              //
              // Known limitation: the `selection` slot only accepts a
              // checkbox, so this announces as "checkbox" while looking like a
              // radio. ARIA does not allow role="radio" on an
              // input[type=checkbox], and React Aria has no radio-based table
              // selection, so the honest options are a checkbox that announces
              // wrongly or re-implementing selection, focus and keyboard
              // handling outside the table's own state. The label at least says
              // only one row can be picked, so the announcement is not
              // misleading about the affordance.
              <AriaCheckbox
                aria-label={t('label.select-only-one-row', 'Select one row')}
                className="tw:flex tw:items-center tw:outline-hidden"
                slot="selection">
                {({ isSelected, isDisabled, isFocusVisible }) => (
                  <RadioButtonBase
                    isDisabled={isDisabled}
                    isFocusVisible={isFocusVisible}
                    isSelected={isSelected}
                    size={SELECTION_CONTROL_SIZE[size]}
                  />
                )}
              </AriaCheckbox>
            ) : (
              <Checkbox size={SELECTION_CONTROL_SIZE[size]} slot="selection" />
            )}
          </div>
        </AriaCell>
      )}
      <AriaCollection items={columns}>{children}</AriaCollection>
    </AriaRow>
  );
};

TableRow.displayName = 'TableRow';

interface TableCellProps
  extends AriaCellProps,
    Omit<
      TdHTMLAttributes<HTMLTableCellElement>,
      'children' | 'className' | 'style' | 'id'
    > {
  ref?: Ref<HTMLTableCellElement>;
}

const TableCell = ({ className, children, ...props }: TableCellProps) => {
  const { size } = useContext(TableContext) ?? { size: DEFAULT_TABLE_SIZE };
  const { selectionBehavior } = useTableOptions();

  return (
    <AriaCell
      {...props}
      className={(state) =>
        cx(
          'tw:relative tw:text-sm tw:text-tertiary tw:outline-focus-ring tw:focus-visible:z-1 tw:focus-visible:outline-2 tw:focus-visible:-outline-offset-2',
          TABLE_SIZES[size].cellPadding,

          selectionBehavior === 'toggle' && 'tw:nth-2:pl-3',

          typeof className === 'function' ? className(state) : className
        )
      }>
      {children}
    </AriaCell>
  );
};
TableCell.displayName = 'TableCell';

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
