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

import { ActivityFeedTabs } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import {
  PLACEHOLDER_ROUTE_ENTITY_TYPE,
  PLACEHOLDER_ROUTE_FQN,
  ROUTES,
} from '../constants/constants';
import { EntityTabs, EntityType } from '../enums/entity.enum';
import type { Thread } from '../generated/entity/feed/thread';
import { TestCasePageTabs } from '../pages/IncidentManager/IncidentManager.interface';
import { TaskEntityStatus, type Task as TaskEntity } from '../rest/tasksAPI';
import { getEntityFQNFromAbout, getEntityTypeFromAbout } from './FeedUtilsPure';
import {
  getEntityDetailsPath,
  getGlossaryTermDetailsPath,
  getTestCaseDetailPagePath,
  getUserPath,
} from './RouterUtils';
import { getEncodedFqn } from './StringUtils';

export const TASK_ENTITIES = [
  EntityType.TABLE,
  EntityType.DASHBOARD,
  EntityType.TOPIC,
  EntityType.PIPELINE,
  EntityType.MLMODEL,
  EntityType.CONTAINER,
  EntityType.DATABASE,
  EntityType.DATABASE_SCHEMA,
  EntityType.DASHBOARD_DATA_MODEL,
  EntityType.STORED_PROCEDURE,
  EntityType.SEARCH_INDEX,
  EntityType.GLOSSARY,
  EntityType.GLOSSARY_TERM,
  EntityType.API_COLLECTION,
  EntityType.API_ENDPOINT,
  EntityType.METRIC,
  EntityType.DATA_PRODUCT,
];

export const getKnowledgeCenterPagePath = (
  pageFQN: string,
  tab: string,
  subTab: string
) => {
  const encodedFqn = getEncodedFqn(pageFQN);

  return `${ROUTES.KNOWLEDGE_CENTER_PAGE}/${encodedFqn}/${tab}/${subTab}`;
};

export const getTaskDetailPath = (task: Thread) => {
  const entityFqn = getEntityFQNFromAbout(task.about) ?? '';
  const entityType = getEntityTypeFromAbout(task.about) ?? '';

  if (entityType === EntityType.TEST_CASE) {
    return getTestCaseDetailPagePath(entityFqn, TestCasePageTabs.ISSUES);
  } else if (entityType === EntityType.USER) {
    return getUserPath(
      entityFqn,
      EntityTabs.ACTIVITY_FEED,
      ActivityFeedTabs.TASKS
    );
  } else if (
    [EntityType.GLOSSARY, EntityType.GLOSSARY_TERM].includes(
      entityType as EntityType
    )
  ) {
    return getGlossaryTermDetailsPath(
      entityFqn,
      EntityTabs.ACTIVITY_FEED,
      ActivityFeedTabs.TASKS
    );
  } else if (entityType === EntityType.KNOWLEDGE_PAGE) {
    return getKnowledgeCenterPagePath(
      entityFqn,
      EntityTabs.ACTIVITY_FEED,
      ActivityFeedTabs.TASKS
    );
  }

  return getEntityDetailsPath(
    entityType as EntityType,
    entityFqn,
    EntityTabs.ACTIVITY_FEED,
    ActivityFeedTabs.TASKS
  );
};

export const getTaskDetailPathFromTask = (task: TaskEntity) => {
  const entityFqn = task.about?.fullyQualifiedName ?? '';
  const entityType = (task.about?.type as EntityType) ?? '';

  if (entityType === EntityType.TEST_CASE) {
    return getTestCaseDetailPagePath(entityFqn, TestCasePageTabs.ISSUES);
  } else if (entityType === EntityType.USER) {
    return getUserPath(
      entityFqn,
      EntityTabs.ACTIVITY_FEED,
      ActivityFeedTabs.TASKS
    );
  } else if (
    [EntityType.GLOSSARY, EntityType.GLOSSARY_TERM].includes(entityType)
  ) {
    return getGlossaryTermDetailsPath(
      entityFqn,
      EntityTabs.ACTIVITY_FEED,
      ActivityFeedTabs.TASKS
    );
  } else if (entityType === EntityType.KNOWLEDGE_PAGE) {
    return getKnowledgeCenterPagePath(
      entityFqn,
      EntityTabs.ACTIVITY_FEED,
      ActivityFeedTabs.TASKS
    );
  }

  return getEntityDetailsPath(
    entityType as EntityType,
    entityFqn,
    EntityTabs.ACTIVITY_FEED,
    ActivityFeedTabs.TASKS
  );
};

export const getTaskDisplayId = (taskId?: string) => {
  if (!taskId) {
    return '';
  }

  const matchedTaskId = /^TASK-0*([0-9]+)$/.exec(taskId);

  return matchedTaskId?.[1] ?? taskId;
};

export const isTaskTerminalStatus = (status?: TaskEntityStatus) =>
  [
    TaskEntityStatus.Approved,
    TaskEntityStatus.Rejected,
    TaskEntityStatus.Completed,
    TaskEntityStatus.Cancelled,
    TaskEntityStatus.Failed,
  ].includes(status as TaskEntityStatus);

export const isTaskPendingFurtherApproval = (task?: TaskEntity) =>
  Boolean(task) && !isTaskTerminalStatus(task?.status);

export const getRequestDescriptionPath = (
  entityType: string,
  entityFqn: string,
  field?: string,
  value?: string
) => {
  let pathname = ROUTES.REQUEST_DESCRIPTION;
  pathname = pathname
    .replace(PLACEHOLDER_ROUTE_ENTITY_TYPE, entityType)
    .replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(entityFqn));
  const searchParams = new URLSearchParams();

  if (field !== undefined && value !== undefined) {
    searchParams.append('field', field);
    searchParams.append('value', value);
  }

  return { pathname, search: searchParams.toString() };
};

export const getRequestTagsPath = (
  entityType: string,
  entityFqn: string,
  field?: string,
  value?: string
) => {
  let pathname = ROUTES.REQUEST_TAGS;
  pathname = pathname
    .replace(PLACEHOLDER_ROUTE_ENTITY_TYPE, entityType)
    .replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(entityFqn));
  const searchParams = new URLSearchParams();

  if (field !== undefined && value !== undefined) {
    searchParams.append('field', field);
    searchParams.append('value', value);
  }

  return { pathname, search: searchParams.toString() };
};

export const getUpdateDescriptionPath = (
  entityType: string,
  entityFqn: string,
  field?: string,
  value?: string
) => {
  let pathname = ROUTES.UPDATE_DESCRIPTION;
  pathname = pathname
    .replace(PLACEHOLDER_ROUTE_ENTITY_TYPE, entityType)
    .replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(entityFqn));
  const searchParams = new URLSearchParams();

  if (field !== undefined && value !== undefined) {
    searchParams.append('field', field);
    searchParams.append('value', value);
  }

  return { pathname, search: searchParams.toString() };
};

export const getUpdateTagsPath = (
  entityType: string,
  entityFqn: string,
  field?: string,
  value?: string
) => {
  let pathname = ROUTES.UPDATE_TAGS;
  pathname = pathname
    .replace(PLACEHOLDER_ROUTE_ENTITY_TYPE, entityType)
    .replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(entityFqn));
  const searchParams = new URLSearchParams();

  if (field !== undefined && value !== undefined) {
    searchParams.append('field', field);
    searchParams.append('value', value);
  }

  return { pathname, search: searchParams.toString() };
};
