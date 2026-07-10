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

import {
  TreeSelect,
  TreeSelectDataResponse,
  TreeSelectNode,
} from '@openmetadata/ui-core-components';
import { FC, useCallback, useMemo } from 'react';
import { Domain } from '../../../generated/entity/domains/domain';
import { EntityReference } from '../../../generated/entity/type';
import { listDomainHierarchy, searchDomains } from '../../../rest/domainAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { DomainTreeSelectProps } from './DomainTreeSelect.interface';

const toTreeSelectNode = (
  domain: EntityReference
): TreeSelectNode<EntityReference> => ({
  id: domain.id,
  label: getEntityName(domain),
  value: domain.fullyQualifiedName ?? domain.id,
  data: domain,
});

const DomainTreeSelect: FC<DomainTreeSelectProps> = ({
  label,
  placeholder,
  helperText,
  required = false,
  disabled = false,
  error = false,
  multiple = false,
  value,
  onChange,
  hasPermission = true,
  'data-testid': dataTestId,
}) => {
  const convertDomainToTreeNode = useCallback(
    (domain: Domain | EntityReference): TreeSelectNode<EntityReference> => {
      const children =
        'children' in domain && Array.isArray(domain.children)
          ? domain.children
          : undefined;

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
        lazyLoad: false,
        allowSelection: hasPermission,
        children: children?.map(convertDomainToTreeNode),
      };
    },
    [hasPermission]
  );

  const fetchData = useCallback(
    async ({
      searchTerm,
    }: {
      searchTerm?: string;
    }): Promise<TreeSelectDataResponse<EntityReference>> => {
      try {
        if (searchTerm) {
          const domains = await searchDomains(searchTerm, 1);

          return { nodes: domains.map(convertDomainToTreeNode) };
        }

        const response = await listDomainHierarchy({
          limit: 1000,
          fields: 'children,owners',
        });

        return { nodes: response.data.map(convertDomainToTreeNode) };
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error fetching domains:', err);

        return { nodes: [] };
      }
    },
    [convertDomainToTreeNode]
  );

  const handleChange = useCallback(
    (
      selectedNodes:
        | TreeSelectNode<EntityReference>
        | TreeSelectNode<EntityReference>[]
        | null
    ) => {
      if (!onChange) {
        return;
      }

      if (!selectedNodes) {
        onChange(null);

        return;
      }

      if (Array.isArray(selectedNodes)) {
        onChange(selectedNodes.map((node) => node.data as EntityReference));
      } else {
        onChange(selectedNodes.data as EntityReference);
      }
    },
    [onChange]
  );

  const selectedValue = useMemo(() => {
    if (!value) {
      return null;
    }

    return Array.isArray(value)
      ? value.map(toTreeSelectNode)
      : toTreeSelectNode(value);
  }, [value]);

  return (
    <TreeSelect
      searchable
      cascadeSelection={false}
      data-testid={dataTestId}
      disabled={disabled}
      fetchData={fetchData}
      hint={helperText}
      isInvalid={error}
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
      value={selectedValue}
      onChange={handleChange}
    />
  );
};

export default DomainTreeSelect;
