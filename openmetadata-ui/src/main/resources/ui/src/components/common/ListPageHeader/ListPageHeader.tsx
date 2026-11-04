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
  Box,
  Button,
  PageLayout,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus } from '@openmetadata/ui-core-components/icons';
import { FC, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as MarketplaceIcon } from '../../../assets/svg/marketplace-default.svg';
import { ROUTES } from '../../../constants/constants';
import HeaderBreadcrumb from '../HeaderBreadcrumb/HeaderBreadcrumb.component';
import {
  ListPageHeaderConfig,
  ListPageHeaderRenderProps,
} from './ListPageHeader.interface';

interface SearchHeaderRowProps {
  title: string;
  subtitle?: string;
  search: ReactNode;
  actions?: ReactNode;
}

/**
 * Page-header title row with a search between the title and the actions.
 * The search centres in the space the title leaves; 35vw matches Explore.
 */
export const SearchHeaderRow = ({
  title,
  subtitle,
  search,
  actions,
}: SearchHeaderRowProps) => (
  <Box
    align="center"
    className="tw:w-full"
    data-testid="search-header-row"
    direction="row"
    gap={4}>
    <div className="tw:shrink-0" data-testid="search-header-title">
      <Typography as="h3" size="text-xl" weight="semibold">
        {title}
      </Typography>
      {subtitle && (
        <Typography
          className="tw:whitespace-nowrap"
          color="secondary"
          size="text-sm">
          {subtitle}
        </Typography>
      )}
    </div>
    <div className="tw:min-w-0 tw:flex-1">
      <div
        className="tw:mx-auto tw:w-full tw:max-w-[35vw] tw:min-w-0"
        data-testid="search-header-search">
        {search}
      </div>
    </div>
    <div className="tw:shrink-0" data-testid="search-header-actions">
      {actions}
    </div>
  </Box>
);

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
    <PageLayout.PageHeader
      actions={
        // PageLayout.PageHeader renders its actions box on any truthy value, so keep this
        // undefined when there is nothing to show rather than passing a fragment.
        !search && addButton ? addButton : undefined
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
      className="tw:mb-4"
      data-testid="list-page-header"
      subtitle={search || !subtitleKey ? undefined : t(subtitleKey)}
      title={
        search ? (
          <SearchHeaderRow
            actions={addButton}
            search={search}
            subtitle={subtitleKey && t(subtitleKey)}
            title={t(titleKey)}
          />
        ) : (
          t(titleKey)
        )
      }
      variant="gradient"
    />
  );
};

export const createListPageHeaderRenderer =
  (config: ListPageHeaderConfig) =>
  (renderProps: ListPageHeaderRenderProps): ReactNode =>
    <ListPageHeader {...config} {...renderProps} />;

export default ListPageHeader;
