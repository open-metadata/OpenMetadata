/*
 *  Copyright 2025 Collate.
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

import { useMemo, useState } from 'react';
import { Domain } from '../../../../generated/entity/domains/domain';
import EntityTable from '../../../common/EntityTable/EntityTable.component';
import { EntityTableFilters } from '../../../common/EntityTable/EntityTable.interface';
import { SubDomainsTableV2Props } from './SubDomainsTableV2.interface';

const SubDomainsTableV2 = ({
  subDomains = [],
  isLoading = false,
  permissions,
  onAddSubDomain,
}: SubDomainsTableV2Props) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<EntityTableFilters>({
    owners: [],
    glossaryTerms: [],
    domainTypes: [],
    tags: [],
  });

  // Filter subdomains based on search term
  const filteredSubDomains = useMemo(() => {
    if (!searchTerm.trim()) {
      return subDomains;
    }

    const searchTermLower = searchTerm.toLowerCase();

    return subDomains.filter(
      (domain: Domain) =>
        domain.name?.toLowerCase().includes(searchTermLower) ||
        domain.displayName?.toLowerCase().includes(searchTermLower) ||
        domain.description?.toLowerCase().includes(searchTermLower)
    );
  }, [subDomains, searchTerm]);

  const handleSearchChange = (newSearchTerm: string) => {
    setSearchTerm(newSearchTerm);
  };

  const handleFiltersUpdate = (newFilters: EntityTableFilters) => {
    setFilters(newFilters);
  };

  const handleRowClick = (record: any) => {
    // Handle row click if needed - navigation is handled by EntityTable internally
  };

  return (
    <EntityTable
      data={filteredSubDomains}
      filters={filters}
      loading={isLoading}
      searchTerm={searchTerm}
      showPagination={false}
      total={filteredSubDomains.length}
      type="sub-domains"
      onFiltersUpdate={handleFiltersUpdate}
      onRowClick={handleRowClick}
      onSearchChange={handleSearchChange}
    />
  );
};

export default SubDomainsTableV2;
