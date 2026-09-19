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

import { Button, Dropdown } from '@openmetadata/ui-core-components';
import { ChevronDown } from '@openmetadata/ui-core-components/icons';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../../constants/constants';
import { useDomainCreateDrawer } from '../../../DomainListing/hooks/useDomainCreateDrawer';

/**
 * "Add New" split action for the Data Marketplace overview header: a primary
 * button opening a menu that opens the shared Domain create drawer in place and
 * sends a data product to the Creation-gate page, which is where the playbook
 * enforces what a product cannot be created without.
 */
export const AddNewMenu: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formDrawer: domainDrawer, openDrawer: openDomainDrawer } =
    useDomainCreateDrawer();

  return (
    <>
      <Dropdown.Root>
        <Button
          className="tw:h-9"
          color="primary"
          data-testid="marketplace-add-new-button"
          iconTrailing={ChevronDown}>
          {t('label.add-new')}
        </Button>
        <Dropdown.Popover className="tw:min-w-44" placement="bottom right">
          <Dropdown.Menu>
            <Dropdown.Item
              data-testid="marketplace-add-domain"
              id="add-domain"
              onAction={openDomainDrawer}>
              <span className="tw:text-sm tw:text-secondary">
                {t('label.add-domain')}
              </span>
            </Dropdown.Item>
            <Dropdown.Item
              data-testid="marketplace-add-data-product"
              id="add-data-product"
              onAction={() => navigate(ROUTES.ADD_DATA_PRODUCT)}>
              <span className="tw:text-sm tw:text-secondary">
                {t('label.add-data-product')}
              </span>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
      {domainDrawer}
    </>
  );
};

export default AddNewMenu;
