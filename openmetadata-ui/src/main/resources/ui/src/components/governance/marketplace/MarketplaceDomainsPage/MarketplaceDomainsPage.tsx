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
import { ReactComponent as DomainsIcon } from '../../../../assets/svg/domains-default.svg';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import { createListPageHeaderRenderer } from '../../../common/ListPageHeader/ListPageHeader';
import DomainListPage from '../../../DomainListing/DomainListPage';

const renderDomainsListHeader = createListPageHeaderRenderer({
  addLabelKey: 'label.add-domain',
  icon: DomainsIcon,
  subtitleKey: 'message.domain-description',
  titleKey: 'label.domain-plural',
});

/**
 * Domains list route. In AI mode the shared list-page header (breadcrumb, title,
 * subtitle, Add) replaces the classic listing chrome; classic mode keeps the
 * default header.
 */
const MarketplaceDomainsPage = () => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();

  return (
    <DomainListPage
      pageTitle={t('label.domain-plural')}
      renderPageHeader={isAiMode ? renderDomainsListHeader : undefined}
    />
  );
};

export default MarketplaceDomainsPage;
