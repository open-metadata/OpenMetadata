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
import { Typography } from 'antd';
import classNames from 'classnames';
import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as DropdownIcon } from '../../../../assets/svg/drop-down.svg';
import { ReactComponent as DomainIcon } from '../../../../assets/svg/ic-domain.svg';
import { DEFAULT_DOMAIN_VALUE } from '../../../../constants/constants';
import type { EntityReference } from '../../../../generated/entity/type';
import { useDomainStore } from '../../../../hooks/useDomainStore';
import { getDomainDisplayName } from '../../../../utils/EntityNameUtils';
import DomainSelectableList from '../../../common/DomainSelectableList/DomainSelectableList.component';

interface LandingPageDomainSelectorProps {
  disabled?: boolean;
}

const LandingPageDomainSelector = ({
  disabled,
}: LandingPageDomainSelectorProps) => {
  const navigate = useNavigate();
  const {
    activeDomain,
    activeDomainEntityRef,
    updateActiveDomain,
    isDomainRestricted,
  } = useDomainStore();
  const handleDomainChange = useCallback(
    async (domain: EntityReference | EntityReference[]) => {
      updateActiveDomain(domain as EntityReference);
      navigate(0);
    },
    [updateActiveDomain, navigate]
  );

  const domainDisplayName = useMemo(
    () => getDomainDisplayName(activeDomainEntityRef, activeDomain),
    [activeDomainEntityRef, activeDomain]
  );

  return (
    <DomainSelectableList
      hasPermission
      disabled={disabled}
      selectedDomain={activeDomainEntityRef}
      showAllDomains={!isDomainRestricted}
      wrapInButton={false}
      onUpdate={handleDomainChange}>
      <div
        className={classNames(
          'd-flex items-center gap-2 border-radius-sm p-x-md bg-white domain-selector',
          {
            'domain-active': activeDomain !== DEFAULT_DOMAIN_VALUE,
            disabled,
          }
        )}
        data-testid="domain-selector"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          // The picker opens via DomainSelectableList's click-capture wrapper;
          // synthesize a click so keyboard users get the same behaviour.
          if (e.key === 'Enter' || e.key === ' ') {
            e.currentTarget.click();
          }
        }}>
        <DomainIcon
          className="domain-icon"
          data-testid="domain-icon"
          height={22}
          width={22}
        />
        <Typography.Text className="text-sm font-medium domain-title">
          {domainDisplayName}
        </Typography.Text>
        <DropdownIcon
          className="dropdown-icon"
          data-testid="dropdown-icon"
          height={14}
          width={14}
        />
      </div>
    </DomainSelectableList>
  );
};

export default LandingPageDomainSelector;
