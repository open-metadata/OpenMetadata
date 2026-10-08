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

import { Dropdown, Tooltip } from '@openmetadata/ui-core-components';
import {
  ChevronDown,
  Globe01 as DomainIcon,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import React, {
  lazy,
  ReactNode,
  Suspense,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_DOMAIN_VALUE } from '../../../constants/constants';
import { EntityReference } from '../../../generated/entity/type';
import { useDomainStore } from '../../../hooks/useDomainStore';
import { getDomainDisplayName } from '../../../utils/EntityNameUtils';

// Each usage renders its own trigger as the Suspense fallback, so the control
// is visible before the picker chunk arrives instead of popping in.
const MENU_PICKER_OFFSET = 20;

const DomainSelectableList = lazy(
  () => import('../DomainSelectableList/DomainSelectableList.component')
);

export interface DomainScopeControlProps {
  /**
   * `menu` is a row inside the AI-sidebar profile menu (its look comes from
   * `children`); `pill` is the pill on the customisable landing-page header.
   * Both open the same picker and write the same global scope.
   */
  variant?: 'menu' | 'pill';
  /** `pill` only — the header renders it inert while not on the home page. */
  disabled?: boolean;
  /** `menu` only — the row content the picker opens from. */
  children?: ReactNode;
}

/**
 * Global domain scope switcher. It shares `useDomainStore` with the classic
 * navbar selector, so picking a domain here changes the app-wide active domain
 * — and, like the navbar, reloads via `navigate(0)` so every domain-scoped view
 * refetches.
 */
const DomainScopeControl: React.FC<DomainScopeControlProps> = ({
  variant = 'menu',
  disabled,
  children,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    activeDomain,
    activeDomainEntityRef,
    updateActiveDomain,
    userDomains,
    isDomainRestricted,
  } = useDomainStore();
  const [isOpen, setIsOpen] = useState(false);

  const domainDisplayName = useMemo(
    () => getDomainDisplayName(activeDomainEntityRef, activeDomain),
    [activeDomainEntityRef, activeDomain]
  );

  const isActiveScope = activeDomain !== DEFAULT_DOMAIN_VALUE;
  const showAllDomains = !isDomainRestricted;
  const isSingleDomainUser = isDomainRestricted && userDomains.length === 1;
  const restrictedDomains = isDomainRestricted ? userDomains : undefined;

  const handleUpdate = useCallback(
    async (domain: EntityReference | EntityReference[] | undefined) => {
      // `undefined` is the "All Domains" reset row clearing the scope; the
      // store takes the sentinel rather than a reference in that case.
      const next = Array.isArray(domain) ? domain[0] : domain;
      updateActiveDomain(next as EntityReference);
      setIsOpen(false);
      navigate(0);
    },
    [navigate, updateActiveDomain]
  );

  // A single-domain user still gets the pill, rendered disabled, since there is
  // no other scope to switch to.
  if (variant === 'pill') {
    const isLocked = Boolean(disabled) || isSingleDomainUser;

    const landingTrigger = (
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={t('label.domain-scope')}
        className={classNames(
          'd-flex items-center gap-2 border-radius-sm p-x-md tw:bg-primary domain-selector',
          { 'domain-active': isActiveScope, disabled: isLocked }
        )}
        data-testid="domain-selector"
        disabled={isLocked}
        type="button">
        <DomainIcon
          className="domain-icon"
          data-testid="domain-icon"
          height={22}
          width={22}
        />
        <span className="text-sm font-medium domain-title">
          {domainDisplayName}
        </span>
        <ChevronDown
          aria-hidden
          className="dropdown-icon"
          data-testid="dropdown-icon"
          height={14}
          width={14}
        />
      </button>
    );

    return (
      <Suspense fallback={landingTrigger}>
        <DomainSelectableList
          hasPermission
          // `isLocked`, not `disabled`: a disabled <button> still receives
          // pointerdown, and DomainSelectTrigger opens on capture-phase
          // pointerdown — so a locked pill would still open the picker.
          disabled={isLocked}
          popoverProps={{ open: isOpen, onOpenChange: setIsOpen }}
          restrictedDomains={restrictedDomains}
          selectedDomain={activeDomainEntityRef}
          showAllDomains={showAllDomains}
          onCancel={() => setIsOpen(false)}
          onUpdate={handleUpdate}>
          {landingTrigger}
        </DomainSelectableList>
      </Suspense>
    );
  }

  if (isSingleDomainUser) {
    return (
      <Dropdown.Item
        isDisabled
        className="tw:*:rounded-[10px]"
        data-testid="ask-domain-scope"
        textValue={t('label.domain-scope')}>
        <Tooltip
          excludeTriggerFromTabOrder
          placement="top"
          title={t('message.domain-access-restricted')}
          triggerClassName="tw:block tw:w-full tw:opacity-60">
          {children}
        </Tooltip>
      </Dropdown.Item>
    );
  }

  return (
    <Dropdown.Item
      className="tw:*:rounded-[10px]"
      data-testid="ask-domain-scope"
      // The picker anchors to this row, so the profile menu must stay open.
      shouldCloseOnSelect={false}
      textValue={t('label.domain-scope')}
      onPress={(e) => {
        // Mouse and touch reach the picker through its own trigger; opening
        // here as well would undo that toggle. Keyboard and assistive-tech
        // presses land on the menu item alone.
        if (e.pointerType === 'keyboard' || e.pointerType === 'virtual') {
          setIsOpen(true);
        }
      }}>
      <Suspense fallback={children}>
        <DomainSelectableList
          fullWidthTrigger
          hasPermission
          className="tw:w-full"
          // Opens beside the menu like its submenus. The picker anchors to the
          // row's content, so the offset clears the row's 16px inset plus the
          // submenus' 4px gap.
          offset={MENU_PICKER_OFFSET}
          placement="right top"
          popoverClassName="tw:w-75 tw:rounded-2xl tw:outline-secondary"
          popoverProps={{ open: isOpen, onOpenChange: setIsOpen }}
          restrictedDomains={restrictedDomains}
          selectedDomain={activeDomainEntityRef}
          showAllDomains={showAllDomains}
          onCancel={() => setIsOpen(false)}
          onUpdate={handleUpdate}>
          {children}
        </DomainSelectableList>
      </Suspense>
    </Dropdown.Item>
  );
};

export default DomainScopeControl;
