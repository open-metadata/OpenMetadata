/*
 *  Copyright 2022 Collate.
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
import { ModifiedGlossaryTerm } from 'components/Glossary/GlossaryTermTab/GlossaryTermTab.interface';
import {
  GlossaryTermDetailsProps,
  HierarchyTagsProps,
} from 'components/Tag/TagsContainerV1/TagsContainerV1.interface';
import { API_RES_MAX_SIZE, PAGE_SIZE_LARGE } from 'constants/constants';
import { TagSource } from 'generated/type/tagLabel';
import { isUndefined, omit } from 'lodash';
import {
  getGlossariesList,
  getGlossaryTerms,
  ListGlossaryTermsParams,
} from 'rest/glossaryAPI';
import { searchData } from 'rest/miscAPI';
import { WILD_CARD_CHAR } from '../constants/char.constants';
import { SearchIndex } from '../enums/search.enum';
import { Glossary } from '../generated/entity/data/glossary';
import { GlossaryTerm } from '../generated/entity/data/glossaryTerm';
import { EntityReference } from '../generated/type/entityReference';
import { SearchResponse } from '../interface/search.interface';
import { formatSearchGlossaryTermResponse } from './APIUtils';

export interface GlossaryTermTreeNode {
  children?: GlossaryTermTreeNode[];
  fullyQualifiedName: string;
  name: string;
}

/**
 * To get all glossary terms
 * @returns promise of list of formatted glossary terms
 */
export const fetchGlossaryTerms = (): Promise<GlossaryTerm[]> => {
  return new Promise<GlossaryTerm[]>((resolve, reject) => {
    searchData(WILD_CARD_CHAR, 1, 1000, '', '', '', SearchIndex.GLOSSARY)
      .then((res) => {
        const data = formatSearchGlossaryTermResponse(
          (res?.data as SearchResponse<SearchIndex.GLOSSARY>)?.hits?.hits || []
        );
        resolve(data);
      })
      .catch((error: AxiosError) => reject(error.response));
  });
};

/**
 * To get list of fqns from list of glossary terms
 * @param terms formatted glossary terms
 * @returns list of term fqns
 */
export const getGlossaryTermlist = (
  terms: Array<GlossaryTerm> = []
): Array<string> => {
  return terms.map((term: GlossaryTerm) => term.fullyQualifiedName || '');
};

export const getEntityReferenceFromGlossary = (
  glossary: Glossary
): EntityReference => {
  return {
    deleted: glossary.deleted,
    href: glossary.href,
    fullyQualifiedName: glossary.fullyQualifiedName ?? '',
    id: glossary.id,
    type: 'glossaryTerm',
    description: glossary.description,
    displayName: glossary.displayName,
    name: glossary.name,
  };
};

export const getEntityReferenceFromGlossaryTerm = (
  glossaryTerm: GlossaryTerm
): EntityReference => {
  return {
    deleted: glossaryTerm.deleted,
    href: glossaryTerm.href,
    fullyQualifiedName: glossaryTerm.fullyQualifiedName ?? '',
    id: glossaryTerm.id,
    type: 'glossaryTerm',
    description: glossaryTerm.description,
    displayName: glossaryTerm.displayName,
    name: glossaryTerm.name,
  };
};

// calculate root level glossary term
export const getRootLevelGlossaryTerm = (
  data: GlossaryTerm[],
  params?: ListGlossaryTermsParams
) => {
  return data.reduce((glossaryTerms, curr) => {
    const currentTerm =
      curr.children?.length === 0 ? omit(curr, 'children') : curr;
    if (params?.glossary) {
      return isUndefined(curr.parent)
        ? [...glossaryTerms, currentTerm]
        : glossaryTerms;
    }

    return curr?.parent?.id === params?.parent
      ? [...glossaryTerms, currentTerm]
      : glossaryTerms;
  }, [] as GlossaryTerm[]);
};

export const buildTree = (data: GlossaryTerm[]): GlossaryTerm[] => {
  const nodes: Record<string, GlossaryTerm> = {};
  const tree: GlossaryTerm[] = [];

  // Sorting children having parent first to avoid duplicates
  const sortedData = [...data].sort((a, b) => {
    if (a.parent && !b.parent) {
      return 1;
    } else if (!a.parent && b.parent) {
      return -1;
    } else {
      return 0;
    }
  });

  sortedData.forEach((obj) => {
    if (obj.fullyQualifiedName) {
      nodes[obj.fullyQualifiedName] = {
        ...obj,
        children: obj.children?.length ? [] : undefined,
      };
      const parentNode =
        obj.parent?.fullyQualifiedName && nodes[obj.parent.fullyQualifiedName];

      parentNode &&
        nodes[obj.fullyQualifiedName] &&
        parentNode.children?.push(
          nodes[obj.fullyQualifiedName] as unknown as EntityReference
        );
      parentNode ? null : tree.push(nodes[obj.fullyQualifiedName]);
    }
  });

  return tree;
};

// update glossaryTerm tree with newly fetch child term
export const createGlossaryTermTree = (
  glossaryTerms: ModifiedGlossaryTerm[],
  updatedData: GlossaryTerm[],
  glossaryTermId?: string
) => {
  return glossaryTerms.map((term) => {
    if (term.id === glossaryTermId) {
      term.children = updatedData;
    } else if (term?.children?.length) {
      createGlossaryTermTree(
        term.children as ModifiedGlossaryTerm[],
        updatedData,
        glossaryTermId
      );
    }

    return term;
  });
};

// Calculate searched data based on search value
export const getSearchedDataFromGlossaryTree = (
  glossaryTerms: ModifiedGlossaryTerm[],
  value: string
): ModifiedGlossaryTerm[] => {
  return glossaryTerms.reduce((acc, term) => {
    const isMatching =
      term.name.toLowerCase().includes(value.toLowerCase()) ||
      term?.displayName?.toLowerCase().includes(value.toLowerCase());

    if (isMatching) {
      return [...acc, term];
    } else if (term.children?.length) {
      const children = getSearchedDataFromGlossaryTree(
        term.children as ModifiedGlossaryTerm[],
        value
      );
      if (children.length) {
        return [...acc, { ...term, children: children as GlossaryTerm[] }];
      }
    }

    return acc;
  }, [] as ModifiedGlossaryTerm[]);
};

export const getQueryFilterToExcludeTerm = (fqn: string) => ({
  query: {
    bool: {
      must: [
        {
          bool: {
            must: [
              {
                bool: {
                  must_not: {
                    term: {
                      'tags.tagFQN': fqn,
                    },
                  },
                },
              },
            ],
          },
        },
      ],
    },
  },
});

export const formatRelatedTermOptions = (
  data: EntityReference[] | undefined
) => {
  return data
    ? data.map((value) => ({
        ...value,
        value: value.id,
        label: value.displayName || value.name,
        key: value.id,
      }))
    : [];
};

export const getGlossaryTermHierarchy = (
  data: GlossaryTermDetailsProps[]
): HierarchyTagsProps[] => {
  const nodes: Record<string, HierarchyTagsProps> = {};
  const tree: HierarchyTagsProps[] = [];

  data.forEach((obj) => {
    if (obj.fqn) {
      nodes[obj.fqn] = {
        title: obj.name,
        value: obj.fqn,
        key: obj.fqn,
        selectable: true,
        children: [],
      };
      const parentNode =
        obj.parent &&
        obj.parent.fullyQualifiedName &&
        nodes[obj.parent.fullyQualifiedName];
      parentNode && nodes[obj.fqn] && parentNode.children?.push(nodes[obj.fqn]);

      if (!parentNode) {
        const glossaryName = obj.glossary.name ?? '';
        const existInTree = tree.find((item) => item.title === glossaryName);

        if (existInTree) {
          nodes[glossaryName].children?.push(nodes[obj.fqn]);
        } else {
          nodes[glossaryName] = {
            title: glossaryName,
            value: obj.glossary.fullyQualifiedName ?? '',
            key: obj.glossary.fullyQualifiedName ?? '',
            selectable: false,
            children: [],
          };

          nodes[glossaryName].children?.push(nodes[obj.fqn]);
          tree.push(nodes[glossaryName]);
        }
      }
    }
  });

  return tree;
};

export const getGlossaryTermsList = async () => {
  try {
    const glossaryTermList: GlossaryTermDetailsProps[] = [];
    const { data } = await getGlossariesList({
      limit: PAGE_SIZE_LARGE,
    });

    const promises = data.map((item) =>
      getGlossaryTerms({
        glossary: item.id,
        limit: API_RES_MAX_SIZE,
        fields: 'children,parent',
      })
    );
    const response = await Promise.allSettled(promises);

    response.forEach((res) => {
      if (res.status === 'fulfilled') {
        glossaryTermList.push(
          ...res.value.data.map((data) => ({
            name: data.name,
            fqn: data.fullyQualifiedName ?? '',
            children: data.children,
            parent: data.parent,
            glossary: data.glossary,
            source: TagSource.Glossary,
          }))
        );
      }
    });

    return Promise.resolve(glossaryTermList);
  } catch (error) {
    return Promise.reject({ data: (error as AxiosError).response });
  }
};
