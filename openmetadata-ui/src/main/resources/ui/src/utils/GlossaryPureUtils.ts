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
import { isEmpty, isUndefined } from 'lodash';
import { StatusType } from '../components/common/StatusBadge/StatusBadge.interface';
import type { ModifiedGlossaryTerm } from '../components/Glossary/GlossaryTermTab/GlossaryTermTab.interface';
import type { ModifiedGlossary } from '../components/Glossary/useGlossary.store';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import { EntityType } from '../enums/entity.enum';
import type { Glossary } from '../generated/entity/data/glossary';
import {
  EntityStatus,
  type GlossaryTerm,
} from '../generated/entity/data/glossaryTerm';
import type { Domain } from '../generated/entity/domains/domain';
import type { Task } from '../generated/entity/tasks/task';
import type { User } from '../generated/entity/teams/user';
import Fqn from './Fqn';
import i18n from './i18next/LocalUtil';
import { calculatePercentageFromValue } from './NumberUtils';
import { getGlossaryPath } from './RouterUtils';

export const buildTree = (data: GlossaryTerm[]): GlossaryTerm[] => {
  const nodes: Record<string, GlossaryTerm> = {};

  data.forEach((obj) => {
    nodes[obj.fullyQualifiedName ?? ''] = {
      ...obj,
      children: obj.children?.length ? [] : undefined,
    };
  });

  const tree: GlossaryTerm[] = [];
  data.forEach((obj) => {
    const current = nodes[obj.fullyQualifiedName ?? ''];
    const parent = nodes[obj.parent?.fullyQualifiedName ?? ''];

    if (parent?.children) {
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
              entityStatus: EntityStatus.Approved,
            },
          },
        ],
      },
    },
  };
};

export const StatusClass = {
  [EntityStatus.Approved]: StatusType.Success,
  [EntityStatus.Draft]: StatusType.Pending,
  [EntityStatus.Rejected]: StatusType.Failure,
  [EntityStatus.Deprecated]: StatusType.Deprecated,
  [EntityStatus.InReview]: StatusType.InReview,
  [EntityStatus.Unprocessed]: StatusType.Unprocessed,
};

export const StatusFilters = Object.values(EntityStatus)
  .filter((status) => status !== EntityStatus.Deprecated)
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

export const findExpandableKeysForArray = (
  glossaryTerms: ModifiedGlossaryTerm[]
): string[] => {
  let expandableKeys: string[] = [];

  glossaryTerms.forEach((glossaryTerm) => {
    expandableKeys = expandableKeys.concat(findExpandableKeys(glossaryTerm));
  });

  return expandableKeys;
};

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
  if (!newTerm.parent) {
    return [...terms, newTerm as ModifiedGlossary];
  }

  return terms.map((term) => {
    if (term.fullyQualifiedName === newTerm.parent?.fullyQualifiedName) {
      const children = [...(term.children || []), newTerm] as GlossaryTerm[];

      return {
        ...term,
        children,
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
