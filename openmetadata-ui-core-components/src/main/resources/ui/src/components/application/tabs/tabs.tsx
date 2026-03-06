import type { ComponentPropsWithRef, ReactNode } from "react";
import { Fragment, createContext, useContext } from "react";
import type { TabListProps as AriaTabListProps, TabProps as AriaTabProps, TabRenderProps as AriaTabRenderProps } from "react-aria-components";
import { Tab as AriaTab, TabList as AriaTabList, TabPanel as AriaTabPanel, Tabs as AriaTabs, TabsContext, useSlottedContext } from "react-aria-components";
import type { BadgeColors } from "@/components/base/badges/badge-types";
import { Badge } from "@/components/base/badges/badges";
import { cx } from "@/utils/cx";

type Orientation = "horizontal" | "vertical";

// Types for different orientations
type HorizontalTypes = "button-brand" | "button-gray" | "button-border" | "button-minimal" | "underline";
type VerticalTypes = "button-brand" | "button-gray" | "button-border" | "button-minimal" | "line";
type TabTypeColors<T> = T extends "horizontal" ? HorizontalTypes : VerticalTypes;

// Styles for different types of tab
const getTabStyles = ({ isFocusVisible, isSelected, isHovered }: AriaTabRenderProps) => ({
    "button-brand": cx(
        "tw:outline-focus-ring",
        isFocusVisible && "tw:outline-2 tw:-outline-offset-2",
        (isSelected || isHovered) && "tw:bg-brand-primary_alt tw:text-brand-secondary",
    ),
    "button-gray": cx(
        "tw:outline-focus-ring",
        isHovered && "tw:bg-primary_hover tw:text-secondary",
        isFocusVisible && "tw:outline-2 tw:-outline-offset-2",
        isSelected && "tw:bg-active tw:text-secondary",
    ),
    "button-border": cx(
        "tw:outline-focus-ring",
        (isSelected || isHovered) && "tw:bg-primary_alt tw:text-secondary tw:shadow-sm",
        isFocusVisible && "tw:outline-2 tw:-outline-offset-2",
    ),
    "button-minimal": cx(
        "tw:rounded-lg tw:outline-focus-ring",
        isHovered && "tw:text-secondary",
        isFocusVisible && "tw:outline-2 tw:-outline-offset-2",
        isSelected && "tw:bg-primary_alt tw:text-secondary tw:shadow-xs tw:ring-1 tw:ring-primary tw:ring-inset",
    ),
    underline: cx(
        "tw:rounded-none tw:border-b-2 tw:border-transparent tw:outline-focus-ring",
        (isSelected || isHovered) && "tw:border-fg-brand-primary_alt tw:text-brand-secondary",
        isFocusVisible && "tw:outline-2 tw:-outline-offset-2",
    ),
    line: cx(
        "tw:rounded-none tw:border-l-2 tw:border-transparent tw:outline-focus-ring",
        (isSelected || isHovered) && "tw:border-fg-brand-primary_alt tw:text-brand-secondary",
        isFocusVisible && "tw:outline-2 tw:-outline-offset-2",
    ),
});

const sizes = {
    sm: {
        "button-brand": "tw:text-sm tw:font-semibold tw:py-2 tw:px-3",
        "button-gray": "tw:text-sm tw:font-semibold tw:py-2 tw:px-3",
        "button-border": "tw:text-sm tw:font-semibold tw:py-2 tw:px-3",
        "button-minimal": "tw:text-sm tw:font-semibold tw:py-2 tw:px-3",
        underline: "tw:text-sm tw:font-semibold tw:px-1 tw:pb-2.5 tw:pt-0",
        line: "tw:text-sm tw:font-semibold tw:pl-2.5 tw:pr-3 tw:py-0.5",
    },
    md: {
        "button-brand": "tw:text-md tw:font-semibold tw:py-2.5 tw:px-3",
        "button-gray": "tw:text-md tw:font-semibold tw:py-2.5 tw:px-3",
        "button-border": "tw:text-md tw:font-semibold tw:py-2.5 tw:px-3",
        "button-minimal": "tw:text-md tw:font-semibold tw:py-2.5 tw:px-3",
        underline: "tw:text-md tw:font-semibold tw:px-1 tw:pb-2.5 tw:pt-0",
        line: "tw:text-md tw:font-semibold tw:pr-3.5 tw:pl-3 tw:py-1",
    },
};

// Styles for different types of horizontal tabs
const getHorizontalStyles = ({ size, fullWidth }: { size?: "sm" | "md"; fullWidth?: boolean }) => ({
    "button-brand": "tw:gap-1",
    "button-gray": "tw:gap-1",
    "button-border": cx("tw:gap-1 tw:rounded-[10px] tw:bg-secondary_alt tw:p-1 tw:ring-1 tw:ring-secondary tw:ring-inset", size === "md" && "tw:rounded-xl tw:p-1.5"),
    "button-minimal": "tw:gap-0.5 tw:rounded-lg tw:bg-secondary_alt tw:ring-1 tw:ring-inset tw:ring-secondary",
    underline: cx("tw:gap-3", fullWidth && "tw:w-full tw:gap-4"),
    line: "tw:gap-2",
});

const getColorStyles = ({ isSelected, isHovered }: Partial<AriaTabRenderProps>) => ({
    "button-brand": isSelected || isHovered ? "brand" : "gray",
    "button-gray": "gray",
    "button-border": "gray",
    "button-minimal": "gray",
    underline: isSelected || isHovered ? "brand" : "gray",
    line: isSelected || isHovered ? "brand" : "gray",
});

type TabListBaseProps<K extends Orientation> = {
    /** The size of the tab list. */
    size?: keyof typeof sizes;
    /** The type of the tab list. */
    type?: TabTypeColors<K>;
    /** The orientation of the tab list. */
    orientation?: K;
    /** Whether the tab list is full width. */
    fullWidth?: boolean;
};

/** Dynamic variant: provide an items array and a render function as children. */
type TabListWithItemsProps<K extends Orientation> = TabListBaseProps<K> &
    Omit<AriaTabListProps<TabComponentProps>, "children"> & {
        items: TabComponentProps[];
        children?: (item: TabComponentProps) => ReactNode;
    };

/** Static variant: provide children directly as JSX elements. */
type TabListWithChildrenProps<K extends Orientation> = TabListBaseProps<K> &
    Omit<AriaTabListProps<TabComponentProps>, "items" | "children"> & {
        items?: never;
        children: ReactNode;
    };

type TabListComponentProps<K extends Orientation> =
    | TabListWithItemsProps<K>
    | TabListWithChildrenProps<K>;

const TabListContext = createContext<TabListBaseProps<Orientation> & { orientation?: Orientation }>({
    size: "sm",
    type: "button-brand",
});

export const TabList = <K extends Orientation>({
    size = "sm",
    type = "button-brand",
    orientation: orientationProp,
    fullWidth,
    className,
    children,
    ...otherProps
}: TabListComponentProps<K>) => {
    const context = useSlottedContext(TabsContext);

    const orientation = orientationProp ?? context?.orientation ?? "horizontal";

    return (
        <TabListContext.Provider value={{ size, type, orientation, fullWidth }}>
            <AriaTabList
                {...(otherProps as AriaTabListProps<TabComponentProps>)}
                className={(state) =>
                    cx(
                        "tw:group tw:flex",

                        getHorizontalStyles({
                            size,
                            fullWidth,
                        })[type as HorizontalTypes],

                        orientation === "vertical" && "tw:w-max tw:flex-col",

                        // Only horizontal tabs with underline type have bottom border
                        orientation === "horizontal" &&
                            type === "underline" &&
                            "tw:relative tw:before:absolute tw:before:inset-x-0 tw:before:bottom-0 tw:before:h-px tw:before:bg-border-secondary",

                        typeof className === "function" ? className(state) : className,
                    )
                }
            >
                {children ?? ((item) => <Tab {...item}>{item.children}</Tab>)}
            </AriaTabList>
        </TabListContext.Provider>
    );
};

export const TabPanel = (props: ComponentPropsWithRef<typeof AriaTabPanel>) => {
    return (
        <AriaTabPanel
            {...props}
            className={(state) =>
                cx(
                    "tw:outline-focus-ring tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2",
                    typeof props.className === "function" ? props.className(state) : props.className,
                )
            }
        />
    );
};

interface TabComponentProps extends AriaTabProps {
    /** The label of the tab. */
    label?: ReactNode;
    /** The children of the tab. */
    children?: ReactNode | ((props: AriaTabRenderProps) => ReactNode);
    /** The badge displayed next to the label. */
    badge?: number | string;
}

export const Tab = (props: TabComponentProps) => {
    const { label, children, badge, ...otherProps } = props;
    const { size = "sm", type = "button-brand", fullWidth } = useContext(TabListContext);

    return (
        <AriaTab
            {...otherProps}
            className={(prop) =>
                cx(
                    "tw:z-10 tw:flex tw:h-max tw:cursor-pointer tw:items-center tw:justify-center tw:gap-2 tw:rounded-md tw:whitespace-nowrap tw:text-quaternary tw:transition tw:duration-100 tw:ease-linear",
                    "group-orientation-vertical:tw:justify-start",
                    fullWidth && "tw:w-full tw:flex-1",
                    sizes[size][type],
                    getTabStyles(prop)[type],
                    typeof props.className === "function" ? props.className(prop) : props.className,
                )
            }
        >
            {(state) => (
                <Fragment>
                    {typeof children === "function" ? children(state) : children || label}
                    {badge && (
                        <Badge
                            size={size}
                            type="pill-color"
                            color={getColorStyles(state)[type] as BadgeColors}
                            className={cx("tw:hidden tw:transition-inherit-all tw:md:flex", size === "sm" && "tw:-my-px")}
                        >
                            {badge}
                        </Badge>
                    )}
                </Fragment>
            )}
        </AriaTab>
    );
};

export const Tabs = ({ className, ...props }: ComponentPropsWithRef<typeof AriaTabs>) => {
    return (
        <AriaTabs
            keyboardActivation="manual"
            {...props}
            className={(state) => cx("tw:flex tw:w-full tw:flex-col", typeof className === "function" ? className(state) : className)}
        />
    );
};

Tabs.Panel = TabPanel;
Tabs.List = TabList;
Tabs.Item = Tab;
