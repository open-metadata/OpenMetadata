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
import {
  PAGE_SIZE_EXTRA_LARGE,
  PAGE_SIZE_LARGE,
} from '../../../constants/constants';
import { TabSpecificField } from '../../../enums/entity.enum';
import { Glossary } from '../../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import {
  getGlossariesList,
  getGlossaryTermChildrenLazy,
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
  glossaryTermToTreeNode,
} from './GlossaryTagSuggestionUtils';
import { useGlossaryMutualExclusivity } from './useGlossaryMutualExclusivity';

interface HierarchicalGlossary extends Glossary {
  children?: ModifiedGlossaryTerm[];
}

type GlossaryTreeFetcher = TreeSelectDataFetcher<GlossaryPickerValue>;

// Only the picker's own fields; owners and reviewers are extra joins per term.
const PICKER_TERM_FIELDS = [TabSpecificField.CHILDREN_COUNT];

// Glossaries at the root, terms paged per level; ids are FQNs to match tagFQN.
export const useGlossaryTreeData = (
  rootIsValue = false
): GlossaryTreeFetcher => {
  const { getExclusivity, setExclusivity } = useGlossaryMutualExclusivity();
  // The listing a search matches glossary names against; hits only carry terms.
  const rootsRef = useRef<TreeSelectNode<GlossaryPickerValue>[]>([]);
  // Glossary nodes are keyed by raw name, so keep the FQN the listing needs.
  const fqnByIdRef = useRef<Map<string, string>>(new Map());

  const fetchSearchHits = useCallback(
    async (searchTerm: string, signal?: AbortSignal) => {
      const response = await searchGlossaryTerms(
        escapeESReservedCharacters(searchTerm),
        1,
        signal
      );

      // getHierarchy=true returns glossaries with their matching terms nested
      const hits = (Array.isArray(response) ? response : [])
        .filter((glossary: HierarchicalGlossary) => glossary.children?.length)
        .map((glossary: HierarchicalGlossary) => ({
          // Same id as the root branch; selection is keyed by it.
          id: glossary.name,
          label: getEntityName(glossary),
          value: glossary.fullyQualifiedName || glossary.name || glossary.id,
          children: convertToTreeNodes(
            convertGlossaryTermsToTreeOptionsWithNames(
              glossary.children ?? [],
              1,
              glossary.mutuallyExclusive === true
            )
          ),
          isLeaf: false,
          // A glossary is not a tag; only a glossary-valued picker checks it.
          allowSelection: rootIsValue,
          hasExclusiveChildren: glossary.mutuallyExclusive === true,
          lazyLoad: false,
          icon: <GlossaryIcon size={16} />,
          data: glossaryRootValue(glossary),
        }));

      // A glossary whose own name matches has no term hit to carry it.
      const named = rootsRef.current.filter(
        (root) =>
          root.label.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !hits.some((hit) => hit.id === root.id)
      );

      return { nodes: [...named, ...hits] };
    },
    [rootIsValue]
  );

  // One level, one page. Every node lazy-loads, glossary and term alike.
  const fetchChildPage = useCallback(
    async (
      parentId: string,
      pageSize?: number,
      after?: string,
      signal?: AbortSignal
    ) => {
      const { data, paging } = await getGlossaryTermChildrenLazy(
        fqnByIdRef.current.get(parentId) ?? parentId,
        pageSize ?? PAGE_SIZE_EXTRA_LARGE,
        after,
        { fields: PICKER_TERM_FIELDS, signal }
      );

      const isParentMutuallyExclusive = getExclusivity(parentId) === true;

      const nodes = data.map((term) => {
        const child = term as GlossaryTerm;
        setExclusivity(
          child.fullyQualifiedName ?? child.name,
          child.mutuallyExclusive === true
        );

        return glossaryTermToTreeNode(child, isParentMutuallyExclusive);
      });

      return {
        nodes,
        hasMore: Boolean(paging?.after),
        total: paging?.total,
        nextCursor: paging?.after,
      };
    },
    [getExclusivity, setExclusivity]
  );

  const fetchGlossaries = useCallback(
    async (signal?: AbortSignal) => {
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
          fqnByIdRef.current.set(
            glossary.name,
            glossary.fullyQualifiedName ?? glossary.name
          );

          return {
            id: glossary.name, // the raw name, to match a tag's first FQN segment
            label: getEntityName(glossary),
            value: glossary.fullyQualifiedName || glossary.name,
            isLeaf: false,
            allowSelection: rootIsValue,
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
    },
    [setExclusivity, rootIsValue]
  );

  return useCallback(
    async ({ searchTerm, parentId, pageSize, after, signal }) => {
      try {
        if (searchTerm) {
          return await fetchSearchHits(searchTerm, signal);
        }
        if (parentId) {
          return await fetchChildPage(parentId, pageSize, after, signal);
        }

        return await fetchGlossaries(signal);
      } catch (error) {
        if (axios.isCancel(error)) {
          throw error;
        }
        showErrorToast(error as AxiosError);

        return { nodes: [] };
      }
    },
    [fetchSearchHits, fetchChildPage, fetchGlossaries]
  );
};
