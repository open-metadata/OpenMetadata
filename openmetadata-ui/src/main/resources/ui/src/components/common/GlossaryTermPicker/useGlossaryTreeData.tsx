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
import { useCallback, useRef } from 'react';
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
// A glossary row is checkable when it is the value, or when a multi-select
// cascades its terms — and then only if it has any.
export const useGlossaryTreeData = (
  rootIsValue = false,
  rootCascades = true
): GlossaryTreeFetcher => {
  const { getExclusivity, setExclusivity } = useGlossaryMutualExclusivity();
  // The listing a search matches glossary names against; hits only carry terms.
  const rootsRef = useRef<TreeSelectNode<GlossaryPickerValue>[]>([]);

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
                  // Same rule as the root branch; a hit always has terms.
                  allowSelection: rootIsValue || rootCascades,
                  hasExclusiveChildren: glossary.mutuallyExclusive === true,
                  lazyLoad: false,
                  icon: <GlossaryIcon size={16} />,
                  data: glossaryRootValue(glossary),
                });
              }
            });
          }

          // A glossary whose own name matches has no term hit to carry it.
          const named = rootsRef.current.filter(
            (root) =>
              root.label.toLowerCase().includes(searchTerm.toLowerCase()) &&
              !treeNodes.some((hit) => hit.id === root.id)
          );

          return { nodes: [...named, ...treeNodes] };
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

        const rootNodes: TreeSelectNode<GlossaryPickerValue>[] = glossaries.map(
          (glossary: Glossary) => {
            const isExclusive = glossary.mutuallyExclusive === true;
            setExclusivity(glossary.name, isExclusive);

            return {
              id: glossary.name, // queryGlossaryTerms expects the encoded name
              label: getEntityName(glossary),
              value: glossary.fullyQualifiedName || glossary.name,
              isLeaf: false,
              allowSelection:
                rootIsValue || (rootCascades && glossary.termCount !== 0),
              count: glossary.termCount,
              data: glossaryRootValue(glossary),
              hasExclusiveChildren: isExclusive,
              lazyLoad: true,
              icon: <GlossaryIcon size={16} />,
            };
          }
        );

        rootsRef.current = rootNodes;

        return { nodes: rootNodes };
      } catch (error) {
        if (axios.isCancel(error)) {
          throw error;
        }
        showErrorToast(error as AxiosError);

        return { nodes: [] };
      }
    },
    [getExclusivity, setExclusivity, rootIsValue, rootCascades]
  );
};
