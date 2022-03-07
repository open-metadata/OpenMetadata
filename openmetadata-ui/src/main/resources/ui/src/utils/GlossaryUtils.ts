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

import { FormatedGlossarySuggestion } from 'Models';
import { DataNode } from 'rc-tree/lib/interface';
import { GlossaryTerm } from '../generated/entity/data/glossaryTerm';
import { ModifiedGlossaryData } from '../pages/GlossaryPage/GlossaryPageV1.component';
import { getNameFromFQN } from './CommonUtils';

export interface GlossaryTermTreeNode {
  children?: GlossaryTermTreeNode[];
  fullyQualifiedName: string;
  name: string;
}

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

export const getSearchedGlossaryTermTree = (
  searchedTerms: FormatedGlossarySuggestion[]
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

export const updateGlossaryListBySearchedTerms = (
  glossaries: ModifiedGlossaryData[],
  searchedTerms: FormatedGlossarySuggestion[]
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

export const getActionsList = (name = '') => {
  return [
    {
      name: 'Add Term',
      value: 'add_term',
    },
    {
      name: `Delete ${name}`,
      value: 'delete',
    },
  ];
};

export const getHierarchicalKeysByFQN = (fqn: string) => {
  const keys = fqn.split('.').reduce((prev, curr) => {
    const currFqn = prev.length ? `${prev[prev.length - 1]}.${curr}` : curr;

    return [...prev, currFqn];
  }, [] as string[]);

  return keys;
};
