import type { ReactNode } from "react";
import { useState } from "react";
import { SearchLg } from "@untitledui/icons";
import { AnimatePresence, motion } from "motion/react";
import { Input } from "@/components/base/input/input";
import { UntitledLogo } from "@/components/foundations/logo/untitledui-logo";
import { cx } from "@/utils/cx";
import { MobileNavigationHeader } from "../base-components/mobile-header";
import { NavAccountCard } from "../base-components/nav-account-card";
import { NavItemBase } from "../base-components/nav-item";
import { NavList } from "../base-components/nav-list";
import type { NavItemType } from "../config";

interface SidebarNavigationDualTierProps {
    /** URL of the currently active item. */
    activeUrl?: string;
    /** Feature card to display. */
    featureCard?: ReactNode;
    /** List of items to display. */
    items: NavItemType[];
    /** List of footer items to display. */
    footerItems?: NavItemType[];
    /** Whether to hide the right side border. */
    hideBorder?: boolean;
}

export const SidebarNavigationDualTier = ({ activeUrl, hideBorder, items, footerItems = [], featureCard }: SidebarNavigationDualTierProps) => {
    const activeItem = [...items, ...footerItems].find((item) => item.href === activeUrl || item.items?.some((subItem) => subItem.href === activeUrl));
    const [currentItem, setCurrentItem] = useState(activeItem || items[1]);
    const [isHovering, setIsHovering] = useState(false);

    const isSecondarySidebarVisible = isHovering && Boolean(currentItem.items?.length);

    const MAIN_SIDEBAR_WIDTH = 296;
    const SECONDARY_SIDEBAR_WIDTH = 256;

    const mainSidebar = (
        <aside className="group flex h-full max-h-full max-w-full overflow-y-auto bg-primary">
            <div
                style={
                    {
                        "--width": `${MAIN_SIDEBAR_WIDTH}px`,
                    } as React.CSSProperties
                }
                className={cx(
                    "relative flex w-full flex-col border-r border-secondary pt-4 transition duration-300 lg:w-(--width) lg:pt-6",
                    hideBorder && !isSecondarySidebarVisible && "border-transparent",
                )}
            >
                <div className="flex flex-col gap-5 px-4 lg:px-5">
                    <UntitledLogo className="h-8" />
                    <Input shortcut size="sm" aria-label="Search" placeholder="Search" icon={SearchLg} />
                </div>

                <NavList activeUrl={activeUrl} items={items} className="lg:hidden" />

                <ul className="mt-4 hidden flex-col px-4 lg:flex">
                    {items.map((item) => (
                        <li key={item.label + item.href} className="py-0.5">
                            <NavItemBase
                                current={currentItem.href === item.href}
                                href={item.href}
                                badge={item.badge}
                                icon={item.icon}
                                type="link"
                                onClick={() => setCurrentItem(item)}
                            >
                                {item.label}
                            </NavItemBase>
                        </li>
                    ))}
                </ul>
                <div className="mt-auto flex flex-col gap-4 px-2 py-4 lg:px-4 lg:py-6">
                    {footerItems.length > 0 && (
                        <ul className="flex flex-col">
                            {footerItems.map((item) => (
                                <li key={item.label + item.href} className="py-0.5">
                                    <NavItemBase
                                        current={currentItem.href === item.href}
                                        href={item.href}
                                        badge={item.badge}
                                        icon={item.icon}
                                        type="link"
                                        onClick={() => setCurrentItem(item)}
                                    >
                                        {item.label}
                                    </NavItemBase>
                                </li>
                            ))}
                        </ul>
                    )}

                    {featureCard}

                    <NavAccountCard />
                </div>
            </div>
        </aside>
    );

    const secondarySidebar = (
        <AnimatePresence initial={false}>
            {isSecondarySidebarVisible && (
                <motion.div
                    initial={{ width: 0, borderColor: "var(--color-border-secondary)" }}
                    animate={{ width: SECONDARY_SIDEBAR_WIDTH, borderColor: "var(--color-border-secondary)" }}
                    exit={{ width: 0, borderColor: "rgba(0,0,0,0)", transition: { borderColor: { type: "tween", delay: 0.05 } } }}
                    transition={{ type: "spring", damping: 26, stiffness: 220, bounce: 0 }}
                    className={cx("relative h-full overflow-x-hidden overflow-y-auto bg-primary", !hideBorder && "box-content border-r-[1.5px]")}
                >
                    <ul style={{ width: SECONDARY_SIDEBAR_WIDTH }} className="flex h-full flex-col p-4 py-6">
                        {currentItem.items?.map((item) => (
                            <li key={item.label + item.href} className="py-0.5">
                                <NavItemBase current={activeUrl === item.href} href={item.href} icon={item.icon} badge={item.badge} type="link">
                                    {item.label}
                                </NavItemBase>
                            </li>
                        ))}
                    </ul>
                </motion.div>
            )}
        </AnimatePresence>
    );

    return (
        <>
            {/* Mobile header navigation */}
            <MobileNavigationHeader>{mainSidebar}</MobileNavigationHeader>

            {/* Desktop sidebar navigation */}
            <div
                className="z-50 hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex"
                onPointerEnter={() => setIsHovering(true)}
                onPointerLeave={() => setIsHovering(false)}
            >
                {mainSidebar}
                {secondarySidebar}
            </div>

            {/* Placeholder to take up physical space because the real sidebar has `fixed` position. */}
            <div
                style={{
                    paddingLeft: MAIN_SIDEBAR_WIDTH,
                }}
                className="invisible hidden lg:sticky lg:top-0 lg:bottom-0 lg:left-0 lg:block"
            />
        </>
    );
};
