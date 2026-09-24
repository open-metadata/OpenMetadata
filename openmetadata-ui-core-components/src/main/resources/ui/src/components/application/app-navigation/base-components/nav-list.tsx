import { cx } from '@/utils/cx';
import type { NavItemDividerType, NavItemType } from '../config';
import type { NavItemSize } from './nav-item';
import { NavItemBase } from './nav-item';

interface NavListProps {
  /** URL of the currently active item. */
  activeUrl?: string;
  /** Additional CSS classes to apply to the list. */
  className?: string;
  /** List of items to display. */
  items: (NavItemType | NavItemDividerType)[];
  /** Text and icon size passed to every item. Defaults to `md`. */
  size?: NavItemSize;
}

export const NavList = ({
  activeUrl,
  items,
  className,
  size = 'md',
}: NavListProps) => {
  return (
    <ul
      className={cx(
        'tw:mt-4 tw:flex tw:flex-col tw:px-2 tw:lg:px-4',
        className
      )}>
      {items.map((item, index) => {
        if (item.divider) {
          return (
            <li className="tw:w-full tw:px-0.5 tw:py-2" key={index}>
              <hr className="tw:h-px tw:w-full tw:border-none tw:bg-border-secondary" />
            </li>
          );
        }

        if (item.items?.length) {
          const isChildActive = item.items.some(
            (subItem) => subItem.href === activeUrl
          );

          return (
            <details
              className="tw:appearance-none tw:py-0.5"
              key={item.href ?? item.label}
              open={isChildActive}>
              <NavItemBase
                badge={item.badge}
                href={item.href}
                icon={item.icon}
                size={size}
                type="collapsible">
                {item.label}
              </NavItemBase>

              <dd>
                <ul className="tw:py-0.5">
                  {item.items.map((childItem) => (
                    <li className="tw:py-0.5" key={childItem.href}>
                      <NavItemBase
                        badge={childItem.badge}
                        current={activeUrl === childItem.href}
                        href={childItem.href}
                        size={size}
                        type="collapsible-child">
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
          // Keyed by href: labels (e.g. entity display names) need not be unique.
          <li className="tw:py-0.5" key={item.href ?? item.label}>
            <NavItemBase
              badge={item.badge}
              current={activeUrl === item.href}
              href={item.href}
              icon={item.icon}
              size={size}
              type="link">
              {item.label}
            </NavItemBase>
          </li>
        );
      })}
    </ul>
  );
};
