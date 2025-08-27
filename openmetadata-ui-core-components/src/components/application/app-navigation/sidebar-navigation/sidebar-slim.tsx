import type { FC } from "react";
import { useState } from "react";
import { LifeBuoy01, LogOut01, Settings01 } from "@untitledui/icons";
import { AnimatePresence, motion } from "motion/react";
import { Button as AriaButton, DialogTrigger as AriaDialogTrigger, Popover as AriaPopover } from "react-aria-components";
import { Avatar } from "@/components/base/avatar/avatar";
import { AvatarLabelGroup } from "@/components/base/avatar/avatar-label-group";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { UntitledLogo } from "@/components/foundations/logo/untitledui-logo";
import { UntitledLogoMinimal } from "@/components/foundations/logo/untitledui-logo-minimal";
import { cx } from "@/utils/cx";
import { MobileNavigationHeader } from "../base-components/mobile-header";
import { NavAccountMenu } from "../base-components/nav-account-card";
import { NavItemBase } from "../base-components/nav-item";
import { NavItemButton } from "../base-components/nav-item-button";
import { NavList } from "../base-components/nav-list";
import type { NavItemType } from "../config";

interface SidebarNavigationSlimProps {
    /** URL of the currently active item. */
    activeUrl?: string;
    /** List of items to display. */
    items: (NavItemType & { icon: FC<{ className?: string }> })[];
    /** List of footer items to display. */
    footerItems?: (NavItemType & { icon: FC<{ className?: string }> })[];
    /** Whether to hide the border. */
    hideBorder?: boolean;
    /** Whether to hide the right side border. */
    hideRightBorder?: boolean;
}

export const SidebarNavigationSlim = ({ activeUrl, items, footerItems = [], hideBorder, hideRightBorder }: SidebarNavigationSlimProps) => {
    const activeItem = [...items, ...footerItems].find((item) => item.href === activeUrl || item.items?.some((subItem) => subItem.href === activeUrl));
    const [currentItem, setCurrentItem] = useState(activeItem || items[1]);
    const [isHovering, setIsHovering] = useState(false);

    const isSecondarySidebarVisible = isHovering && Boolean(currentItem.items?.length);

    const MAIN_SIDEBAR_WIDTH = 68;
    const SECONDARY_SIDEBAR_WIDTH = 268;

    const mainSidebar = (
        <aside
            style={{
                width: MAIN_SIDEBAR_WIDTH,
            }}
            className="group flex h-full max-h-full max-w-full overflow-y-auto bg-primary py-1 pl-1"
        >
            <div
                className={cx(
                    "flex w-auto flex-col justify-between rounded-xl pt-5 ring-1 ring-secondary transition duration-300 ring-inset",
                    hideBorder && !isSecondarySidebarVisible && "ring-transparent",
                )}
            >
                <div className="flex justify-center px-3">
                    <UntitledLogoMinimal className="size-8" />
                </div>

                <ul className="mt-4 flex flex-col gap-0.5 px-3">
                    {items.map((item) => (
                        <li key={item.label}>
                            <NavItemButton
                                size="md"
                                current={currentItem.href === item.href}
                                href={item.href}
                                label={item.label || ""}
                                icon={item.icon}
                                onClick={() => setCurrentItem(item)}
                            />
                        </li>
                    ))}
                </ul>
                <div className="mt-auto flex flex-col gap-4 px-3 py-5">
                    {footerItems.length > 0 && (
                        <ul className="flex flex-col gap-0.5">
                            {footerItems.map((item) => (
                                <li key={item.label}>
                                    <NavItemButton
                                        size="md"
                                        current={currentItem.href === item.href}
                                        label={item.label || ""}
                                        href={item.href}
                                        icon={item.icon}
                                        onClick={() => setCurrentItem(item)}
                                    />
                                </li>
                            ))}
                        </ul>
                    )}

                    <AriaDialogTrigger>
                        <AriaButton
                            className={({ isPressed, isFocused }) =>
                                cx("group relative inline-flex rounded-full", (isPressed || isFocused) && "outline-2 outline-offset-2 outline-focus-ring")
                            }
                        >
                            <Avatar status="online" src="https://www.untitledui.com/images/avatars/olivia-rhye?fm=webp&q=80" size="md" alt="Olivia Rhye" />
                        </AriaButton>
                        <AriaPopover
                            placement="right bottom"
                            offset={8}
                            crossOffset={6}
                            className={({ isEntering, isExiting }) =>
                                cx(
                                    "will-change-transform",
                                    isEntering &&
                                        "duration-300 ease-out animate-in fade-in placement-right:slide-in-from-left-2 placement-top:slide-in-from-bottom-2 placement-bottom:slide-in-from-top-2",
                                    isExiting &&
                                        "duration-150 ease-in animate-out fade-out placement-right:slide-out-to-left-2 placement-top:slide-out-to-bottom-2 placement-bottom:slide-out-to-top-2",
                                )
                            }
                        >
                            <NavAccountMenu />
                        </AriaPopover>
                    </AriaDialogTrigger>
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
                    className={cx(
                        "relative h-full overflow-x-hidden overflow-y-auto bg-primary",
                        !(hideBorder || hideRightBorder) && "box-content border-r-[1.5px]",
                    )}
                >
                    <div style={{ width: SECONDARY_SIDEBAR_WIDTH }} className="flex h-full flex-col px-4 pt-6">
                        <h3 className="text-sm font-semibold text-brand-secondary">{currentItem.label}</h3>
                        <ul className="py-2">
                            {currentItem.items?.map((item) => (
                                <li key={item.label} className="py-0.5">
                                    <NavItemBase current={activeUrl === item.href} href={item.href} icon={item.icon} badge={item.badge} type="link">
                                        {item.label}
                                    </NavItemBase>
                                </li>
                            ))}
                        </ul>
                        <div className="sticky bottom-0 mt-auto flex justify-between border-t border-secondary bg-primary px-2 py-5">
                            <div>
                                <p className="text-sm font-semibold text-primary">Olivia Rhye</p>
                                <p className="text-sm text-tertiary">olivia@untitledui.com</p>
                            </div>
                            <div className="absolute top-2.5 right-0">
                                <ButtonUtility size="sm" color="tertiary" tooltip="Log out" icon={LogOut01} />
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    return (
        <>
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

            {/* Mobile header navigation */}
            <MobileNavigationHeader>
                <aside className="group flex h-full max-h-full w-full max-w-full flex-col justify-between overflow-y-auto bg-primary pt-4">
                    <div className="px-4">
                        <UntitledLogo className="h-8" />
                    </div>

                    <NavList items={items} />

                    <div className="mt-auto flex flex-col gap-5 px-2 py-4">
                        <div className="flex flex-col gap-2">
                            <NavItemBase current={activeUrl === "/support"} type="link" href="/support" icon={LifeBuoy01}>
                                Support
                            </NavItemBase>
                            <NavItemBase current={activeUrl === "/settings"} type="link" href="/settings" icon={Settings01}>
                                Settings
                            </NavItemBase>
                        </div>

                        <div className="relative flex items-center gap-3 border-t border-secondary pt-6 pr-8 pl-2">
                            <AvatarLabelGroup
                                status="online"
                                size="md"
                                src="https://www.untitledui.com/images/avatars/olivia-rhye?fm=webp&q=80"
                                title="Olivia Rhye"
                                subtitle="olivia@untitledui.com"
                            />

                            <div className="absolute top-1/2 right-0 -translate-y-1/2">
                                <Button
                                    size="sm"
                                    color="tertiary"
                                    iconLeading={<LogOut01 className="size-5 text-fg-quaternary transition-inherit-all group-hover:text-fg-quaternary_hover" />}
                                    className="p-1.5!"
                                />
                            </div>
                        </div>
                    </div>
                </aside>
            </MobileNavigationHeader>
        </>
    );
};
