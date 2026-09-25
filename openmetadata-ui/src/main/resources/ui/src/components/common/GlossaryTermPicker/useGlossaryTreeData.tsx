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
  TreeSelectDataFetcher,
  TreeSelectNode,
} from '@openmetadata/ui-core-components';
import { Glossary as GlossaryIcon } from '@openmetadata/ui-core-components/icons';
import axios, { AxiosError } from 'axios';
import { useCallback } from 'react';
import { PAGE_SIZE_LARGE } from '../../../constants/constants';
import { Glossary } from '../../../generated/entity/data/glossary';
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
  GlossaryPickerValue,
  glossaryRootValue,
} from './GlossaryTagSuggestionUtils';
import { useGlossaryMutualExclusivity } from './useGlossaryMutualExclusivity';

interface HierarchicalGlossary extends Glossary {
  children?: ModifiedGlossaryTerm[];
}

type GlossaryTreeFetcher = TreeSelectDataFetcher<GlossaryPickerValue>;

// Glossaries at the root, terms lazy-loaded on expand; ids are FQNs to match tagFQN.
export const useGlossaryTreeData = (): GlossaryTreeFetcher => {
  const { getExclusivity, setExclusivity } = useGlossaryMutualExclusivity();

  return useCallback(
    async ({ searchTerm, parentId, signal }) => {
      try {
        if (searchTerm) {
          const response = await searchGlossaryTerms(
            escapeESReservedCharacters(searchTerm),
            1,
            signal
          );

          // getHierarchy=true returns glossaries with their matching terms nested
          const treeNodes: TreeSelectNode<GlossaryPickerValue>[] = [];

          if (Array.isArray(response)) {
            response.forEach((glossary: HierarchicalGlossary) => {
              if (glossary.children && glossary.children.length > 0) {
                const childrenOptions =
                  convertGlossaryTermsToTreeOptionsWithNames(
                    glossary.children,
                    1,
                    glossary.mutuallyExclusive === true
                  );

                treeNodes.push({
                  // Same id as the root branch; selection is keyed by it.
                  id: glossary.name,
                  label: getEntityName(glossary),
                  value:
                    glossary.fullyQualifiedName || glossary.name || glossary.id,
                  children: convertToTreeNodes(childrenOptions),
                  isLeaf: false,
                  // See the root branch: checkable, but never a tag itself.
                  allowSelection: true,
                  hasExclusiveChildren: glossary.mutuallyExclusive === true,
                  lazyLoad: false,
                  icon: <GlossaryIcon size={16} />,
                  data: glossaryRootValue(glossary),
                });
              }
            });
          }

          return { nodes: treeNodes };
        }

        // Only glossaries lazy-load; a term's children arrive with its glossary.
        if (parentId) {
          const results = await queryGlossaryTerms(parentId, signal);

          if (results.length > 0) {
            const glossaryRoot = results[0];
            const treeOptions = convertGlossaryTermsToTreeOptionsWithNames(
              glossaryRoot.children ?? [],
              1,
              getExclusivity(parentId) ??
                glossaryRoot.mutuallyExclusive === true
            );

            return { nodes: convertToTreeNodes(treeOptions) };
          }

          return { nodes: [] };
        }

        const { data: glossaries } = await getGlossariesList(
          {
            fields:
              'name,displayName,fullyQualifiedName,mutuallyExclusive,termCount',
            limit: PAGE_SIZE_LARGE,
          },
          signal
        );

        const treeNodes: TreeSelectNode<GlossaryPickerValue>[] = glossaries.map(
          (glossary: Glossary) => {
            const isExclusive = glossary.mutuallyExclusive === true;
            setExclusivity(glossary.name, isExclusive);

            return {
              id: glossary.name, // queryGlossaryTerms expects the encoded name
              label: getEntityName(glossary),
              value: glossary.fullyQualifiedName || glossary.name,
              isLeaf: false,
              // Checkable to tick its terms; the payload marks it a root.
              allowSelection: true,
              count: glossary.termCount,
              data: glossaryRootValue(glossary),
              hasExclusiveChildren: isExclusive,
              lazyLoad: true,
              icon: <GlossaryIcon size={16} />,
            };
          }
        );

        return { nodes: treeNodes };
      } catch (error) {
        if (axios.isCancel(error)) {
          throw error;
        }
        showErrorToast(error as AxiosError);

        return { nodes: [] };
      }
    },
    [getExclusivity, setExclusivity]
  );
};
