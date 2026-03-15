import { cx } from "@/utils/cx";
import type { NavItemDividerType, NavItemType } from "../config";
import { NavItemBase } from "./nav-item";

interface NavListProps {
    /** URL of the currently active item. */
    activeUrl?: string;
    /** Additional CSS classes to apply to the list. */
    className?: string;
    /** List of items to display. */
    items: (NavItemType | NavItemDividerType)[];
}

export const NavList = ({ activeUrl, items, className }: NavListProps) => {
    return (
        <ul className={cx("tw:mt-4 tw:flex tw:flex-col tw:px-2 tw:lg:px-4", className)}>
            {items.map((item, index) => {
                if (item.divider) {
                    return (
                        <li key={index} className="tw:w-full tw:px-0.5 tw:py-2">
                            <hr className="tw:h-px tw:w-full tw:border-none tw:bg-border-secondary" />
                        </li>
                    );
                }

                if (item.items?.length) {
                    const isChildActive = item.items.some((subItem) => subItem.href === activeUrl);

                    return (
                        <details
                            key={item.label}
                            open={isChildActive}
                            className="tw:appearance-none tw:py-0.5"
                        >
                            <NavItemBase href={item.href} badge={item.badge} icon={item.icon} type="collapsible">
                                {item.label}
                            </NavItemBase>

                            <dd>
                                <ul className="tw:py-0.5">
                                    {item.items.map((childItem) => (
                                        <li key={childItem.label} className="tw:py-0.5">
                                            <NavItemBase
                                                href={childItem.href}
                                                badge={childItem.badge}
                                                type="collapsible-child"
                                                current={activeUrl === childItem.href}
                                            >
                                                {childItem.label}
                                            </NavItemBase>
                                        </li>
                                    ))}
                                </ul>
                            </dd>
                        </details>
                    );
                }

                return (
                    <li key={item.label} className="tw:py-0.5">
                        <NavItemBase
                            type="link"
                            badge={item.badge}
                            icon={item.icon}
                            href={item.href}
                            current={activeUrl === item.href}
                        >
                            {item.label}
                        </NavItemBase>
                    </li>
                );
            })}
        </ul>
    );
};
