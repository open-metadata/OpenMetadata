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

import { useQuery } from '@tanstack/react-query';
import { EntityType } from '../../../../enums/entity.enum';
import { LineageDirection } from '../../../../generated/api/lineage/lineageDirection';
import { Task } from '../../../../generated/entity/tasks/task';
import { TestCase } from '../../../../generated/tests/testCase';
import { getLineageByEntityCount } from '../../../../rest/lineageAPI';
import { getEntityByFqnUtil } from '../../../../utils/EntityByFqnUtils';
import EntityLink from '../../../../utils/EntityLink';
import { EntityUnion } from '../../../Explore/ExplorePage.interface';
import { TaskAboutEntity } from './taskDetail.types';
import {
  deriveTaskAboutEntity,
  resolveIncidentTestCaseFqn,
} from './taskDetail.utils';

export const TASK_ABOUT_ENTITY_QUERY_KEY = 'inbox-task-about-entity';
const ABOUT_STALE_TIME = 60_000;

// Owners come back for every entity type. Tags — and so the tier badge — only
// for the types whose fetch handler honours the requested fields: several
// (database, database schema, glossary term, domain, container) hardcode owners
// and drop the rest, so those assets simply render no tier. Columns and usage
// exist only on tables, and asking another handler for them can 400.
const COMMON_FIELDS = 'tags,owners';
const TABLE_FIELDS = 'tags,owners,columns,usageSummary';

interface TaskAboutTarget {
  fqn: string;
  entityType: string;
}

// An incident often names no `about`; its failing test case is then read off the
// description, which is still enough to show what failed and against what.
const getAboutTarget = (task?: Task): TaskAboutTarget | undefined => {
  const fqn = task?.about?.fullyQualifiedName;
  const entityType = task?.about?.type;
  if (fqn && entityType) {
    return { fqn, entityType };
  }
  const testCaseFqn = task ? resolveIncidentTestCaseFqn(task) : '';

  return testCaseFqn.includes('.')
    ? { fqn: testCaseFqn, entityType: EntityType.TEST_CASE }
    : undefined;
};

/** The test case's own context: what it tests, and against which table. */
const fetchTestCaseContext = async (fqn: string): Promise<TaskAboutEntity> => {
  const testCase = (await getEntityByFqnUtil(
    EntityType.TEST_CASE,
    fqn
  )) as TestCase | null;

  return {
    ...deriveTaskAboutEntity(testCase ?? undefined),
    testCase: testCase ?? undefined,
    testCaseTableFqn: testCase?.entityLink
      ? EntityLink.getEntityFqn(testCase.entityLink)
      : undefined,
  };
};

const fetchDownstreamCount = async ({
  fqn,
  entityType,
}: TaskAboutTarget): Promise<number | undefined> => {
  const response = await getLineageByEntityCount({
    fqn,
    entityType: entityType as EntityType,
    direction: LineageDirection.Downstream,
    nodeDepth: 1,
    from: 0,
    // Only the count is wanted; one node keeps the payload small.
    size: 1,
    include_pagination_info: true,
  });

  return response.paginationInfo?.totalDownstreamEntities;
};

export interface UseTaskAboutEntityResult {
  about?: TaskAboutEntity;
  isLoading: boolean;
}

/**
 * The about-entity context behind the detail pane's asset card: the entity
 * itself plus its downstream count, fetched in parallel and folded into the
 * shape the stat tiles read.
 *
 * Both legs are allowed to fail independently — a type with no fetch handler, a
 * lineage service that is unavailable, or an asset the viewer cannot read each
 * drop their own tiles rather than failing the pane. Called once by the panel
 * and passed down, so the card and its tiles never fetch for themselves.
 */
export const useTaskAboutEntity = (task?: Task): UseTaskAboutEntityResult => {
  const target = getAboutTarget(task);

  const { data, isFetching } = useQuery({
    queryKey: [TASK_ABOUT_ENTITY_QUERY_KEY, target?.entityType, target?.fqn],
    enabled: Boolean(target),
    staleTime: ABOUT_STALE_TIME,
    queryFn: async () => {
      const { fqn, entityType } = target as TaskAboutTarget;
      // A test case has no lineage of its own; its tiles describe the test.
      if (entityType === EntityType.TEST_CASE) {
        return fetchTestCaseContext(fqn);
      }
      const fields =
        entityType === EntityType.TABLE ? TABLE_FIELDS : COMMON_FIELDS;
      const [entity, downstream] = await Promise.allSettled([
        getEntityByFqnUtil(entityType, fqn, fields) ??
          Promise.resolve<EntityUnion | undefined>(undefined),
        fetchDownstreamCount({ fqn, entityType }),
      ]);

      return deriveTaskAboutEntity(
        entity.status === 'fulfilled' ? entity.value : undefined,
        downstream.status === 'fulfilled' ? downstream.value : undefined
      );
    },
  });

  return { about: data, isLoading: Boolean(target) && isFetching };
};
