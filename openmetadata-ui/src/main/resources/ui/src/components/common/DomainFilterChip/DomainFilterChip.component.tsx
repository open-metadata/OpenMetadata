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
import { BadgeWithButton, Typography } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { DEFAULT_DOMAIN_VALUE } from '../../../constants/constants';
import { useDomainStore } from '../../../hooks/useDomainStore';
import { useSwitchActiveDomain } from '../../../hooks/useSwitchActiveDomain';
import { getDomainDisplayName } from '../../../utils/EntityNameUtils';

/** Marks a list as narrowed by the navbar domain; its × clears the selection. */
export const DomainFilterChip = ({ className }: { className?: string }) => {
  const { t } = useTranslation();
  const { activeDomain, activeDomainEntityRef } = useDomainStore();
  const switchActiveDomain = useSwitchActiveDomain();

  if (activeDomain === DEFAULT_DOMAIN_VALUE) {
    return null;
  }
  const domainName = getDomainDisplayName(activeDomainEntityRef, activeDomain);

  return (
    <div
      className={classNames(
        'tw:flex tw:flex-wrap tw:items-center tw:gap-1.5',
        className
      )}
      data-testid="domain-filter-chip">
      <Typography className="tw:text-tertiary" size="text-xs">
        {t('label.filtered-by-domain')}
      </Typography>
      <BadgeWithButton
        buttonLabel={t('label.clear-entity', { entity: t('label.domain') })}
        buttonTestId="domain-filter-chip-clear"
        color="brand"
        size="sm"
        type="pill-color"
        onButtonClick={() => switchActiveDomain(undefined)}>
        {domainName}
      </BadgeWithButton>
    </div>
  );
};
