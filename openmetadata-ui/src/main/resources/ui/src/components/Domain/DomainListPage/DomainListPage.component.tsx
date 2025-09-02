/*
 *  Copyright 2024 Collate.
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

import { Card } from '@openmetadata/ui-core-components/dist/components/application/card';
import { PaginationPageDefault } from '@openmetadata/ui-core-components/dist/components/application/pagination/pagination';
import {
  Table,
  TableCard,
} from '@openmetadata/ui-core-components/dist/components/application/table/table';
import { Avatar } from '@openmetadata/ui-core-components/dist/components/base/avatar/avatar';
import { Badge } from '@openmetadata/ui-core-components/dist/components/base/badges/badges';
import { Button } from '@openmetadata/ui-core-components/dist/components/base/buttons/button';
import { Input } from '@openmetadata/ui-core-components/dist/components/base/input/input';
import { Select } from '@openmetadata/ui-core-components/dist/components/base/select/select';
import { Plus, SearchLg as Search } from '@untitledui/icons';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DomainIcon } from '../../../assets/svg/ic-domain.svg';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { getEntityName } from '../../../utils/EntityUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import { DomainListPageProps } from './DomainListPage.interface';

// Color palette for domain icons
const DOMAIN_COLORS = [
  '#7AB8FF', // Light blue
  '#FFB38A', // Light orange
  '#8FD5B8', // Light green
  '#FF9B9B', // Light red
];

const DomainListPage = ({
  domains,
  loading,
  onAddDomain,
  onDomainClick,
}: DomainListPageProps) => {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Filter states
  const [domainTypeFilter, setDomainTypeFilter] = useState<
    string | undefined
  >();

  const filteredDomains = useMemo(() => {
    let filtered = domains;

    if (searchValue) {
      const searchLower = searchValue.toLowerCase();
      filtered = filtered.filter((domain) => {
        const name = getEntityName(domain).toLowerCase();
        const description = domain.description?.toLowerCase() ?? '';

        return name.includes(searchLower) || description.includes(searchLower);
      });
    }

    // Apply other filters here as needed
    if (domainTypeFilter) {
      filtered = filtered.filter(
        (domain) => domain.domainType === domainTypeFilter
      );
    }

    return filtered;
  }, [domains, searchValue, domainTypeFilter]);

  const handleSearch = useCallback((value: string) => {
    setSearchValue(value);
    setCurrentPage(1);
  }, []);

  const paginatedDomains = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;

    return filteredDomains.slice(start, end);
  }, [filteredDomains, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredDomains.length / pageSize);

  if (loading) {
    return <Loader />;
  }

  if (filteredDomains.length === 0 && !searchValue) {
    return (
      <div className="flex h-full items-center justify-center p-16">
        <ErrorPlaceHolder
          heading={t('message.no-entity-created-yet', {
            entity: t('label.domain-plural'),
          })}
          type={ERROR_PLACEHOLDER_TYPE.NO_DATA}
        />
      </div>
    );
  }

  return (
    <div>
      <Card background="white" className="mb-6" padding="none">
        {/* Page Header using Card.Header */}
        <Card.Header
          actions={
            <Button
              data-testid="add-domain-button"
              iconLeading={Plus}
              size="md"
              onClick={onAddDomain}>
              {t('label.add-entity', { entity: t('label.domain') })}
            </Button>
          }
          description={t('message.domains-description')}
          padding="lg"
          title={t('label.domain-plural')}
          titleVariant="display-sm"
        />
      </Card>

      {/* Table Card */}
      <Card background="white" padding="none">
        <TableCard.Root>
          {/* Filters Bar */}
          <div className="flex items-center gap-3 border-b border-gray-200 px-6 py-3">
            <span className="text-sm font-medium text-gray-700">
              {t('label.domain')}
            </span>
            <Badge color="blue-light" size="sm">
              {filteredDomains.length}
            </Badge>
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <Input
                  className="pl-10"
                  data-testid="domain-search-input"
                  placeholder={t('label.search')}
                  value={searchValue}
                  onChange={(value: string) => handleSearch(value)}
                />
              </div>
            </div>
            <Select
              placeholder={t('label.owner')}
              onSelectionChange={() => {
                // TODO: Implement owner filter
              }}>
              <Select.Item id="owner1" label={`${t('label.owner')} 1`} />
            </Select>
            <Select
              placeholder={t('label.glossary-term-plural')}
              onSelectionChange={() => {
                // TODO: Implement glossary filter
              }}>
              <Select.Item id="required" label={t('label.required')} />
            </Select>
            <Select
              placeholder={t('label.domain-type')}
              selectedKey={domainTypeFilter}
              onSelectionChange={(value) =>
                setDomainTypeFilter(value as string)
              }>
              <Select.Item id="" label={t('label.all')} />
              <Select.Item id="Engineering" label={t('label.engineering')} />
              <Select.Item id="Sales" label={t('label.sales')} />
              <Select.Item id="Finance" label={t('label.finance')} />
              <Select.Item id="Marketing" label={t('label.marketing')} />
              <Select.Item id="Product" label={t('label.product')} />
            </Select>
            <Select
              placeholder={t('label.tag')}
              onSelectionChange={() => {
                // TODO: Implement tag filter
              }}>
              <Select.Item id="required" label={t('label.required')} />
            </Select>
          </div>

          {/* Table */}
          <Table size="md">
            <Table.Header>
              <Table.Head>{t('label.domain')}</Table.Head>
              <Table.Head>{t('label.owner')}</Table.Head>
              <Table.Head>{t('label.glossary-term-plural')}</Table.Head>
              <Table.Head>{t('label.domain-type')}</Table.Head>
              <Table.Head>{t('label.tag-plural')}</Table.Head>
            </Table.Header>
            <Table.Body>
              {paginatedDomains.map((domain, index) => {
                const displayName = getEntityName(domain);
                const colorIndex = index % DOMAIN_COLORS.length;
                const hasOwners = domain.owners && domain.owners.length > 0;
                const owner =
                  hasOwners && domain.owners ? domain.owners[0] : null;

                return (
                  <Table.Row
                    className="cursor-pointer hover:bg-gray-50"
                    key={domain.id}
                    onClick={() => onDomainClick(domain)}>
                    <Table.Cell>
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: DOMAIN_COLORS[colorIndex],
                          }}>
                          <DomainIcon className="h-5 w-5 text-white" />
                        </div>
                        <span className="font-medium text-gray-900">
                          {displayName}
                        </span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      {owner ? (
                        <div className="flex items-center gap-2">
                          <Avatar
                            initials={
                              owner.displayName?.[0] || owner.name?.[0] || 'O'
                            }
                            size="xs"
                          />
                          <span className="text-gray-700">
                            {owner.displayName ||
                              owner.name ||
                              `${t('label.owner')} 1`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <Badge color="gray" size="sm">
                          {t('label.required')}
                        </Badge>
                        {domain.tags &&
                          domain.tags
                            .filter((tag) => tag.source === 'Glossary')
                            .slice(0, 2)
                            .map((tag, idx) => (
                              <Badge color="blue" key={idx} size="sm">
                                {tag.tagFQN}
                              </Badge>
                            ))}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-gray-700">
                        {domain.domainType || 'Engineering'}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <Badge color="gray" size="sm">
                          {t('label.required')}
                        </Badge>
                        {domain.tags &&
                          domain.tags
                            .filter((tag) => tag.source !== 'Glossary')
                            .slice(0, 2)
                            .map((tag, idx) => (
                              <Badge color="blue" key={idx} size="sm">
                                {tag.labelType === 'Automated'
                                  ? 'URL'
                                  : tag.tagFQN}
                              </Badge>
                            ))}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <PaginationPageDefault
              page={currentPage}
              total={totalPages}
              onPageChange={setCurrentPage}
            />
          )}
        </TableCard.Root>
      </Card>
    </div>
  );
};

export default DomainListPage;
