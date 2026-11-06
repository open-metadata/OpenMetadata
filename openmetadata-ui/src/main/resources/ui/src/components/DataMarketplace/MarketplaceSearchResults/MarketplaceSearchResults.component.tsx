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

import { Tooltip, Typography } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { Domain } from '../../../generated/entity/domains/domain';
import { useMarketplaceStore } from '../../../hooks/useMarketplaceStore';
import { getDataProductIconByUrl } from '../../../utils/DataProductUtils';
import { getDomainIcon } from '../../../utils/DomainUtils';
import { getDomainDetailsPath } from '../../../utils/RouterUtils';
import { getEncodedFqn } from '../../../utils/StringUtils';
// The classes below live with the search bar these rows were extracted from;
// they only applied where that component happened to be loaded.
import '../MarketplaceSearchBar/marketplace-search-bar.less';

interface MarketplaceSearchResultsProps {
  dataProducts: DataProduct[];
  domains: Domain[];
  isSearching: boolean;
  /** Runs when a pick opens its page, e.g. to close the popover. */
  onSelect: () => void;
}

const MarketplaceSearchResults = ({
  dataProducts,
  domains,
  isSearching,
  onSelect,
}: MarketplaceSearchResultsProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { dataProductBasePath } = useMarketplaceStore();

  // Picking a result opens it, as it does on Explore.
  const openEntity = (path: string) => {
    onSelect();
    navigate(path, { state: { fromMarketplace: true } });
  };

  const onDataProductClick = (dataProduct: DataProduct) =>
    openEntity(
      `${dataProductBasePath}/${getEncodedFqn(
        dataProduct.fullyQualifiedName ?? ''
      )}`
    );

  const onDomainClick = (domain: Domain) =>
    openEntity(getDomainDetailsPath(domain.fullyQualifiedName ?? ''));

  if (isSearching) {
    return (
      <div className="marketplace-search-results p-md">
        <Typography as="span" className="tw:text-sm tw:text-text-tertiary">
          {t('label.loading')}...
        </Typography>
      </div>
    );
  }

  if (dataProducts.length === 0 && domains.length === 0) {
    return (
      <div className="marketplace-search-results p-md">
        <Typography as="span" className="tw:text-sm tw:text-text-tertiary">
          {t('label.no-data-found')}
        </Typography>
      </div>
    );
  }

  return (
    <div className="marketplace-search-results">
      {dataProducts.length > 0 && (
        <div className="search-result-section">
          <Typography as="span" className="search-result-section-title">
            {t('label.data-product-plural')}
          </Typography>
          {dataProducts.map((dataProduct) => (
            <div
              className="search-result-item"
              data-testid={`search-result-dp-${dataProduct.id}`}
              key={dataProduct.id}
              role="button"
              tabIndex={0}
              onClick={() => onDataProductClick(dataProduct)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onDataProductClick(dataProduct);
                }
              }}>
              <div className="search-result-icon">
                {getDataProductIconByUrl(dataProduct.style?.iconURL)}
              </div>
              <Tooltip title={dataProduct.displayName || dataProduct.name}>
                <Typography
                  as="span"
                  className="tw:block tw:truncate tw:text-sm">
                  {dataProduct.displayName || dataProduct.name}
                </Typography>
              </Tooltip>
            </div>
          ))}
        </div>
      )}
      {domains.length > 0 && (
        <div className="search-result-section">
          <Typography as="span" className="search-result-section-title">
            {t('label.domain-plural')}
          </Typography>
          {domains.map((domain) => (
            <div
              className="search-result-item"
              data-testid={`search-result-domain-${domain.id}`}
              key={domain.id}
              role="button"
              tabIndex={0}
              onClick={() => onDomainClick(domain)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onDomainClick(domain);
                }
              }}>
              <div className="search-result-icon">
                {getDomainIcon(domain.style?.iconURL)}
              </div>
              <Tooltip title={domain.displayName || domain.name}>
                <Typography
                  as="span"
                  className="tw:block tw:truncate tw:text-sm">
                  {domain.displayName || domain.name}
                </Typography>
              </Tooltip>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MarketplaceSearchResults;
