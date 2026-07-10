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
import { getEntityName } from '../../../utils/EntityNameUtils';
import { escapeESReservedCharacters } from '../../../utils/StringUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { ModifiedGlossaryTerm } from '../../Glossary/GlossaryTermTab/GlossaryTermTab.interface';
import {
  convertGlossaryTermsToTreeOptionsWithNames,
  convertToTreeNodes,
} from './GlossaryTagSuggestionUtils';
import { useGlossaryMutualExclusivity } from './useGlossaryMutualExclusivity';

interface HierarchicalGlossary extends Glossary {
  children?: ModifiedGlossaryTerm[];
}

export interface GlossaryTermTreeSelectProps {
  value?: TagLabel[];
  onChange?: (newTags: TagLabel[]) => void;
  placeholder?: string;
  label?: ReactNode;
  required?: boolean;
  autoFocus?: boolean;
  'data-testid'?: string;
}

const GlossaryTermTreeSelect: FC<GlossaryTermTreeSelectProps> = ({
  value = [],
  onChange,
  placeholder,
  label,
  required = false,
  autoFocus = false,
  'data-testid': dataTestId,
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
    }): Promise<TreeSelectDataResponse<TagLabel>> => {
      try {
        // If searching, search across all glossary terms
        if (searchTerm) {
          const response = await searchGlossaryTerms(
            escapeESReservedCharacters(searchTerm),
            1 // page number
          );

          // With getHierarchy=true, response is an array of glossaries with nested terms
          const treeNodes: TreeSelectNode<TagLabel>[] = [];

          if (Array.isArray(response)) {
            response.forEach((glossary: HierarchicalGlossary) => {
              if (glossary.children && glossary.children.length > 0) {
                const childrenOptions =
                  convertGlossaryTermsToTreeOptionsWithNames(
                    glossary.children,
                    1, // Start at level 1 since these are terms under a glossary
                    glossary.mutuallyExclusive === true
                  );

                treeNodes.push({
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
                });
              }
            });
          }

          return { nodes: treeNodes };
        }

        // If parentId is provided, this should only be for glossary expansion
        // Term expansion should not trigger API calls since children are already loaded
        if (parentId) {
          const glossaryName = parentId;
          const results = await queryGlossaryTerms(glossaryName);

          if (results.length > 0) {
            const glossaryRoot = results[0];
            const children = glossaryRoot.children || [];

            const treeOptions = convertGlossaryTermsToTreeOptionsWithNames(
              children,
              1,
              getExclusivity(glossaryName) ??
                glossaryRoot.mutuallyExclusive === true
            );

            return { nodes: convertToTreeNodes(treeOptions) };
          }

          return { nodes: [] };
        }

        // Otherwise, fetch top-level glossaries only
        const { data: glossaries } = await getGlossariesList({
          fields: 'name,displayName,fullyQualifiedName,mutuallyExclusive',
          limit: PAGE_SIZE_LARGE,
        });

        const treeNodes: TreeSelectNode<TagLabel>[] = glossaries.map(
          (glossary: Glossary) => {
            setExclusivity(glossary.name, glossary.mutuallyExclusive ?? false);

            return {
              id: glossary.name, // Use the encoded name for queryGlossaryTerms
              label: getEntityName(glossary),
              value: glossary.fullyQualifiedName || glossary.name,
              isLeaf: false, // Glossaries can have children
              allowSelection: false, // Don't allow selection of glossary itself
              lazyLoad: true,
              data: {
                tagFQN: glossary.fullyQualifiedName || '',
                name: getEntityName(glossary),
                displayName: glossary.displayName,
                source: TagSource.Glossary,
              } as TagLabel,
            };
          }
        );

        return { nodes: treeNodes };
      } catch (error) {
        showErrorToast(error as AxiosError);

        return { nodes: [] };
      }
    },
    [getExclusivity, setExclusivity]
  );

  const handleChange = useCallback(
    (
      selectedNodes:
        | TreeSelectNode<TagLabel>[]
        | TreeSelectNode<TagLabel>
        | null
    ) => {
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
      .map(
        (tag): TreeSelectNode<TagLabel> => ({
          id: tag.tagFQN,
          label: tag.displayName || tag.name || tag.tagFQN,
          value: tag.tagFQN,
          data: tag,
        })
      );
  }, [value]);

  // Custom filter that always returns true because server-side filtering is already applied
  // This prevents double filtering which was hiding glossaries whose children don't match
  const customFilterNode = useCallback(() => true, []);

  return (
    <TreeSelect
      lazyLoad
      multiple
      searchable
      autoFocus={autoFocus}
      data-testid={dataTestId}
      fetchData={fetchData}
      filterNode={customFilterNode}
      label={typeof label === 'string' ? label : undefined}
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
    />
  );
};

export default GlossaryTermTreeSelect;
