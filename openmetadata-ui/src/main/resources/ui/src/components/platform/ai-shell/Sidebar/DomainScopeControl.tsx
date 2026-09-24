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

import { ButtonUtility, Tooltip } from '@openmetadata/ui-core-components';
import {
  ChevronDown,
  Domain as DomainIcon,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import React, { lazy, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_DOMAIN_VALUE } from '../../../../constants/constants';
import { EntityReference } from '../../../../generated/entity/type';
import { useDomainStore } from '../../../../hooks/useDomainStore';
import { getDomainDisplayName } from '../../../../utils/EntityNameUtils';
import withSuspenseFallback from '../../../AppRouter/withSuspenseFallback';

const DomainSelectableList = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../../../common/DomainSelectableList/DomainSelectableList.component'
      )
  )
);

export interface DomainScopeControlProps {
  /**
   * `panel` is the expanded sidebar card (globe + caption + domain name);
   * `rail` is the collapsed icon-only trigger with a tooltip. Both open the
   * same menu as the classic navbar domain selector.
   */
  variant?: 'panel' | 'rail';
}

/**
 * Domain scope filter docked at the bottom of the AI-mode sidebar. It shares the
 * global `useDomainStore` with the classic navbar selector, so picking a domain
 * here changes the app-wide active domain — and, like the navbar, reloads via
 * `navigate(0)` so every domain-scoped view refetches.
 */
const DomainScopeControl: React.FC<DomainScopeControlProps> = ({
  variant = 'panel',
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
    async (domain: EntityReference | EntityReference[]) => {
      updateActiveDomain(domain as EntityReference);
      setIsOpen(false);
      navigate(0);
    },
    [navigate, updateActiveDomain]
  );

  const cardClassName = classNames(
    'ask-domain-scope__card tw:flex tw:w-full tw:items-center tw:gap-2.5 tw:rounded-lg tw:border tw:px-3 tw:py-2 tw:text-left',
    isActiveScope
      ? 'tw:border-brand tw:bg-brand-primary'
      : 'tw:border-secondary tw:bg-surface tw:hover:bg-secondary'
  );

  const cardInner = (
    <>
      <DomainIcon
        className="tw:shrink-0 tw:text-brand-secondary"
        height={20}
        width={20}
      />
      <span className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
        <span className="tw:text-xs tw:font-medium tw:text-brand-secondary">
          {t('label.domain-scope')}
        </span>
        <span
          className="tw:truncate tw:text-sm tw:font-semibold tw:text-primary"
          data-testid="ask-domain-scope-name">
          {domainDisplayName}
        </span>
      </span>
      {isActiveScope && (
        <span
          aria-hidden
          className="tw:size-2 tw:shrink-0 tw:rounded-full tw:bg-fg-success-primary"
          data-testid="ask-domain-scope-dot"
        />
      )}
      <ChevronDown
        aria-hidden
        className="tw:size-4 tw:shrink-0 tw:text-quaternary"
      />
    </>
  );

  // Restricted (single-domain) users cannot switch scope, so there is no menu
  // to open. Render a disabled, non-interactive affordance that still explains
  // the restriction — mirroring the navbar's disabled selector.
  if (isSingleDomainUser) {
    const restrictedMessage = t('message.domain-access-restricted');

    return variant === 'rail' ? (
      <ButtonUtility
        isDisabled
        aria-label={t('label.domain-scope')}
        className="ask-domain-scope__rail-btn"
        color="tertiary"
        data-testid="ask-domain-scope-rail"
        icon={DomainIcon}
        size="sm"
        tooltip={restrictedMessage}
        tooltipPlacement="right"
      />
    ) : (
      <Tooltip placement="top" title={restrictedMessage}>
        <span
          aria-disabled
          className={classNames(
            cardClassName,
            'tw:cursor-not-allowed tw:opacity-60'
          )}
          data-testid="ask-domain-scope-card">
          {cardInner}
        </span>
      </Tooltip>
    );
  }

  const trigger =
    variant === 'rail' ? (
      <ButtonUtility
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={t('label.domain-scope')}
        className={classNames('ask-domain-scope__rail-btn', {
          'ask-domain-scope__rail-btn--active': isActiveScope,
        })}
        color="tertiary"
        data-testid="ask-domain-scope-rail"
        icon={DomainIcon}
        size="sm"
        tooltip={domainDisplayName}
        tooltipPlacement="right"
        onClick={() => setIsOpen((open) => !open)}
      />
    ) : (
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={cardClassName}
        data-testid="ask-domain-scope-card"
        type="button"
        onClick={() => setIsOpen((open) => !open)}>
        {cardInner}
      </button>
    );

  return (
    <DomainSelectableList
      hasPermission
      className={variant === 'rail' ? undefined : 'tw:w-full'}
      popoverProps={{
        open: isOpen,
        placement: variant === 'rail' ? 'topLeft' : 'topRight',
        onOpenChange: setIsOpen,
      }}
      restrictedDomains={restrictedDomains}
      selectedDomain={activeDomainEntityRef}
      showAllDomains={showAllDomains}
      wrapInButton={false}
      onCancel={() => setIsOpen(false)}
      onUpdate={handleUpdate}>
      {trigger}
    </DomainSelectableList>
  );
};

export default DomainScopeControl;
