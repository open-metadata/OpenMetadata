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

import { useTranslation } from 'react-i18next';
import { ReactComponent as DataProductsIcon } from '../../../../assets/svg/data-products-default.svg';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import { createListPageHeaderRenderer } from '../../../common/ListPageHeader/ListPageHeader';
import DataProductListPage from '../../../DataProduct/DataProductListPage';

const renderDataProductsListHeader = createListPageHeaderRenderer({
  addLabelKey: 'label.add-data-product',
  icon: DataProductsIcon,
  subtitleKey: 'message.data-product-description',
  titleKey: 'label.data-product-plural',
});

/**
 * Data Products list route. In AI mode the shared list-page header (breadcrumb,
 * title, subtitle, Add) replaces the classic listing chrome; classic mode keeps
 * the default header.
 */
const MarketplaceDataProductsPage = () => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();

  return (
    <DataProductListPage
      pageTitle={t('label.data-product')}
      renderPageHeader={isAiMode ? renderDataProductsListHeader : undefined}
    />
  );
};

export default MarketplaceDataProductsPage;
