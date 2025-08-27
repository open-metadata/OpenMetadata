import { SearchLg } from "@untitledui/icons";
import { Input } from "@/components/base/input/input";
import { UntitledLogo } from "@/components/foundations/logo/untitledui-logo";
import { MobileNavigationHeader } from "../base-components/mobile-header";
import { NavAccountCard } from "../base-components/nav-account-card";
import { NavList } from "../base-components/nav-list";
import type { NavItemDividerType, NavItemType } from "../config";

interface SidebarNavigationSectionDividersProps {
    /** URL of the currently active item. */
    activeUrl?: string;
    /** List of items to display. */
    items: (NavItemType | NavItemDividerType)[];
}

export const SidebarNavigationSectionDividers = ({ activeUrl, items }: SidebarNavigationSectionDividersProps) => {
    const MAIN_SIDEBAR_WIDTH = 292;

    const content = (
        <aside
            style={
                {
                    "--width": `${MAIN_SIDEBAR_WIDTH}px`,
                } as React.CSSProperties
            }
            className="flex h-full w-full max-w-full flex-col justify-between overflow-auto border-secondary bg-primary pt-4 shadow-xs md:border-r lg:w-(--width) lg:rounded-xl lg:border lg:pt-5"
        >
            <div className="flex flex-col gap-5 px-4 lg:px-5">
                <UntitledLogo className="h-8" />
                <Input shortcut size="sm" aria-label="Search" placeholder="Search" icon={SearchLg} />
            </div>

            <NavList activeUrl={activeUrl} items={items} className="mt-5" />

            <div className="mt-auto flex flex-col gap-5 px-2 py-4 lg:gap-6 lg:px-4 lg:py-4">
                <NavAccountCard />
            </div>
        </aside>
    );

    return (
        <>
            {/* Mobile header navigation */}
            <MobileNavigationHeader>{content}</MobileNavigationHeader>

            {/* Desktop sidebar navigation */}
            <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:py-1 lg:pl-1">{content}</div>

            {/* Placeholder to take up physical space because the real sidebar has `fixed` position. */}
            <div
                style={{
                    paddingLeft: MAIN_SIDEBAR_WIDTH + 4, // Add 4px to account for the padding in the sidebar wrapper
                }}
                className="invisible hidden lg:sticky lg:top-0 lg:bottom-0 lg:left-0 lg:block"
            />
        </>
    );
};
