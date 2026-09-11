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

import { Button } from '@openmetadata/ui-core-components';
import { Plus } from '@untitledui/icons';
import { FC, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as MarketplaceIcon } from '../../../assets/svg/marketplace-default.svg';
import { ROUTES } from '../../../constants/constants';
import HeaderBreadcrumb from '../HeaderBreadcrumb/HeaderBreadcrumb.component';
import HeaderShell from '../HeaderShell/HeaderShell.component';
import {
  ListPageHeaderConfig,
  ListPageHeaderRenderProps,
} from './ListPageHeader.interface';

const ListPageHeader: FC<ListPageHeaderConfig & ListPageHeaderRenderProps> = ({
  titleKey,
  subtitleKey,
  addLabelKey,
  onAddClick,
  createPermission,
  search,
}) => {
  const { t } = useTranslation();

  const addButton = createPermission ? (
    <Button color="primary" iconLeading={Plus} onClick={onAddClick}>
      {t(addLabelKey)}
    </Button>
  ) : null;

  return (
    <HeaderShell
      actions={
        // HeaderShell renders its actions box on any truthy value, so keep this
        // undefined when there is nothing to show rather than passing a fragment.
        search || addButton ? (
          <>
            {search}
            {addButton}
          </>
        ) : undefined
      }
      breadcrumb={
        <HeaderBreadcrumb
          noMargin
          items={[
            {
              label: null,
              ariaLabel: t('label.data-marketplace'),
              icon: MarketplaceIcon,
              href: ROUTES.DATA_MARKETPLACE,
            },
            { label: t(titleKey) },
          ]}
          showHome={false}
        />
      }
      className="tw:mb-5"
      data-testid="list-page-header"
      subtitle={subtitleKey ? t(subtitleKey) : undefined}
      title={t(titleKey)}
      variant="gradient"
    />
  );
};

export const createListPageHeaderRenderer =
  (config: ListPageHeaderConfig) =>
  (renderProps: ListPageHeaderRenderProps): ReactNode =>
    <ListPageHeader {...config} {...renderProps} />;

export default ListPageHeader;
