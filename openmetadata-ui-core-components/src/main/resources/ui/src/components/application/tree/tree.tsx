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
  useDragAndDrop,
} from 'react-aria-components';

export type { Key, Selection } from 'react-aria-components';

// ---- TreeItemMoveEvent --------------------------------------------------

export interface TreeItemMoveEvent {
  /** The key of the item being dragged. */
  sourceKey: Key;
  /** The key of the target item. */
  targetKey: Key;
  /** Drop position relative to the target item. */
  dropPosition: 'before' | 'after' | 'on';
}

// ---- Tree ---------------------------------------------------------------

export interface TreeProps<T extends object>
  extends Omit<AriaTreeProps<T>, 'className' | 'children'> {
  /** Additional CSS class name for the tree container. */
  className?: string;
  /** The contents of the tree. */
  children?: ReactNode | ((item: T) => ReactNode);
  /**
   * When provided, enables drag-and-drop reordering. Called whenever an item
   * is dropped onto or around another item. The Tree wires `useDragAndDrop`
   * internally — consumers don't need to import it from react-aria-components.
   *
   * When `onItemMove` is set it takes precedence over a manually passed
   * `dragAndDropHooks` prop.
   */
  onItemMove?: (event: TreeItemMoveEvent) => void;
  /**
   * Called when an item is dropped onto the root of the tree (empty space,
   * outside any existing item). Use this to move the dragged item to the
   * top level. Receives the source key of the dragged item.
   * Only active when `onItemMove` is also provided.
   */
  onItemRootDrop?: (sourceKey: Key) => void;
}

const TreeRoot = <T extends object>({
  className,
  children,
  onItemMove,
  onItemRootDrop,
  ...props
}: TreeProps<T>) => {
  const { dragAndDropHooks: internalHooks } = useDragAndDrop({
    getItems: onItemMove
      ? (keys) => Array.from(keys).map((key) => ({ 'text/plain': String(key) }))
      : (undefined as never),
    onMove: onItemMove
      ? (e) => {
          const sourceKey = Array.from(e.keys)[0];
          onItemMove({
            sourceKey,
            targetKey: e.target.key,
            dropPosition: e.target.dropPosition,
          });
        }
      : undefined,
    onRootDrop: onItemRootDrop
      ? async (e) => {
          const item = e.items.find((i) => i.kind === 'text');
          const sourceKey = await item?.getText('text/plain');
          if (sourceKey) {
            onItemRootDrop(sourceKey);
          }
        }
      : undefined,
  });

  return (
    <AriaTree
      {...props}
      className={cx(
        'tw:outline-hidden tw:w-full tw:flex tw:flex-col tw:gap-0.5',
        className
      )}
      dragAndDropHooks={onItemMove ? internalHooks : props.dragAndDropHooks}>
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
          'data-[dragging]:tw:opacity-50 data-[dragging]:tw:ring-2 data-[dragging]:tw:ring-inset data-[dragging]:tw:ring-brand-300',
          'data-[drop-target]:tw:bg-brand-primary_alt data-[drop-target]:tw:ring-2 data-[drop-target]:tw:ring-inset data-[drop-target]:tw:ring-brand-300',
          typeof className === 'function' ? className(state) : className
        )
      }>
      {children}
    </AriaTreeItem>
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
          'tw:transition-transform tw:duration-200 tw:ease-in-out tw:cursor-pointer',
          state.isFocusVisible && 'tw:ring-2 tw:ring-brand-300',
          className
        )
      }
      slot="chevron">
      <ChevronRight
        aria-hidden="true"
        className="tw:w-3.5 tw:h-3.5 tw:group-data-expanded/tree-item:rotate-90 tw:transition-transform tw:duration-200"
      />
    </AriaButton>
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
   * When `true`, an animated expand/collapse chevron button is rendered.
   * Set to `false` to render your own expand indicator. Defaults to `true`.
   */
  showExpandIcon?: boolean;
  /**
   * Override whether the item has child items. When provided, this value
   * is used instead of React Aria's internal `hasChildItems` — useful for
   * lazy-loaded trees where children aren't in the DOM yet but the node is
   * known to have children (e.g. from a `childrenCount` field).
   * When `undefined`, falls back to React Aria's `hasChildItems`.
   */
  hasChildItems?: boolean;
  /**
   * When `true`, draws a vertical guide line for nested items (level >= 2).
   * Rendered as an absolutely-positioned `<span>` using Tailwind classes.
   * Defaults to `false`.
   */
  showGuideLines?: boolean;
}

const TreeItemContentComponent = ({
  className,
  children,
  icon: Icon,
  iconClassName,
  showExpandIcon = true,
  showGuideLines = false,
  hasChildItems: hasChildItemsProp,
}: TreeItemContentProps) => {
  return (
    <AriaTreeItemContent>
      {(renderProps: TreeItemContentRenderProps) => {
        const { hasChildItems: hasChildItemsFromAria, level } = renderProps;
        const hasChildItems = hasChildItemsProp ?? hasChildItemsFromAria;

        return (
          <div
            className={cx(
              'tw:relative tw:flex tw:items-center tw:gap-3 tw:py-1.5 tw:pr-1.5',
              'tw:rounded-md tw:text-sm tw:font-medium tw:text-secondary',
              'tw:hover:bg-primary_hover',
              'tw:group-selected/tree-item:bg-brand-primary_alt tw:group-selected/tree-item:text-brand-secondary',
              className
            )}
            style={{ marginLeft: `${(level - 1) * 16 + 2}px` }}>
            {showGuideLines && level >= 2 && (
              <span
                aria-hidden="true"
                className="tw:absolute tw:top-0 tw:bottom-0 tw:w-px tw:bg-gray-blue-100 tw:pointer-events-none"
                style={{ left: '-10px' }}
              />
            )}
            {showExpandIcon && (
              <TreeExpandButton
                className={cx(
                  !hasChildItems && 'tw:invisible tw:pointer-events-none'
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

// ---- Compound export ----------------------------------------------------

/**
 * Tree renders a hierarchical list of items with keyboard navigation,
 * selection, expand/collapse, and optional drag-and-drop support.
 * Built on React Aria's Tree primitives for full accessibility.
 *
 * Pass `onItemMove` to enable drag-and-drop without importing useDragAndDrop:
 * ```tsx
 * <Tree onItemMove={({ sourceKey, targetKey, dropPosition }) => { ... }}>
 * ```
 *
 * Pass `showGuideLines` on `Tree.ItemContent` to render vertical indent lines:
 * ```tsx
 * <Tree.ItemContent showGuideLines>...</Tree.ItemContent>
 * ```
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
  TreeSectionComponent as TreeSection
};

