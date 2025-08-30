"use client";

import { type FC, type ReactNode, isValidElement } from "react";
import { cx } from "@/utils/cx";
import { isReactComponent } from "@/utils/is-react-component";

interface NavMenuItemLinkProps {
    href: string;
    icon?: FC<{ className?: string }> | ReactNode;
    iconClassName?: string;
    className?: string;
    title: string;
    subtitle?: string;
    badge?: ReactNode;
    actionsContent?: ReactNode;
}

export const NavMenuItemLink = ({ href, icon: Icon, iconClassName, title, badge, subtitle, className, actionsContent }: NavMenuItemLinkProps) => (
    <a
        href={href}
        className={cx(
            "inline-flex w-full gap-3 px-4 py-3 outline-focus-ring transition duration-100 ease-linear hover:bg-primary_hover focus-visible:outline-2 sm:max-w-80 sm:p-3 md:rounded-lg",
            className,
        )}
    >
        {isValidElement(Icon) && Icon}
        {isReactComponent(Icon) && <Icon className={cx("mt-0.5 size-4 shrink-0 stroke-[2.3px] text-fg-brand-primary", iconClassName)} />}

        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                    <span className="text-md font-semibold text-primary">{title}</span>
                    {badge}
                </div>

                {subtitle && <span className="line-clamp-2 text-sm text-tertiary">{subtitle}</span>}
            </div>

            {actionsContent}
        </div>
    </a>
);
