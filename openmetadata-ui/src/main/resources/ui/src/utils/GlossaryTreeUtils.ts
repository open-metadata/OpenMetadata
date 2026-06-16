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

import { isEmpty, isUndefined } from 'lodash';
import { ModifiedGlossaryTerm } from '../components/Glossary/GlossaryTermTab/GlossaryTermTab.interface';
import { ModifiedGlossary } from '../components/Glossary/useGlossary.store';
import { EntityType } from '../enums/entity.enum';
import { Glossary } from '../generated/entity/data/glossary';
import {
  EntityStatus,
  GlossaryTerm,
} from '../generated/entity/data/glossaryTerm';
import { Domain } from '../generated/entity/domains/domain';
import { User } from '../generated/entity/teams/user';
import { Task } from '../rest/tasksAPI';
import i18n from './i18next/LocalUtil';
import { calculatePercentageFromValue } from './NumberUtils';

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
            children: filteredChildren,
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
) => {
  return {
    name: calculatePercentageFromValue(tableWidth, 30),
    description: calculatePercentageFromValue(
      tableWidth,
      havingCreatePermission ? 21 : 33
    ),
    reviewers: calculatePercentageFromValue(tableWidth, 33),
    synonyms: calculatePercentageFromValue(tableWidth, 33),
    owners: calculatePercentageFromValue(tableWidth, 17),
    status: calculatePercentageFromValue(tableWidth, 20),
  };
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
              entityStatus: EntityStatus.Approved,
            },
          },
        ],
      },
    },
  };
};

export const getGlossaryEntityLink = (glossaryTermFQN: string) =>
  `<#E::${EntityType.GLOSSARY_TERM}::${glossaryTermFQN}>`;

export const permissionForApproveOrReject = (
  record: ModifiedGlossaryTerm,
  currentUser: User,
  termTaskThreads: Record<string, Task[]>
) => {
  const entityLink = getGlossaryEntityLink(record.fullyQualifiedName ?? '');
  const task = termTaskThreads[entityLink]?.[0];
  const currentUserId = currentUser?.id;

  const isReviewer = record.reviewers?.some(
    (reviewer) => reviewer.id === currentUserId
  );
  const isTaskAssignee = task?.assignees?.some(
    (assignee) => assignee.id === currentUserId
  );
  const hasTaskAssignees = Boolean(task?.assignees?.length);

  const permission = hasTaskAssignees
    ? Boolean(isTaskAssignee)
    : Boolean(task && (isTaskAssignee || isReviewer));

  return {
    permission,
    taskId: task?.id ?? '',
  };
};

export const validateReferenceURL = (url: string): boolean => {
  if (!url) {
    return true;
  }

  return url.startsWith('http://') || url.startsWith('https://');
};

export const referenceURLValidator = (
  _: unknown,
  value: string
): Promise<void> => {
  if (validateReferenceURL(value)) {
    return Promise.resolve();
  }

  return Promise.reject(
    new Error(i18n.t('message.url-must-start-with-http-or-https'))
  );
};
