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

import { Dropdown } from '@openmetadata/ui-core-components';
import { ChevronDown } from '@untitledui/icons';
import { Key, useMemo } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MARKETPLACE_NAV_ITEMS } from '../../../constants/MarketplaceNav.constants';

const MarketplaceNav = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const navItems = useMemo(
    () =>
      MARKETPLACE_NAV_ITEMS.map((item) => ({
        id: item.redirect_url ?? item.children?.[0]?.redirect_url ?? item.key,
        label: t(item.title),
        icon: item.icon,
      })),
    [t]
  );

  const handleAction = (key: Key) => {
    navigate(key.toString());
  };

  return (
    <Dropdown.Root>
      <AriaButton className="tw:flex tw:items-center tw:gap-1 tw:cursor-pointer tw:border-none tw:bg-transparent tw:p-0 tw:text-xl tw:font-semibold tw:text-brand-secondary tw:outline-none">
        {t('label.data-marketplace')}
        <ChevronDown className="tw:size-5 tw:font-semibold" />
      </AriaButton>
      <Dropdown.Popover>
        <Dropdown.Menu onAction={handleAction}>
          {navItems.map((item) => (
            <Dropdown.Item
              icon={item.icon}
              id={item.id}
              key={item.id}
              label={item.label}
            />
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

export default MarketplaceNav;
