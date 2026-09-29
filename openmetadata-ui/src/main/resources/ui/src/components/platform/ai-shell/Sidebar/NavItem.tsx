/*
 *  Copyright 2026 Collate.
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

import classNames from 'classnames';
import { AriaAttributes, forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { IconComponent } from '../AppModule.types';

export interface NavItemProps {
  icon: IconComponent;
  activeIcon?: IconComponent;
  label: string;
  badge?: string;
  active?: boolean;
  dataTestId?: string;
  ariaExpanded?: boolean;
  ariaHasPopup?: AriaAttributes['aria-haspopup'];
  ariaControls?: string;
  /**
   * Destination route. When set the item renders as a real anchor
   * (`<a href>`) so it supports cmd/ctrl-click, middle-click, and the
   * right-click "open in new tab" menu; navigation on a plain click is
   * handled by React Router. When unset the item is a `<button>`.
   */
  href?: string;
  onClick?: () => void;
}

const NavItem = forwardRef<HTMLButtonElement, NavItemProps>(
  (
    {
      icon,
      activeIcon,
      label,
      badge,
      active = false,
      dataTestId,
      ariaExpanded,
      ariaHasPopup,
      ariaControls,
      href,
      onClick,
    },
    ref
  ) => {
    const Icon = active && activeIcon ? activeIcon : icon;
    const className = classNames('ask-nav-item', {
      'ask-nav-item--active': active,
    });
    const content = (
      <>
        <span className="ask-nav-item__icon">
          <Icon height={20} width={20} />
        </span>
        <span className="ask-nav-item__label">{label}</span>
        {badge ? <span className="ask-nav-item__badge">{badge}</span> : null}
      </>
    );

    if (href) {
      return (
        <Link
          aria-controls={ariaControls}
          aria-expanded={ariaExpanded}
          aria-haspopup={ariaHasPopup}
          className={className}
          data-testid={dataTestId}
          to={href}
          onClick={onClick}>
          {content}
        </Link>
      );
    }

    return (
      <button
        aria-controls={ariaControls}
        aria-expanded={ariaExpanded}
        aria-haspopup={ariaHasPopup}
        className={className}
        data-testid={dataTestId}
        ref={ref}
        type="button"
        onClick={onClick}>
        {content}
      </button>
    );
  }
);

NavItem.displayName = 'NavItem';

export default NavItem;
