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

import { AxiosError } from 'axios';
import { FC, ReactNode, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZE_LARGE } from '../../../constants/constants';
import { TagSource } from '../../../generated/entity/data/container';
import { Glossary } from '../../../generated/entity/data/glossary';
import { TagLabel } from '../../../generated/type/tagLabel';
import {
  getGlossariesList,
  queryGlossaryTerms,
  searchGlossaryTerms,
} from '../../../rest/glossaryAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { escapeESReservedCharacters } from '../../../utils/StringsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { TreeDataResponse, TreeNode } from '../atoms/asyncTreeSelect/types';
import MUIAsyncTreeSelect from '../MUIAsyncTreeSelect/MUIAsyncTreeSelect';
import {
  convertGlossaryTermsToTreeOptionsWithNames,
  convertToTreeNodes,
} from './GlossaryTagSuggestionUtils';
import { useGlossaryMutualExclusivity } from './useGlossaryMutualExclusivity';

export interface MUIGlossaryTagSuggestionProps {
  value?: TagLabel[];
  onChange?: (newTags: TagLabel[]) => void;
  placeholder?: string;
  label?: ReactNode;
  required?: boolean;
  autoFocus?: boolean;
}

const MUIGlossaryTagSuggestion: FC<MUIGlossaryTagSuggestionProps> = ({
  value = [],
  onChange,
  placeholder,
  label,
  required = false,
  autoFocus = false,
}) => {
  const { t } = useTranslation();

  const { getExclusivity, setExclusivity } = useGlossaryMutualExclusivity();

  const fetchData = useCallback(
    async ({
      searchTerm,
      parentId,
    }: {
      searchTerm?: string;
      parentId?: string;
    }): Promise<TreeDataResponse> => {
      try {
        // If searching, search across all glossary terms
        if (searchTerm) {
          const response = await searchGlossaryTerms(
            escapeESReservedCharacters(searchTerm),
            1 // page number
          );

          // With getHierarchy=true, response is an array of glossaries with nested terms
          // Convert the hierarchical structure to tree nodes
          const treeNodes: TreeNode[] = [];

          if (Array.isArray(response)) {
            // Process each glossary with its nested terms
            response.forEach((glossary: any) => {
              // Include all glossaries returned by search
              // The API returns glossaries that match the search term
              // Either in their name or in their children's names
              if (glossary.children && glossary.children.length > 0) {
                // Convert children using the same function used for glossary expansion
                const childrenOptions =
                  convertGlossaryTermsToTreeOptionsWithNames(
                    glossary.children,
                    1, // Start at level 1 since these are terms under a glossary
                    glossary.mutuallyExclusive === true
                  );

                // Create the glossary parent node
                const glossaryNode: TreeNode = {
                  id: glossary.id,
                  label: getEntityName(glossary),
                  value:
                    glossary.fullyQualifiedName || glossary.name || glossary.id,
                  children: convertToTreeNodes(childrenOptions),
                  isLeaf: false,
                  allowSelection: false, // Glossaries are not selectable
                  lazyLoad: false, // Already loaded from search
                  data: {
                    tagFQN: glossary.fullyQualifiedName || '',
                    name: getEntityName(glossary),
                    displayName: glossary.displayName,
                    source: TagSource.Glossary,
                  } as TagLabel,
                };

                treeNodes.push(glossaryNode);
              }
            });
          }

          return { nodes: treeNodes, hasMore: false };
        }

        // If parentId is provided, this should only be for glossary expansion
        // Term expansion should not trigger API calls since children are already loaded
        if (parentId) {
          // Only handle glossary expansion - terms should have their children pre-loaded
          const glossaryName = parentId;
          const results = await queryGlossaryTerms(glossaryName);

          if (results.length > 0) {
            // The API returns the glossary as the root with its children
            // We only need the children to avoid duplicate IDs
            const glossaryRoot = results[0];
            const children = glossaryRoot.children || [];

            // Convert only the children to tree options, starting at level 1 (since they are terms)
            const treeOptions = convertGlossaryTermsToTreeOptionsWithNames(
              children,
              1,
              getExclusivity(glossaryName) ??
                glossaryRoot.mutuallyExclusive === true
            );

            return { nodes: convertToTreeNodes(treeOptions), hasMore: false };
          }

          return { nodes: [], hasMore: false };
        }

        // Otherwise, fetch top-level glossaries only
        const { data: glossaries } = await getGlossariesList({
          fields: 'name,displayName,fullyQualifiedName,mutuallyExclusive',
          limit: PAGE_SIZE_LARGE,
        });

        const treeNodes = glossaries.map((glossary: Glossary) => {
          setExclusivity(glossary.name, glossary.mutuallyExclusive ?? false);

          return {
            id: glossary.name, // Use the encoded name for queryGlossaryTerms
            label: getEntityName(glossary),
            value: glossary.fullyQualifiedName || glossary.name,
            children: [
              {
                id: `${glossary.name}-loading`,
                label: 'Loading...',
                value: `${glossary.name}-loading`,
                children: [],
                isLeaf: true,
                allowSelection: false,
                data: undefined,
              },
            ], // Add placeholder child to show expand icon
            isLeaf: false, // Glossaries can have children
            allowSelection: false, // Don't allow selection of glossary itself
            data: {
              tagFQN: glossary.fullyQualifiedName || '',
              name: getEntityName(glossary),
              displayName: glossary.displayName,
              source: TagSource.Glossary,
            } as TagLabel,
          };
        });

        return { nodes: treeNodes, hasMore: false };
      } catch (error) {
        showErrorToast(error as AxiosError);

        return { nodes: [], hasMore: false };
      }
    },
    [getExclusivity, setExclusivity]
  );

  const handleChange = useCallback(
    (selectedNodes: TreeNode[] | TreeNode | null) => {
      if (!selectedNodes) {
        onChange?.([]);

        return;
      }
      const nodesArray = Array.isArray(selectedNodes)
        ? selectedNodes
        : [selectedNodes];
      const newTags: TagLabel[] = nodesArray
        .filter((node) => node.data && node.allowSelection !== false)
        .map((node) => node.data as TagLabel);
      onChange?.(newTags);
    },
    [onChange]
  );

  const selectedValue = useMemo(() => {
    return value
      .filter((tag) => tag.source === TagSource.Glossary)
      .map((tag) => ({
        id: tag.tagFQN,
        label: tag.displayName || tag.name || tag.tagFQN,
        value: tag.tagFQN,
        fqn: tag.tagFQN,
        data: tag,
      }));
  }, [value]);

  const handleNodeExpand = useCallback(() => {
    // The lazy loading will be handled by the tree component
    // calling fetchData with parentId when node is expanded
  }, []);

  // Custom filter that always returns true because server-side filtering is already applied
  // This prevents double filtering which was hiding glossaries whose children don't match
  const customFilterNode = useCallback(() => true, []);

  return (
    <MUIAsyncTreeSelect
      lazyLoad
      multiple
      searchable
      autoFocus={autoFocus}
      fetchData={fetchData}
      filterNode={customFilterNode}
      label={label}
      placeholder={
        placeholder ||
        t('label.select-field', {
          field: t('label.glossary-term-plural'),
        })
      }
      required={required}
      searchPlaceholder={t('label.search-entity', {
        entity: t('label.glossary-term-plural'),
      })}
      value={selectedValue}
      onChange={handleChange}
      onNodeExpand={handleNodeExpand}
    />
  );
};

export default MUIGlossaryTagSuggestion;
