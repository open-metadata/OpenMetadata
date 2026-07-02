import {
  ButtonGroup,
  ButtonGroupItem,
} from '@/components/base/button-group/button-group';
import { Button } from '@/components/base/buttons/button';
import { Select } from '@/components/base/select/select';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { cx } from '@/utils/cx';
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from '@untitledui/icons';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { PaginationRootProps } from './pagination-base';
import { Pagination } from './pagination-base';

interface PaginationProps
  extends Partial<Omit<PaginationRootProps, 'children'>> {
  /** Whether the pagination buttons are rounded. */
  rounded?: boolean;
}

const PaginationItem = ({
  value,
  rounded,
  isCurrent,
}: {
  value: number;
  rounded?: boolean;
  isCurrent: boolean;
}) => {
  return (
    <Pagination.Item
      className={({ isSelected }) =>
        cx(
          'tw:flex tw:size-10 tw:cursor-pointer tw:items-center tw:justify-center tw:p-3 tw:text-sm tw:font-medium tw:text-quaternary tw:outline-focus-ring tw:transition tw:duration-100 tw:ease-linear tw:hover:bg-primary_hover tw:hover:text-secondary tw:focus-visible:z-10 tw:focus-visible:bg-primary_hover tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2',
          rounded ? 'tw:rounded-full' : 'tw:rounded-lg',
          isSelected && 'tw:bg-primary_hover tw:text-secondary'
        )
      }
      isCurrent={isCurrent}
      value={value}>
      {value}
    </Pagination.Item>
  );
};

const compactTextClassName =
  'tw:text-xs tw:font-normal tw:leading-[18px] tw:text-secondary';

const compactControlClassName =
  'tw:flex tw:size-6 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg';

const compactPageControlClassName =
  'tw:flex tw:h-6 tw:min-w-6 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:px-1.5';

const compactIconButtonClassName = cx(
  compactControlClassName,
  'tw:border tw:border-primary tw:bg-primary tw:text-fg-quaternary tw:shadow-xs-skeuomorphic tw:outline-focus-ring tw:transition tw:duration-100 tw:ease-linear',
  'tw:hover:bg-primary_hover tw:disabled:cursor-not-allowed tw:disabled:text-fg-disabled'
);

const compactPageItemClassName = ({ isSelected }: { isSelected: boolean }) =>
  cx(
    compactPageControlClassName,
    'tw:cursor-pointer tw:text-xs tw:leading-[18px] tw:outline-focus-ring tw:transition tw:duration-100 tw:ease-linear',
    isSelected
      ? 'tw:bg-tertiary tw:font-medium tw:text-primary'
      : 'tw:bg-transparent tw:font-normal tw:text-quaternary tw:hover:bg-primary_hover tw:hover:text-secondary'
  );

const compactPageInputClassName = cx(
  compactPageControlClassName,
  'tw:w-[30px] tw:min-w-[30px] tw:border tw:border-primary tw:bg-primary tw:px-0 tw:text-center tw:text-xs tw:font-normal tw:leading-[18px] tw:text-secondary tw:shadow-xs tw:outline-none',
  'tw:focus-visible:outline-none'
);

const compactRowsPerPageSelectClassName =
  'tw:w-[44px] tw:shrink-0 tw:gap-0 tw:[&>button]:h-6 tw:[&>button]:rounded-lg tw:[&>button]:outline-none! tw:[&>button]:focus-visible:outline-none! tw:[&>button]:focus-visible:ring-0 tw:[&>button]:focus-visible:ring-offset-0 tw:[&>button>span]:h-6 tw:[&>button>span]:gap-1 tw:[&>button>span]:px-1 tw:[&>button>span]:py-0 tw:[&>button>span>section]:min-w-0 tw:[&>button>span>section]:gap-0 tw:[&>button>span>section>p]:min-w-4 tw:[&>button>span>section>p]:text-center tw:[&>button>span>section>p]:text-xs tw:[&>button>span>section>p]:leading-[18px] tw:[&>button>span>svg]:size-3';

const compactRowsPerPageItemClassName =
  'tw:px-0 tw:[&>div]:h-8 tw:[&>div]:px-2 tw:[&>div]:py-0 tw:[&>div]:outline-none! tw:[&[data-focused]>div]:bg-primary_hover tw:[&[data-selected]>div]:bg-primary tw:[&>div>div]:min-w-0 tw:[&>div>div>span]:text-xs tw:[&>div>div>span]:leading-[18px]';

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

const MobilePagination = ({
  page = 1,
  total = 10,
  className,
  onPageChange,
}: MobilePaginationProps) => {
  return (
    <nav
      aria-label="Pagination"
      className={cx(
        'tw:flex tw:items-center tw:justify-between tw:md:hidden',
        className
      )}>
      <Button
        aria-label="Go to previous page"
        color="secondary"
        iconLeading={ArrowLeft}
        size="sm"
        onClick={() => onPageChange?.(Math.max(1, page - 1))}
      />

      <span className="tw:text-sm tw:text-fg-secondary">
        Page <span className="tw:font-medium">{page}</span> of{' '}
        <span className="tw:font-medium">{total}</span>
      </span>

      <Button
        aria-label="Go to next page"
        color="secondary"
        iconLeading={ArrowRight}
        size="sm"
        onClick={() => onPageChange?.(Math.min(total, page + 1))}
      />
    </nav>
  );
};

export const PaginationPageDefault = ({
  rounded,
  page = 1,
  total = 10,
  className,
  ...props
}: PaginationProps) => {
  const isDesktop = useBreakpoint('md');

  return (
    <Pagination.Root
      {...props}
      className={cx(
        'tw:flex tw:w-full tw:items-center tw:justify-between tw:gap-3 tw:border-t tw:border-secondary tw:pt-4 tw:md:pt-5',
        className
      )}
      page={page}
      total={total}>
      <div className="tw:hidden tw:flex-1 tw:justify-start tw:md:flex">
        <Pagination.PrevTrigger asChild>
          <Button color="link-gray" iconLeading={ArrowLeft} size="sm">
            {isDesktop ? 'Previous' : undefined}{' '}
          </Button>
        </Pagination.PrevTrigger>
      </div>

      <Pagination.PrevTrigger asChild className="tw:md:hidden">
        <Button color="secondary" iconLeading={ArrowLeft} size="sm">
          {isDesktop ? 'Previous' : undefined}
        </Button>
      </Pagination.PrevTrigger>

      <Pagination.Context>
        {({ pages, currentPage, total }) => (
          <>
            <div className="tw:hidden tw:justify-center tw:gap-0.5 tw:md:flex">
              {pages.map((page, index) =>
                page.type === 'page' ? (
                  <PaginationItem key={index} rounded={rounded} {...page} />
                ) : (
                  <Pagination.Ellipsis
                    className="tw:flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:text-tertiary"
                    key={index}>
                    &#8230;
                  </Pagination.Ellipsis>
                )
              )}
            </div>

            <div className="tw:flex tw:justify-center tw:text-sm tw:whitespace-pre tw:text-fg-secondary tw:md:hidden">
              Page <span className="tw:font-medium">{currentPage}</span> of{' '}
              <span className="tw:font-medium">{total}</span>
            </div>
          </>
        )}
      </Pagination.Context>

      <div className="tw:hidden tw:flex-1 tw:justify-end tw:md:flex">
        <Pagination.NextTrigger asChild>
          <Button color="link-gray" iconTrailing={ArrowRight} size="sm">
            {isDesktop ? 'Next' : undefined}
          </Button>
        </Pagination.NextTrigger>
      </div>
      <Pagination.NextTrigger asChild className="tw:md:hidden">
        <Button color="secondary" iconTrailing={ArrowRight} size="sm">
          {isDesktop ? 'Next' : undefined}
        </Button>
      </Pagination.NextTrigger>
    </Pagination.Root>
  );
};

export const PaginationPageMinimalCenter = ({
  rounded,
  page = 1,
  total = 10,
  className,
  ...props
}: PaginationProps) => {
  const isDesktop = useBreakpoint('md');

  return (
    <Pagination.Root
      {...props}
      className={cx(
        'tw:flex tw:w-full tw:items-center tw:justify-between tw:gap-3 tw:border-t tw:border-secondary tw:pt-4 tw:md:pt-5',
        className
      )}
      page={page}
      total={total}>
      <div className="tw:flex tw:flex-1 tw:justify-start">
        <Pagination.PrevTrigger asChild>
          <Button color="secondary" iconLeading={ArrowLeft} size="sm">
            {isDesktop ? 'Previous' : undefined}
          </Button>
        </Pagination.PrevTrigger>
      </div>

      <Pagination.Context>
        {({ pages, currentPage, total }) => (
          <>
            <div className="tw:hidden tw:justify-center tw:gap-0.5 tw:md:flex">
              {pages.map((page, index) =>
                page.type === 'page' ? (
                  <PaginationItem key={index} rounded={rounded} {...page} />
                ) : (
                  <Pagination.Ellipsis
                    className="tw:flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:text-tertiary"
                    key={index}>
                    &#8230;
                  </Pagination.Ellipsis>
                )
              )}
            </div>

            <div className="tw:flex tw:justify-center tw:text-sm tw:whitespace-pre tw:text-fg-secondary tw:md:hidden">
              Page <span className="tw:font-medium">{currentPage}</span> of{' '}
              <span className="tw:font-medium">{total}</span>
            </div>
          </>
        )}
      </Pagination.Context>

      <div className="tw:flex tw:flex-1 tw:justify-end">
        <Pagination.NextTrigger asChild>
          <Button color="secondary" iconTrailing={ArrowRight} size="sm">
            {isDesktop ? 'Next' : undefined}
          </Button>
        </Pagination.NextTrigger>
      </div>
    </Pagination.Root>
  );
};

export const PaginationCardDefault = ({
  rounded,
  page = 1,
  total = 10,
  ...props
}: PaginationProps) => {
  const isDesktop = useBreakpoint('md');

  return (
    <Pagination.Root
      {...props}
      className="tw:flex tw:w-full tw:items-center tw:justify-between tw:gap-3 tw:border-t tw:border-secondary tw:px-4 tw:py-3 tw:md:px-6 tw:md:pt-3 tw:md:pb-4"
      page={page}
      total={total}>
      <div className="tw:flex tw:flex-1 tw:justify-start">
        <Pagination.PrevTrigger asChild>
          <Button color="secondary" iconLeading={ArrowLeft} size="sm">
            {isDesktop ? 'Previous' : undefined}
          </Button>
        </Pagination.PrevTrigger>
      </div>

      <Pagination.Context>
        {({ pages, currentPage, total }) => (
          <>
            <div className="tw:hidden tw:justify-center tw:gap-0.5 tw:md:flex">
              {pages.map((page, index) =>
                page.type === 'page' ? (
                  <PaginationItem key={index} rounded={rounded} {...page} />
                ) : (
                  <Pagination.Ellipsis
                    className="tw:flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:text-tertiary"
                    key={index}>
                    &#8230;
                  </Pagination.Ellipsis>
                )
              )}
            </div>

            <div className="tw:flex tw:justify-center tw:text-sm tw:whitespace-pre tw:text-fg-secondary tw:md:hidden">
              Page <span className="tw:font-medium">{currentPage}</span> of{' '}
              <span className="tw:font-medium">{total}</span>
            </div>
          </>
        )}
      </Pagination.Context>

      <div className="tw:flex tw:flex-1 tw:justify-end">
        <Pagination.NextTrigger asChild>
          <Button color="secondary" iconTrailing={ArrowRight} size="sm">
            {isDesktop ? 'Next' : undefined}
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
  align?: 'left' | 'center' | 'right';
  /** The class name of the pagination component. */
  className?: string;
  /** The function to call when the page changes. */
  onPageChange?: (page: number) => void;
}

export const PaginationCardMinimal = ({
  page = 1,
  total = 10,
  align = 'left',
  onPageChange,
  className,
}: PaginationCardMinimalProps) => {
  return (
    <div
      className={cx(
        'tw:border-t tw:border-secondary tw:px-4 tw:py-3 tw:md:px-6 tw:md:pt-3 tw:md:pb-4',
        className
      )}>
      <MobilePagination page={page} total={total} onPageChange={onPageChange} />

      <nav
        aria-label="Pagination"
        className={cx(
          'tw:hidden tw:items-center tw:gap-3 tw:md:flex',
          align === 'center' && 'tw:justify-between'
        )}>
        <span
          className={cx(
            'tw:text-sm tw:font-medium tw:text-fg-secondary',
            align === 'left' && 'tw:mr-auto',
            align === 'right' && 'tw:order-last tw:ml-auto'
          )}>
          Page {page} of {total}
        </span>

        <div
          className={cx(
            'tw:flex tw:items-center tw:gap-3',
            align === 'center' && 'tw:flex tw:flex-1 tw:justify-end'
          )}>
          <Button
            color="secondary"
            isDisabled={page === 1}
            size="sm"
            onClick={() => onPageChange?.(Math.max(1, page - 1))}>
            Previous
          </Button>

          <Button
            color="secondary"
            isDisabled={page === total}
            size="sm"
            onClick={() => onPageChange?.(Math.min(total, page + 1))}>
            Next
          </Button>
        </div>
      </nav>
    </div>
  );
};

interface PaginationCardWithControlsProps extends PaginationProps {
  /** The selected rows per page value. */
  pageSize?: number;
  /** Available rows per page values. */
  pageSizeOptions?: number[];
  /** The function to call when rows per page changes. */
  onPageSizeChange?: (pageSize: number) => void;
}

export const PaginationCardWithControls = ({
  page = 1,
  total = 10,
  pageSize = 10,
  pageSizeOptions = [10, 25, 50],
  className,
  onPageChange,
  onPageSizeChange,
  ...props
}: PaginationCardWithControlsProps) => {
  const totalPages = Math.max(total, 1);
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const [pageInput, setPageInput] = useState(String(currentPage));
  const pageSizeItems = useMemo(
    () =>
      pageSizeOptions.map((option) => ({
        id: String(option),
        label: String(option),
      })),
    [pageSizeOptions]
  );

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const getValidPage = (nextPage: number) =>
    Math.min(Math.max(nextPage, 1), totalPages);

  const handlePageChange = (nextPage: number) => {
    onPageChange?.(getValidPage(nextPage));
  };

  const handlePageInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;

    if (value === '') {
      setPageInput(value);

      return;
    }

    if (!/^\d+$/.test(value)) {
      return;
    }

    const nextPage = Number(value);
    if (nextPage < 1 || nextPage > totalPages) {
      return;
    }

    setPageInput(value);
  };

  const commitPageInput = () => {
    if (pageInput === '') {
      setPageInput(String(currentPage));

      return;
    }

    const nextPage = getValidPage(Number(pageInput));

    setPageInput(String(nextPage));
    onPageChange?.(nextPage);
  };

  const handlePageInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      commitPageInput();
      event.currentTarget.blur();
    }

    if (event.key === 'Escape') {
      setPageInput(String(currentPage));
      event.currentTarget.blur();
    }
  };

  return (
    <Pagination.Root
      {...props}
      className={cx(
        'tw:m-0 tw:flex tw:w-full tw:rounded-b-xl tw:bg-primary tw:px-4 tw:py-1 tw:shadow-[0px_-1px_2px_rgba(0,0,0,0.05)]',
        className
      )}
      page={currentPage}
      total={totalPages}
      onPageChange={handlePageChange}>
      <div className="tw:m-0 tw:flex tw:w-full tw:max-w-full tw:items-center tw:justify-between tw:gap-6">
        <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-[5px]">
          <span className={compactTextClassName}>Page</span>
          <input
            aria-label="Current page"
            className={compactPageInputClassName}
            inputMode="numeric"
            max={totalPages}
            min={1}
            type="text"
            value={pageInput}
            onBlur={commitPageInput}
            onChange={handlePageInputChange}
            onKeyDown={handlePageInputKeyDown}
          />
          <span className={compactTextClassName}>of {totalPages}</span>
        </div>

        <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-2 tw:py-3">
          <Pagination.PrevTrigger asChild>
            <button className={compactIconButtonClassName} type="button">
              <ChevronLeft className="tw:size-3.5" />
            </button>
          </Pagination.PrevTrigger>

          <Pagination.Context>
            {({ pages }) => (
              <div className="tw:flex tw:items-center tw:gap-1">
                {pages.map((page, index) =>
                  page.type === 'page' ? (
                    <Pagination.Item
                      className={compactPageItemClassName}
                      key={index}
                      {...page}
                      asChild>
                      <button type="button">{page.value}</button>
                    </Pagination.Item>
                  ) : (
                    <Pagination.Ellipsis
                      className="tw:mx-0 tw:flex tw:h-6 tw:w-4 tw:shrink-0 tw:items-center tw:justify-center tw:px-0 tw:text-sm tw:font-medium tw:leading-5 tw:text-quaternary"
                      key={index}>
                      &#8230;
                    </Pagination.Ellipsis>
                  )
                )}
              </div>
            )}
          </Pagination.Context>

          <Pagination.NextTrigger asChild>
            <button className={compactIconButtonClassName} type="button">
              <ChevronRight className="tw:size-3.5" />
            </button>
          </Pagination.NextTrigger>
        </div>

        <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-[5px]">
          <span className={compactTextClassName}>Rows per page</span>
          <Select
            aria-label="Rows per page"
            className={compactRowsPerPageSelectClassName}
            data-testid="rows-per-page-dropdown"
            fontSize="xs"
            items={pageSizeItems}
            placeholder={String(pageSize)}
            popoverClassName="tw:min-w-16!"
            selectedKey={String(pageSize)}
            size="sm"
            onSelectionChange={(key) => onPageSizeChange?.(Number(key))}>
            {(item) => (
              <Select.Item
                className={compactRowsPerPageItemClassName}
                data-testid={`rows-per-page-option-${item.id}`}
                id={item.id}
                key={item.id}
                textValue={item.label}>
                {item.label}
              </Select.Item>
            )}
          </Select>
        </div>
      </div>
    </Pagination.Root>
  );
};

interface PaginationButtonGroupProps
  extends Partial<Omit<PaginationRootProps, 'children'>> {
  /** The alignment of the pagination. */
  align?: 'left' | 'center' | 'right';
}

export const PaginationButtonGroup = ({
  align = 'left',
  page = 1,
  total = 10,
  ...props
}: PaginationButtonGroupProps) => {
  const isDesktop = useBreakpoint('md');

  return (
    <div
      className={cx(
        'tw:flex tw:border-t tw:border-secondary tw:px-4 tw:py-3 tw:md:px-6 tw:md:pt-3 tw:md:pb-4',
        align === 'left' && 'tw:justify-start',
        align === 'center' && 'tw:justify-center',
        align === 'right' && 'tw:justify-end'
      )}>
      <Pagination.Root {...props} page={page} total={total}>
        <Pagination.Context>
          {({ pages }) => (
            <ButtonGroup size="md">
              <Pagination.PrevTrigger asChild>
                <ButtonGroupItem iconLeading={ArrowLeft}>
                  {isDesktop ? 'Previous' : undefined}
                </ButtonGroupItem>
              </Pagination.PrevTrigger>

              {pages.map((page, index) =>
                page.type === 'page' ? (
                  <Pagination.Item key={index} {...page} asChild>
                    <ButtonGroupItem
                      className="tw:size-10 tw:items-center tw:justify-center"
                      isSelected={page.isCurrent}>
                      {page.value}
                    </ButtonGroupItem>
                  </Pagination.Item>
                ) : (
                  <Pagination.Ellipsis key={index}>
                    <ButtonGroupItem className="tw:pointer-events-none tw:size-10 tw:items-center tw:justify-center tw:rounded-none!">
                      &#8230;
                    </ButtonGroupItem>
                  </Pagination.Ellipsis>
                )
              )}

              <Pagination.NextTrigger asChild>
                <ButtonGroupItem iconTrailing={ArrowRight}>
                  {isDesktop ? 'Next' : undefined}
                </ButtonGroupItem>
              </Pagination.NextTrigger>
            </ButtonGroup>
          )}
        </Pagination.Context>
      </Pagination.Root>
    </div>
  );
};
