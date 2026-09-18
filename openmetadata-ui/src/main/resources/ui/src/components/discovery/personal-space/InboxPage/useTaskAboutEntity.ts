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
import { getLineageByEntityCount } from '../../../../rest/lineageAPI';
import { getEntityByFqnUtil } from '../../../../utils/EntityByFqnUtils';
import { EntityUnion } from '../../../Explore/ExplorePage.interface';
import { TaskAboutEntity } from './taskDetail.types';
import { deriveTaskAboutEntity } from './taskDetail.utils';

export const TASK_ABOUT_ENTITY_QUERY_KEY = 'inbox-task-about-entity';
const ABOUT_STALE_TIME = 60_000;

// Tier and owners come back for every entity type; columns and usage only exist
// on tables, and asking an entity handler for a field it does not know can 400.
const COMMON_FIELDS = 'tags,owners';
const TABLE_FIELDS = 'tags,owners,columns,usageSummary';

interface TaskAboutTarget {
  fqn: string;
  entityType: string;
}

const getAboutTarget = (task?: Task): TaskAboutTarget | undefined => {
  const fqn = task?.about?.fullyQualifiedName;
  const entityType = task?.about?.type;

  return fqn && entityType ? { fqn, entityType } : undefined;
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
