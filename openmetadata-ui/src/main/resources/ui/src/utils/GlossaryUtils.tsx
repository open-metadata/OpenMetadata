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

import { Typography } from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import { isEmpty, isUndefined } from 'lodash';
import React from 'react';
import { StatusType } from '../components/common/StatusBadge/StatusBadge.interface';
import { ModifiedGlossaryTerm } from '../components/Glossary/GlossaryTermTab/GlossaryTermTab.interface';
import { ModifiedGlossary } from '../components/Glossary/useGlossary.store';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import { EntityType } from '../enums/entity.enum';
import { Glossary } from '../generated/entity/data/glossary';
import { GlossaryTerm, Status } from '../generated/entity/data/glossaryTerm';
import { Domain } from '../generated/entity/domains/domain';
import { calculatePercentageFromValue } from './CommonUtils';
import { getEntityName } from './EntityUtils';
import Fqn from './Fqn';
import { getGlossaryPath } from './RouterUtils';

export const buildTree = (data: GlossaryTerm[]): GlossaryTerm[] => {
  const nodes: Record<string, GlossaryTerm> = {};

  // Create nodes first
  data.forEach((obj) => {
    nodes[obj.fullyQualifiedName ?? ''] = {
      ...obj,
      children: obj.children?.length ? [] : undefined,
    };
  });

  // Build the tree structure
  const tree: GlossaryTerm[] = [];
  data.forEach((obj) => {
    const current = nodes[obj.fullyQualifiedName ?? ''];
    const parent = nodes[obj.parent?.fullyQualifiedName ?? ''];

    if (parent?.children) {
      // converting glossaryTerm to EntityReference
      parent.children.push({ ...current, type: 'glossaryTerm' });
    } else {
      tree.push(current);
    }
  });

  return tree;
};

export const getQueryFilterToExcludeTerm = (fqn: string) => ({
  query: {
    bool: {
      must: [
        {
          bool: {
            must_not: [
              {
                term: {
                  'tags.tagFQN': fqn,
                },
              },
            ],
          },
        },
        {
          bool: {
            must_not: [
              {
                term: {
                  entityType: EntityType.GLOSSARY_TERM,
                },
              },
              {
                term: {
                  entityType: EntityType.TAG,
                },
              },
              {
                term: {
                  entityType: EntityType.DATA_PRODUCT,
                },
              },
            ],
          },
        },
      ],
    },
  },
});

export const getQueryFilterToIncludeApprovedTerm = () => {
  return {
    query: {
      bool: {
        must: [
          {
            term: {
              status: Status.Approved,
            },
          },
        ],
      },
    },
  };
};

export const StatusClass = {
  [Status.Approved]: StatusType.Success,
  [Status.Draft]: StatusType.Warning,
  [Status.Rejected]: StatusType.Failure,
  [Status.Deprecated]: StatusType.Warning,
  [Status.InReview]: StatusType.Running,
};

export const StatusFilters = Object.values(Status)
  .filter((status) => status !== Status.Deprecated) // Deprecated not in use for this release
  .map((status) => ({
    text: status,
    value: status,
  }));

export const getGlossaryBreadcrumbs = (fqn: string) => {
  const arr = Fqn.split(fqn);
  const dataFQN: Array<string> = [];
  const breadcrumbList = [
    {
      name: 'Glossaries',
      url: getGlossaryPath(''),
      activeTitle: false,
    },
    ...arr.map((d) => {
      dataFQN.push(d);

      return {
        name: d,
        url: getGlossaryPath(dataFQN.join(FQN_SEPARATOR_CHAR)),
        activeTitle: false,
      };
    }),
  ];

  return breadcrumbList;
};

export const updateGlossaryTermByFqn = (
  glossaryTerms: ModifiedGlossary[],
  fqn: string,
  newValue: ModifiedGlossary
): ModifiedGlossary[] => {
  return glossaryTerms.map((term) => {
    if (term.fullyQualifiedName === fqn) {
      return newValue;
    }
    if (term.children) {
      return {
        ...term,
        children: updateGlossaryTermByFqn(
          term.children as ModifiedGlossary[],
          fqn,
          newValue
        ),
      };
    }

    return term;
  }) as ModifiedGlossary[];
};

// This function finds and gives you the glossary term you're looking for.
// You can then use this term or update its information in the Glossary or Term with it's reference created
// Reference will only be created if withReference is true
export const findItemByFqn = (
  list: ModifiedGlossaryTerm[] | Domain[],
  fullyQualifiedName: string,
  withReference = true
): GlossaryTerm | Glossary | ModifiedGlossary | Domain | null => {
  for (const item of list) {
    if (
      (item.fullyQualifiedName ?? (item as ModifiedGlossaryTerm).value) ===
      fullyQualifiedName
    ) {
      return withReference
        ? item
        : {
            ...item,
            fullyQualifiedName:
              item.fullyQualifiedName ??
              (item as ModifiedGlossaryTerm).data?.tagFQN,
            ...((item as ModifiedGlossaryTerm).data ?? {}),
          };
    }
    if (item.children) {
      const found = findItemByFqn(
        item.children as ModifiedGlossaryTerm[],
        fullyQualifiedName
      );
      if (found) {
        return found;
      }
    }
  }

  return null;
};

export const convertGlossaryTermsToTreeOptions = (
  options: ModifiedGlossaryTerm[] = [],
  level = 0
): Omit<DefaultOptionType, 'label'>[] => {
  const treeData = options.map((option) => {
    const hasChildren = 'children' in option && !isEmpty(option?.children);

    // for 0th level we don't want check option to available
    const isGlossaryTerm = level !== 0;

    // Only include keys with no children or keys that are not expanded
    return {
      id: option.id,
      value: option.fullyQualifiedName,
      name: option.name,
      title: (
        <Typography.Text ellipsis style={{ color: option?.style?.color }}>
          {getEntityName(option)}
        </Typography.Text>
      ),
      'data-testid': `tag-${option.fullyQualifiedName}`,
      checkable: isGlossaryTerm,
      isLeaf: isGlossaryTerm ? !hasChildren : false,
      selectable: isGlossaryTerm,
      children:
        hasChildren &&
        convertGlossaryTermsToTreeOptions(
          option.children as ModifiedGlossaryTerm[],
          level + 1
        ),
    };
  });

  return treeData;
};

/**
 * Finds the expandable keys in a glossary term.
 * @param glossaryTerm - The glossary term to search for expandable keys.
 * @returns An array of expandable keys found in the glossary term.
 */
export const findExpandableKeys = (
  glossaryTerm?: ModifiedGlossaryTerm
): string[] => {
  let expandableKeys: string[] = [];

  if (!glossaryTerm) {
    return expandableKeys;
  }

  if (glossaryTerm.children) {
    glossaryTerm.children.forEach((child) => {
      expandableKeys = expandableKeys.concat(
        findExpandableKeys(child as ModifiedGlossaryTerm)
      );
    });
    if (glossaryTerm.fullyQualifiedName) {
      expandableKeys.push(glossaryTerm.fullyQualifiedName);
    }
  } else if (glossaryTerm.childrenCount) {
    if (glossaryTerm.fullyQualifiedName) {
      expandableKeys.push(glossaryTerm.fullyQualifiedName);
    }
  }

  return expandableKeys;
};

/**
 * Finds the expandable keys for an array of glossary terms.
 *
 * @param glossaryTerms - An array of ModifiedGlossaryTerm objects.
 * @returns An array of expandable keys.
 */
export const findExpandableKeysForArray = (
  glossaryTerms: ModifiedGlossaryTerm[]
): string[] => {
  let expandableKeys: string[] = [];

  glossaryTerms.forEach((glossaryTerm) => {
    expandableKeys = expandableKeys.concat(findExpandableKeys(glossaryTerm));
  });

  return expandableKeys;
};

/**
 * Filter out the tree node options based on the filter options.
 *
 * @param options - An array of Glossary objects.
 * @param filterOptions - An array of FQN string to filter.
 * @returns An array of filtered Glossary
 */
export const filterTreeNodeOptions = (
  options: Glossary[],
  filterOptions: string[]
): Glossary[] => {
  if (isEmpty(filterOptions)) {
    return options;
  }

  const filterNodes = (
    nodes: ModifiedGlossaryTerm[]
  ): ModifiedGlossaryTerm[] => {
    return nodes.reduce(
      (acc: ModifiedGlossaryTerm[], node: ModifiedGlossaryTerm) => {
        const isMatching = filterOptions.includes(
          node.fullyQualifiedName ?? ''
        );

        const filteredChildren = !isUndefined(node.children)
          ? filterNodes(node.children as unknown as ModifiedGlossaryTerm[])
          : [];

        if (!isMatching) {
          acc.push({
            ...node,
            children: filteredChildren as GlossaryTerm[],
          });
        }

        return acc;
      },
      []
    );
  };

  return filterNodes(options as ModifiedGlossaryTerm[]);
};

export const findAndUpdateNested = (
  terms: ModifiedGlossary[],
  newTerm: GlossaryTerm
): ModifiedGlossary[] => {
  // If new term has no parent, it's a top level term
  // So just update 0 level terms no need to iterate over it
  if (!newTerm.parent) {
    return [...terms, newTerm as ModifiedGlossary];
  }

  // If parent is there means term is  created within a term
  // So we need to find the parent term and update it's children
  return terms.map((term) => {
    if (term.fullyQualifiedName === newTerm.parent?.fullyQualifiedName) {
      const children = [...(term.children || []), newTerm] as GlossaryTerm[];

      return {
        ...term,
        children,
        // Need to update childrenCount in case of 0 to update expand / collapse icon
        childrenCount: children.length,
      } as ModifiedGlossary;
    } else if ('children' in term && term.children?.length) {
      return {
        ...term,
        children: findAndUpdateNested(
          term.children as ModifiedGlossary[],
          newTerm
        ),
      } as ModifiedGlossary;
    }

    return term;
  });
};

export const glossaryTermTableColumnsWidth = (
  tableWidth: number,
  havingCreatePermission: boolean
) => ({
  name: calculatePercentageFromValue(tableWidth, 40),
  description: calculatePercentageFromValue(
    tableWidth,
    havingCreatePermission ? 21 : 33
  ),
  reviewers: calculatePercentageFromValue(tableWidth, 33),
  synonyms: calculatePercentageFromValue(tableWidth, 33),
  owners: calculatePercentageFromValue(tableWidth, 17),
  status: calculatePercentageFromValue(tableWidth, 12),
});
