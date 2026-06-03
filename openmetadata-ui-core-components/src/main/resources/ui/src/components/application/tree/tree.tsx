/*
 *  Copyright 2025 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import { cx } from '@/utils/cx';
import { ChevronRight, RefreshCw01 } from '@untitledui/icons';
import type {
  ComponentPropsWithRef,
  ComponentType,
  HTMLAttributes,
  ReactNode,
} from 'react';
import type {
  TreeItemProps as AriaTreeItemProps,
  TreeLoadMoreItemProps as AriaTreeLoadMoreItemProps,
  TreeProps as AriaTreeProps,
  Key,
  Selection,
  TreeItemContentRenderProps,
} from 'react-aria-components';
import {
  Button as AriaButton,
  Tree as AriaTree,
  TreeHeader as AriaTreeHeader,
  TreeItem as AriaTreeItem,
  TreeItemContent as AriaTreeItemContent,
  TreeLoadMoreItem as AriaTreeLoadMoreItem,
  TreeSection as AriaTreeSection,
} from 'react-aria-components';

export type { Key, Selection };

// ---- Tree ---------------------------------------------------------------

export interface TreeProps<T extends object>
  extends Omit<AriaTreeProps<T>, 'className' | 'children'> {
  /** Additional CSS class name for the tree container. */
  className?: string;
  /** The contents of the tree. */
  children?: ReactNode | ((item: T) => ReactNode);
}

const TreeRoot = <T extends object>({
  className,
  children,
  ...props
}: TreeProps<T>) => {
  return (
    <AriaTree
      {...props}
      className={cx(
        'tw:outline-hidden tw:w-full tw:flex tw:flex-col tw:gap-0.5',
        className
      )}>
      {children as AriaTreeProps<T>['children']}
    </AriaTree>
  );
};

// ---- TreeItem -----------------------------------------------------------

export interface TreeItemProps<T extends object>
  extends Omit<AriaTreeItemProps<T>, 'children'> {
  /** The content of this tree item. Typically `Tree.ItemContent`. */
  children: ReactNode;
  /** Additional CSS class name applied to the item row. */
  className?: string | AriaTreeItemProps<T>['className'];
}

const TreeItemComponent = <T extends object>({
  className,
  children,
  ...props
}: TreeItemProps<T>) => {
  return (
    <AriaTreeItem
      {...props}
      className={(state) =>
        cx(
          'tw:group/tree-item tw:outline-hidden tw:rounded-md',
          'tw:cursor-pointer tw:select-none',
          state.isDisabled && 'tw:opacity-50 tw:cursor-not-allowed',
          state.isFocusVisible && 'tw:ring-2 tw:ring-inset tw:ring-brand-300',
          typeof className === 'function' ? className(state) : className
        )
      }>
      {children}
    </AriaTreeItem>
  );
};

// ---- TreeItemContent ----------------------------------------------------

export interface TreeItemContentProps {
  /**
   * The content to render. Can be static ReactNode or a render function
   * receiving `TreeItemContentRenderProps`.
   */
  children:
    | ReactNode
    | ((renderProps: TreeItemContentRenderProps) => ReactNode);
  /** Additional CSS class name for the content wrapper. */
  className?: string;
  /**
   * Optional icon component rendered between the chevron and the label.
   * Accepts any `@untitledui/icons`-compatible component.
   */
  icon?: ComponentType<HTMLAttributes<HTMLOrSVGElement>>;
  /** Additional CSS class name applied to the icon. */
  iconClassName?: string;
  /**
   * When `true`, an animated expand/collapse chevron is rendered automatically.
   * Set to `false` to render your own expand indicator. Defaults to `true`.
   */
  showExpandIcon?: boolean;
}

const TreeItemContentComponent = ({
  className,
  children,
  icon: Icon,
  iconClassName,
  showExpandIcon = true,
}: TreeItemContentProps) => {
  return (
    <AriaTreeItemContent>
      {(renderProps: TreeItemContentRenderProps) => {
        const { isExpanded, hasChildItems, level } = renderProps;

        return (
          <div
            className={cx(
              'tw:flex tw:items-center tw:gap-1 tw:py-1.5 tw:pr-2',
              'tw:rounded-md tw:text-sm tw:font-medium tw:text-secondary',
              'hover:tw:bg-primary_hover',
              'tw:group-data-selected/tree-item:bg-brand-primary_alt tw:group-data-selected/tree-item:text-brand-secondary',
              className
            )}
            style={{ paddingLeft: `${(level - 1) * 16 + 8}px` }}>
            {showExpandIcon && (
              <ChevronRight
                aria-hidden="true"
                className={cx(
                  'tw:w-4 tw:h-4 tw:shrink-0 tw:text-fg-quaternary tw:transition-transform tw:duration-200 tw:ease-in-out',
                  hasChildItems ? isExpanded && 'tw:rotate-90' : 'tw:invisible'
                )}
              />
            )}
            {Icon && (
              <Icon
                aria-hidden="true"
                className={cx(
                  'tw:w-4 tw:h-4 tw:shrink-0 tw:text-fg-quaternary',
                  iconClassName
                )}
              />
            )}
            {typeof children === 'function' ? children(renderProps) : children}
          </div>
        );
      }}
    </AriaTreeItemContent>
  );
};

// ---- TreeLoadMoreItem ---------------------------------------------------

export type TreeLoadMoreItemProps = Omit<
  AriaTreeLoadMoreItemProps,
  'className' | 'children'
> & {
  /** Additional CSS class name for the load-more row. */
  className?: string;
  /** Content shown inside the row. Defaults to a spinner + "Loading…" / "Load more". */
  children?: ReactNode;
};

const TreeLoadMoreItemComponent = ({
  isLoading,
  children,
  className,
  ...props
}: TreeLoadMoreItemProps) => {
  return (
    <AriaTreeLoadMoreItem
      {...props}
      className={cx(
        'tw:flex tw:items-center tw:justify-center tw:px-3 tw:py-1.5 tw:text-sm tw:text-tertiary',
        className
      )}
      isLoading={isLoading}>
      {isLoading ? (
        <span className="tw:flex tw:items-center tw:gap-2">
          <RefreshCw01
            aria-hidden="true"
            className="tw:h-4 tw:w-4 tw:animate-spin"
          />
          {children ?? 'Loading…'}
        </span>
      ) : (
        children ?? 'Load more'
      )}
    </AriaTreeLoadMoreItem>
  );
};

// ---- TreeSection --------------------------------------------------------

export type TreeSectionProps<T extends object> = ComponentPropsWithRef<
  typeof AriaTreeSection<T>
>;

const TreeSectionComponent = <T extends object>(props: TreeSectionProps<T>) => (
  <AriaTreeSection {...props} />
);

// ---- TreeHeader ---------------------------------------------------------

export interface TreeHeaderProps {
  children?: ReactNode;
  className?: string;
}

const TreeHeaderComponent = ({ className, children }: TreeHeaderProps) => {
  return (
    <AriaTreeHeader
      className={cx(
        'tw:px-3 tw:py-1 tw:text-xs tw:font-semibold tw:text-tertiary tw:uppercase tw:tracking-wide',
        className
      )}>
      {children}
    </AriaTreeHeader>
  );
};

// ---- TreeExpandButton ---------------------------------------------------

export interface TreeExpandButtonProps
  extends Omit<ComponentPropsWithRef<typeof AriaButton>, 'className'> {
  /** Additional CSS class name. */
  className?: string;
}

/**
 * An accessible expand/collapse button for use inside `Tree.ItemContent`.
 * Render with slot="chevron" so React Aria's Tree handles keyboard & ARIA.
 */
const TreeExpandButton = ({ className, ...props }: TreeExpandButtonProps) => {
  return (
    <AriaButton
      {...props}
      className={(state) =>
        cx(
          'tw:flex tw:items-center tw:justify-center tw:w-4 tw:h-4 tw:shrink-0',
          'tw:rounded tw:outline-hidden tw:text-fg-quaternary',
          'tw:transition-transform tw:duration-200 tw:ease-in-out',
          state.isFocusVisible && 'tw:ring-2 tw:ring-brand-300',
          className
        )
      }
      slot="chevron">
      <ChevronRight
        aria-hidden="true"
        className="tw:w-4 tw:h-4 tw:group-data-expanded/tree-item:rotate-90 tw:transition-transform tw:duration-200"
      />
    </AriaButton>
  );
};

// ---- Compound export ----------------------------------------------------

/**
 * Tree renders a hierarchical list of items with keyboard navigation,
 * selection, and expand/collapse support. Built on React Aria's Tree
 * primitives for full accessibility.
 *
 * @example
 * ```tsx
 * <Tree selectionMode="single">
 *   <Tree.Item id="databases" textValue="Databases">
 *     <Tree.ItemContent>Databases</Tree.ItemContent>
 *     <Tree.Item id="postgres" textValue="Postgres">
 *       <Tree.ItemContent>Postgres</Tree.ItemContent>
 *     </Tree.Item>
 *   </Tree.Item>
 * </Tree>
 * ```
 */
const _Tree = TreeRoot as typeof TreeRoot & {
  Item: typeof TreeItemComponent;
  ItemContent: typeof TreeItemContentComponent;
  LoadMoreItem: typeof TreeLoadMoreItemComponent;
  Section: typeof TreeSectionComponent;
  Header: typeof TreeHeaderComponent;
  ExpandButton: typeof TreeExpandButton;
};

_Tree.Item = TreeItemComponent;
_Tree.ItemContent = TreeItemContentComponent;
_Tree.LoadMoreItem = TreeLoadMoreItemComponent;
_Tree.Section = TreeSectionComponent;
_Tree.Header = TreeHeaderComponent;
_Tree.ExpandButton = TreeExpandButton;

export {
  _Tree as Tree,
  TreeExpandButton,
  TreeHeaderComponent as TreeHeader,
  TreeItemComponent as TreeItem,
  TreeItemContentComponent as TreeItemContent,
  TreeLoadMoreItemComponent as TreeLoadMoreItem,
  TreeSectionComponent as TreeSection,
};
