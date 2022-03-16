/*
 *  Copyright 2021 Collate
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

import { AxiosError, AxiosResponse } from 'axios';
import { cloneDeep, isEmpty } from 'lodash';
import {
  FormattedGlossarySuggestion,
  FormattedGlossaryTermData,
  SearchResponse,
} from 'Models';
import { DataNode } from 'rc-tree/lib/interface';
import {
  getGlossaries,
  getGlossaryTermByFQN,
  getGlossaryTerms,
} from '../axiosAPIs/glossaryAPI';
import { searchData } from '../axiosAPIs/miscAPI';
import { WILD_CARD_CHAR } from '../constants/char.constants';
import { SearchIndex } from '../enums/search.enum';
import { GlossaryTerm } from '../generated/entity/data/glossaryTerm';
import { ModifiedGlossaryData } from '../pages/GlossaryPage/GlossaryPageV1.component';
import { formatSearchGlossaryTermResponse } from './APIUtils';
import { getNameFromFQN } from './CommonUtils';

export interface GlossaryTermTreeNode {
  children?: GlossaryTermTreeNode[];
  fullyQualifiedName: string;
  name: string;
}

/**
 * To get all glossary terms
 * @returns promise of list of formatted glossary terms
 */
export const fetchGlossaryTerms = (): Promise<FormattedGlossaryTermData[]> => {
  return new Promise<FormattedGlossaryTermData[]>((resolve, reject) => {
    searchData(WILD_CARD_CHAR, 1, 1000, '', '', '', SearchIndex.GLOSSARY)
      .then((res: SearchResponse) => {
        const data = formatSearchGlossaryTermResponse(
          res?.data?.hits?.hits || []
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
  terms: Array<FormattedGlossaryTermData> = []
): Array<string> => {
  return terms.map((term: FormattedGlossaryTermData) => term?.fqdn);
};

/**
 * To get child terms of any node if available
 * @param listTermFQN fqn of targeted child terms
 * @returns promise of list of glossary terms
 */
export const getChildGlossaryTerms = (
  listTermFQN: Array<string>
): Promise<GlossaryTerm[]> => {
  return new Promise((resolve, reject) => {
    const promises = listTermFQN.map((term) => {
      return getGlossaryTermByFQN(term, ['children']);
    });
    Promise.allSettled(promises)
      .then((responses: PromiseSettledResult<AxiosResponse>[]) => {
        const data = responses.reduce((prev, curr) => {
          return curr.status === 'fulfilled' ? [...prev, curr.value] : prev;
        }, [] as AxiosResponse[]);
        resolve(data.map((item) => item.data));
      })
      .catch((err) => {
        reject(err);
      });
  });
};

/**
 * To recursively generate RcTree data from glossary list
 * @param data list of glossary or glossary terms
 * @returns RcTree data node
 */
export const generateTreeData = (data: ModifiedGlossaryData[]): DataNode[] => {
  return data.map((d) => {
    return d.children?.length
      ? {
          key: (d as GlossaryTerm)?.fullyQualifiedName || d.name,
          title: getNameFromFQN(d.name),
          children: generateTreeData(d.children as ModifiedGlossaryData[]),
          data: d,
        }
      : {
          key: (d as GlossaryTerm)?.fullyQualifiedName || d.name,
          title: getNameFromFQN(d.name),
          data: d,
        };
  });
};

/**
 * Creates glossary term tree node from fqn
 * and root node name
 * @param leafFqn node fqn
 * @param name root node name
 * @returns node for glossary tree
 */
const createGlossaryTermNode = (
  leafFqn: string,
  name: string
): GlossaryTermTreeNode => {
  const arrFQN = leafFqn.split(`${name}.`);
  const childName = arrFQN[1]?.split('.')[0];

  return !childName
    ? {
        name,
        fullyQualifiedName: arrFQN[0],
      }
    : {
        name,
        fullyQualifiedName: `${arrFQN[0]}${name}`,
        children: [createGlossaryTermNode(leafFqn, childName)],
      };
};

/**
 * To merge the duplicate glossaries and terms
 * to generate optimised tree
 * @param treeNodes list of glossary nodes with duplicate items
 * @returns list of glossary nodes with unique items
 */
const optimiseGlossaryTermTree = (treeNodes?: GlossaryTermTreeNode[]) => {
  if (treeNodes) {
    for (let i = 0; i < treeNodes.length; i++) {
      // const reps = 0;
      for (let j = i + 1; j < treeNodes.length; ) {
        if (
          treeNodes[j].fullyQualifiedName === treeNodes[i].fullyQualifiedName
        ) {
          if (treeNodes[j].children?.length || treeNodes[i].children?.length) {
            treeNodes[i].children = (treeNodes[i].children || []).concat(
              treeNodes[j].children || []
            );
          }
          treeNodes.splice(j, 1);
        } else {
          j++;
        }
      }
      if (treeNodes[i].children?.length) {
        treeNodes[i].children = optimiseGlossaryTermTree(treeNodes[i].children);
      }
    }
  }

  return treeNodes;
};

/**
 * To generate glossry tree from searched terms
 * @param searchedTerms list of formatted searched terms
 * @returns list of glossary tree
 */
export const getSearchedGlossaryTermTree = (
  searchedTerms: FormattedGlossarySuggestion[]
): GlossaryTermTreeNode[] => {
  const termTree: GlossaryTermTreeNode[] = [];
  for (const term of searchedTerms) {
    const arrFQN = term.fqdn.split('.');
    const rootName = arrFQN[0];
    termTree.push(createGlossaryTermNode(term.fqdn, rootName));
  }
  optimiseGlossaryTermTree(termTree);

  return termTree;
};

/**
 * To get Tree of glossaries based on search result
 * @param glossaries list of glossaries
 * @param searchedTerms list of formatted searched terms
 * @returns glossary list based on searched terms
 */
export const updateGlossaryListBySearchedTerms = (
  glossaries: ModifiedGlossaryData[],
  searchedTerms: FormattedGlossarySuggestion[]
) => {
  const searchedTermTree = getSearchedGlossaryTermTree(searchedTerms);

  return glossaries.reduce((prev, curr) => {
    const children = searchedTermTree.find(
      (item) => item.name === curr.name
    )?.children;
    const data = (
      children ? { ...curr, children: children } : curr
    ) as ModifiedGlossaryData;

    return [...prev, data];
  }, [] as ModifiedGlossaryData[]);
};

/**
 * To get actions for action dropdown button
 * @returns list of action items
 */
export const getActionsList = () => {
  return [
    {
      name: 'Add Term',
      value: 'add_term',
    },
  ];
};

/**
 * To get hierarchy of fqns from glossary to targeted term
 * from given fqn
 * @param fqn fqn of glossary or glossary term
 * @returns list of fqns
 */
export const getHierarchicalKeysByFQN = (fqn: string) => {
  const keys = fqn.split('.').reduce((prev, curr) => {
    const currFqn = prev.length ? `${prev[prev.length - 1]}.${curr}` : curr;

    return [...prev, currFqn];
  }, [] as string[]);

  return keys;
};

/**
 * To get glossary term data from glossary object
 * @param glossary parent glossary
 * @param termFqn fqn of targeted glossary term
 * @returns Glossary term or {}
 */
export const getTermDataFromGlossary = (
  glossary: ModifiedGlossaryData,
  termFqn: string
) => {
  let data: ModifiedGlossaryData | GlossaryTerm = cloneDeep(glossary);
  const arrFQN = getHierarchicalKeysByFQN(termFqn);
  for (let i = 1; i < arrFQN.length; i++) {
    data = data?.children
      ? ((data.children as unknown as GlossaryTerm[])?.find(
          (item) =>
            item.fullyQualifiedName === arrFQN[i] || item.name === arrFQN[i]
        ) as GlossaryTerm)
      : ({} as GlossaryTerm);
    if (isEmpty(data)) {
      break;
    }
  }

  return data;
};

/**
 * To get relative indexed position of
 * glossary term from tree of glossaries
 * @param arrGlossary list of glossary
 * @param termFqn fqn of target glossary term
 * @returns array of numbered positions
 */
export const getTermPosFromGlossaries = (
  arrGlossary: ModifiedGlossaryData[],
  termFqn: string
) => {
  const arrFQN = getHierarchicalKeysByFQN(termFqn);
  const glossaryIdx = arrGlossary.findIndex((item) => item.name === arrFQN[0]);
  const pos = [];
  if (glossaryIdx !== -1) {
    pos.push(glossaryIdx);
    let data: ModifiedGlossaryData | GlossaryTerm = arrGlossary[glossaryIdx];
    for (let i = 1; i < arrFQN.length; i++) {
      const index = data?.children
        ? (data.children as unknown as GlossaryTerm[])?.findIndex(
            (item) =>
              item.fullyQualifiedName === arrFQN[i] || item.name === arrFQN[i]
          )
        : -1;

      if (index === -1) {
        break;
      }
      data = (data?.children ? data?.children[index] : {}) as GlossaryTerm;
      pos.push(index);
    }
  }

  return pos;
};

/**
 * Fetches and adds root terms to each glossary
 * @param glossaries list of glossaries
 * @returns promise of list of glossaries with root terms
 */
const getRootTermEmbeddedGlossary = (
  glossaries: Array<ModifiedGlossaryData>
): Promise<Array<ModifiedGlossaryData>> => {
  return new Promise<Array<ModifiedGlossaryData>>((resolve, reject) => {
    const promises = glossaries.map((glossary) =>
      getGlossaryTerms(glossary.id, 1000, [
        'children',
        'relatedTerms',
        'reviewers',
        'tags',
      ])
    );
    Promise.allSettled(promises)
      .then((responses: PromiseSettledResult<AxiosResponse>[]) => {
        for (let i = 0; i < responses.length; i++) {
          const res = responses[i];
          const glossary = glossaries[i];
          if (res.status === 'fulfilled') {
            const { data } = res.value.data;

            // Filtering root level terms from glossary
            glossary.children = data.filter((d: GlossaryTerm) => !d.parent);
          }
        }
        resolve(glossaries);
      })
      .catch((err: AxiosError) => {
        reject(err);
      });
  });
};

/**
 * Fetches list of glossaries with root terms in each of them
 * @param paging pagination cursor
 * @param limit result count
 * @param arrQueryFields api query-string
 * @returns promise of api response
 */
export const getGlossariesWithRootTerms = (
  paging = '',
  limit = 10,
  arrQueryFields: string[]
): Promise<Array<ModifiedGlossaryData>> => {
  return new Promise<Array<ModifiedGlossaryData>>((resolve, reject) => {
    getGlossaries(paging, limit, arrQueryFields)
      .then((res: AxiosResponse) => {
        const { data } = res.data;
        if (data?.length) {
          getRootTermEmbeddedGlossary(data)
            .then((res) => resolve(res))
            .catch((err) => reject(err));
        } else {
          resolve([]);
        }
      })
      .catch((err: AxiosError) => {
        reject(err);
      });
  });
};
