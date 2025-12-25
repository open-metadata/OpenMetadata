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

import { FC, useCallback, useMemo } from 'react';
import { Domain } from '../../../generated/entity/domains/domain';
import { EntityReference } from '../../../generated/entity/type';
import { listDomainHierarchy, searchDomains } from '../../../rest/domainAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { TreeDataResponse, TreeNode } from '../atoms/asyncTreeSelect/types';
import MUIAsyncTreeSelect from '../MUIAsyncTreeSelect/MUIAsyncTreeSelect';
import { MUIDomainSelectProps } from './MUIDomainSelect.interface';

const MUIDomainSelect: FC<MUIDomainSelectProps> = ({
  label,
  placeholder,
  helperText,
  required = false,
  disabled = false,
  error = false,
  fullWidth = true,
  size = 'small',
  multiple = false,
  value,
  onChange,
  hasPermission = true,
  onBlur,
  onFocus,
  'data-testid': dataTestId,
}) => {
  const convertDomainToTreeNode = useCallback(
    (domain: Domain | EntityReference): TreeNode => {
      const hasChildren =
        'children' in domain &&
        domain.children &&
        Array.isArray(domain.children) &&
        domain.children.length > 0;

      return {
        id: domain.id,
        label: getEntityName(domain),
        value: domain.fullyQualifiedName ?? domain.id,
        data: {
          id: domain.id,
          name: domain.name,
          displayName: domain.displayName,
          fullyQualifiedName: domain.fullyQualifiedName,
          type: 'domain',
        } as EntityReference,
        hasChildren,
        lazyLoad: false,
        children: hasChildren
          ? domain.children?.map(convertDomainToTreeNode)
          : undefined,
        allowSelection: hasPermission,
      };
    },
    [hasPermission]
  );

  const fetchData = useCallback(
    async ({
      searchTerm,
    }: {
      searchTerm?: string;
    }): Promise<TreeDataResponse> => {
      try {
        if (searchTerm) {
          const domains = await searchDomains(searchTerm, 1);

          return {
            nodes: domains.map(convertDomainToTreeNode),
            hasMore: false,
          };
        } else {
          const response = await listDomainHierarchy({
            limit: 1000,
            fields: 'children,owners',
          });

          return {
            nodes: response.data.map(convertDomainToTreeNode),
            hasMore: false,
          };
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error fetching domains:', error);

        return { nodes: [], hasMore: false };
      }
    },
    [convertDomainToTreeNode]
  );

  const handleChange = useCallback(
    (selectedNodes: TreeNode | TreeNode[] | null) => {
      if (!onChange) {
        return;
      }

      if (!selectedNodes) {
        onChange(null);

        return;
      }

      if (Array.isArray(selectedNodes)) {
        const selectedDomains = selectedNodes.map(
          (node) => node.data as EntityReference
        );
        onChange(selectedDomains);
      } else {
        onChange(selectedNodes.data as EntityReference);
      }
    },
    [onChange]
  );

  const selectedValue = useMemo(() => {
    if (!value) {
      return undefined;
    }

    if (Array.isArray(value)) {
      return value.map((domain) => ({
        id: domain.id,
        label: getEntityName(domain),
        value: domain.fullyQualifiedName ?? domain.id,
      }));
    }

    return {
      id: value.id,
      label: getEntityName(value),
      value: value.fullyQualifiedName ?? value.id,
    };
  }, [value]);

  return (
    <MUIAsyncTreeSelect
      searchable
      cascadeSelection={false}
      data-testid={dataTestId}
      debounceMs={300}
      disabled={disabled}
      error={error}
      fetchData={fetchData}
      fullWidth={fullWidth}
      helperText={helperText}
      label={label}
      lazyLoad={false}
      loadingMessage="Loading domains..."
      multiple={multiple}
      noDataMessage="No domains found"
      placeholder={placeholder || 'Select domain'}
      required={required}
      searchPlaceholder="Search domains..."
      showCheckbox={multiple}
      showIcon={false}
      size={size}
      value={selectedValue}
      onBlur={onBlur}
      onChange={handleChange}
      onFocus={onFocus}
    />
  );
};

export default MUIDomainSelect;
