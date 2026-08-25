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

import {
    Popover,
    PopoverTrigger,
    Tooltip,
    TooltipTrigger
} from '@openmetadata/ui-core-components';
import { DotsHorizontal } from '@untitledui/icons';
import classNames from 'classnames';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { handleNavItemClick, MainNavItem, resolveNavHref } from './navConfig';
import NavItem from './NavItem';
import { useActiveNavKey } from './useActiveNavKey';

const POPOVER_CONTAINER_CLASS = 'tw:min-w-[240px] tw:max-w-[280px] tw:p-2';
const MORE_POPOVER_ID = 'ask-more-nav-popover';

export interface MoreNavPopoverProps {
  items: MainNavItem[];
  /** 'panel' renders a full-width NavItem trigger; 'rail' an icon button. */
  variant: 'panel' | 'rail';
}

/**
 * "More" entry for the app-mode sidebar — nav items beyond the directly
 * visible slice live behind this popover in both the expanded panel and the
 * collapsed rail.
 */
const MoreNavPopover: React.FC<MoreNavPopoverProps> = ({ items, variant }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const activeKey = useActiveNavKey();
  const [open, setOpen] = useState(false);
  const panelTriggerRef = useRef<HTMLButtonElement>(null);

  const hasActiveItem = items.some((item) => item.key === activeKey);

  const handleItemClick = useCallback(
    (item: MainNavItem) => {
      // Navigable items carry an href and navigate via the anchor; only
      // action-only items need the imperative handler. Either way, close the
      // popover.
      if (resolveNavHref(item.action) === undefined) {
        handleNavItemClick({ item, navigate });
      }
      setOpen(false);
    },
    [navigate]
  );

  if (items.length === 0) {
    return null;
  }

  const popoverBody = (
    <nav
      className="tw:flex tw:flex-col tw:gap-1"
      data-testid={MORE_POPOVER_ID}
      id={MORE_POPOVER_ID}>
      {items.map((item) => (
        <NavItem
          active={activeKey === item.key}
          activeIcon={item.activeIcon}
          badge={item.badgeKey ? t(item.badgeKey) : undefined}
          dataTestId={`ask-more-nav-item-${item.key}`}
          href={resolveNavHref(item.action)}
          icon={item.icon}
          key={item.key}
          label={t(item.labelKey)}
          onClick={() => handleItemClick(item)}
        />
      ))}
    </nav>
  );

  // Panel reuses the shared NavItem as its trigger; since a plain button
  // can't consume PopoverTrigger's react-aria context, it anchors the popover
  // via `triggerRef` instead and toggles the controlled open state.
  // `shouldCloseOnInteractOutside` excludes the trigger from the popover's
  // interact-outside dismissal so a press on it toggles cleanly (open ->
  // close) instead of racing dismiss-then-reopen.
  if (variant === 'panel') {
    return (
      <>
        <NavItem
          active={hasActiveItem || open}
          ariaControls={open ? MORE_POPOVER_ID : undefined}
          ariaExpanded={open}
          ariaHasPopup="dialog"
          dataTestId="ask-nav-item-more"
          icon={DotsHorizontal}
          label={t('label.more')}
          ref={panelTriggerRef}
          onClick={() => setOpen((prev) => !prev)}
        />
        <Popover
          className="tw:overflow-hidden"
          containerClassName={POPOVER_CONTAINER_CLASS}
          isOpen={open}
          placement="right"
          shouldCloseOnInteractOutside={(element) =>
            !panelTriggerRef.current?.contains(element)
          }
          triggerRef={panelTriggerRef}
          onOpenChange={setOpen}>
          {popoverBody}
        </Popover>
      </>
    );
  }

  return (
    <PopoverTrigger isOpen={open} onOpenChange={setOpen}>
      <Tooltip arrow placement="right" title={t('label.more')}>
        <TooltipTrigger
          aria-label={t('label.more')}
          className={classNames('ask-rail__item', {
            'ask-rail__item--active': hasActiveItem || open,
          })}
          data-testid="ask-rail-item-more">
          <DotsHorizontal height={20} width={20} />
        </TooltipTrigger>
      </Tooltip>
      <Popover
        className="tw:overflow-hidden"
        containerClassName={POPOVER_CONTAINER_CLASS}
        placement="right">
        {popoverBody}
      </Popover>
    </PopoverTrigger>
  );
};

export default MoreNavPopover;
