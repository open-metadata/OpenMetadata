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

import type { AxiosError } from 'axios';
import type { Operation } from 'fast-json-patch';
import { isEqual, isUndefined } from 'lodash';
import type { Dispatch, SetStateAction } from 'react';
import Showdown from 'showdown';
import TurndownService from 'turndown';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import {
  EntityField,
  entityLinkRegEx,
  EntityRegEx,
  entityRegex,
  ENTITY_URL_MAP,
  hashtagRegEx,
  linkRegEx,
  mentionRegEx,
  teamsLinkRegEx,
} from '../constants/Feeds.constants';
import { EntityType, FqnPart, TabSpecificField } from '../enums/entity.enum';
import type {
  EntityTestResultSummaryObject,
  Thread,
} from '../generated/entity/feed/thread';
import { TestCaseStatus, ThreadType } from '../generated/entity/feed/thread';
import type { FeedCounts } from '../interface/feed.interface';
import {
  deletePostById,
  deleteThread,
  getEntityActivityByFqn,
  getFeedById,
  updatePost,
  updateThread,
} from '../rest/feedsAPI';
import { getTaskCounts } from '../rest/tasksAPI';
import { getRelativeCalendar } from './date-time/DateTimeUtils';
import EntityLink from './EntityLink';
import { ENTITY_LINK_SEPARATOR } from './EntityPureUtils';
import entityUtilClassBase from './EntityUtilClassBase';
import Fqn from './Fqn';
import { getPartialNameFromFQN, getPartialNameFromTableFQN } from './FqnUtils';
import { t } from './i18next/LocalUtil';
import { getSanitizeContent } from './sanitize.utils';
import { getDecodedFqn, getEncodedFqn } from './StringUtils';
import { showErrorToast } from './ToastUtils';

export const getEntityType = (entityLink: string) => {
  return EntityLink.getEntityType(entityLink);
};

export const getEntityFQN = (entityLink: string) => {
  return EntityLink.getEntityFqn(entityLink);
};

export const getEntityColumnFQN = (entityLink: string) => {
  return EntityLink.getEntityColumnFqn(entityLink);
};

export const getEntityField = (entityLink: string) => {
  const match = EntityRegEx.exec(entityLink);

  return match?.[3];
};

/**
 * Helper to check if about field is an EntityReference object (Task entity)
 * vs a string entity link (Thread entity).
 * Task entities have about as EntityReference: { id, type, fullyQualifiedName }
 * Thread entities have about as string: <#E::table::fqn>
 */
export const isEntityReferenceAbout = (
  about: string | { type?: string; fullyQualifiedName?: string } | undefined
): about is { type?: string; fullyQualifiedName?: string } => {
  return typeof about === 'object' && about !== null;
};

/**
 * Get entity type from about field, handling both Thread (string) and Task (EntityReference).
 * @param about - Either a string entity link or an EntityReference object
 * @returns The entity type
 */
export const getEntityTypeFromAbout = (
  about: string | { type?: string; fullyQualifiedName?: string } | undefined
): string | undefined => {
  if (!about) {
    return undefined;
  }
  if (isEntityReferenceAbout(about)) {
    return about.type;
  }

  return EntityLink.getEntityType(about);
};

/**
 * Get entity FQN from about field, handling both Thread (string) and Task (EntityReference).
 * @param about - Either a string entity link or an EntityReference object
 * @returns The entity fully qualified name
 */
export const getEntityFQNFromAbout = (
  about: string | { type?: string; fullyQualifiedName?: string } | undefined
): string | undefined => {
  if (!about) {
    return undefined;
  }
  if (isEntityReferenceAbout(about)) {
    return about.fullyQualifiedName;
  }

  return EntityLink.getEntityFqn(about);
};

export const getFeedListWithRelativeDays = (feedList: Thread[]) => {
  const updatedFeedList = feedList.map((feed) => ({
    ...feed,
    relativeDay: getRelativeCalendar(feed.updatedAt || 0),
  }));
  const relativeDays = [...new Set(updatedFeedList.map((f) => f.relativeDay))];

  return { updatedFeedList, relativeDays };
};

export const getReplyText = (
  count: number,
  singular?: string,
  plural?: string
) => {
  if (count === 0) {
    return t('label.reply-in-conversation');
  }
  if (count === 1) {
    return `${count} ${singular ?? t('label.older-reply-lowercase')}`;
  }

  return `${count} ${plural ?? t('label.older-reply-plural-lowercase')}`;
};

export const buildMentionLink = (entityType: string, entityFqn: string) => {
  if (entityType === EntityType.GLOSSARY_TERM) {
    return `${document.location.protocol}//${
      document.location.host
    }/glossary/${getEncodedFqn(entityFqn)}`;
  } else if (entityType === EntityType.TAG) {
    const classificationFqn = Fqn.split(entityFqn);

    return `${document.location.protocol}//${document.location.host}/tags/${classificationFqn[0]}`;
  } else if (entityType === EntityType.KNOWLEDGE_PAGE) {
    return `${document.location.protocol}//${
      document.location.host
    }/knowledge-center/${getEncodedFqn(entityFqn)}`;
  }

  return `${document.location.protocol}//${
    document.location.host
  }/${entityType}/${getEncodedFqn(entityFqn)}`;
};

export const getMentionList = (message: string) => {
  return message.match(mentionRegEx);
};

export const getHashTagList = (message: string) => {
  return message.match(hashtagRegEx);
};

export const getEntityDetail = (item: string) => {
  if (item.includes('teams')) {
    return item.match(teamsLinkRegEx);
  }

  return item.match(linkRegEx);
};

const getEntityLinkList = (message: string) => {
  return message?.match(entityLinkRegEx);
};

const getEntityLinkDetail = (item: string) => {
  return item.match(entityRegex);
};

export const getBackendFormat = (message: string) => {
  let updatedMessage = message;
  const mentionList = [...new Set(getMentionList(message) ?? [])];
  const hashtagList = [...new Set(getHashTagList(message) ?? [])];
  const mentionDetails = mentionList.map((m) => getEntityDetail(m) ?? []);
  const hashtagDetails = hashtagList.map((h) => getEntityDetail(h) ?? []);
  const urlEntries = Object.entries(ENTITY_URL_MAP);

  mentionList.forEach((m, i) => {
    const updatedDetails = mentionDetails[i].slice(-2);
    const entityType = urlEntries.find((e) => e[1] === updatedDetails[0])?.[0];
    const entityLink = `<#E${ENTITY_LINK_SEPARATOR}${entityType}${ENTITY_LINK_SEPARATOR}${getDecodedFqn(
      updatedDetails[1]
    )}|${m}>`;
    updatedMessage = updatedMessage.replaceAll(m, entityLink);
  });
  hashtagList.forEach((h, i) => {
    const updatedDetails = hashtagDetails[i].slice(-2);
    const entityLink = `<#E${ENTITY_LINK_SEPARATOR}${updatedDetails[0]}${ENTITY_LINK_SEPARATOR}${updatedDetails[1]}|${h}>`;
    updatedMessage = updatedMessage.replaceAll(h, entityLink);
  });

  return getSanitizeContent(updatedMessage);
};

export const getFrontEndFormat = (message: string) => {
  let updatedMessage = message;
  const entityLinkList = [...new Set(getEntityLinkList(message) ?? [])];
  const entityLinkDetails = entityLinkList.map(
    (m) => getEntityLinkDetail(m) ?? []
  );
  entityLinkList.forEach((m, i) => {
    let markdownLink = entityLinkDetails[i]?.[3];
    const entityType = entityLinkDetails[i]?.[1];
    const entityFqn = entityLinkDetails[i]?.[2];
    const linkText = entityLinkDetails[i]?.[4];
    const entityUrl = entityLinkDetails[i]?.[5];

    if (entityType && entityFqn && entityUrl) {
      const decodedUrl = getDecodedFqn(entityUrl);

      markdownLink = `[${linkText}](${decodedUrl})`;
    }

    updatedMessage = updatedMessage.replaceAll(m, markdownLink);
  });

  return getSanitizeContent(updatedMessage);
};

export const entityDisplayName = (entityType: string, entityFQN: string) => {
  let displayName;

  switch (entityType) {
    case EntityType.TABLE:
      displayName = getPartialNameFromTableFQN(
        entityFQN,
        [FqnPart.Database, FqnPart.Schema, FqnPart.Table],
        FQN_SEPARATOR_CHAR
      );

      break;

    case EntityType.TEST_CASE:
    case EntityType.TEST_SUITE:
      displayName = getPartialNameFromTableFQN(
        entityFQN,
        [FqnPart.TestCase],
        FQN_SEPARATOR_CHAR
      );

      break;

    case EntityType.DATABASE_SCHEMA:
      displayName = getPartialNameFromTableFQN(entityFQN, [FqnPart.Schema]);

      break;

    case EntityType.DATABASE_SERVICE:
    case EntityType.DASHBOARD_SERVICE:
    case EntityType.MESSAGING_SERVICE:
    case EntityType.PIPELINE_SERVICE:
    case EntityType.MLMODEL_SERVICE:
    case EntityType.METADATA_SERVICE:
    case EntityType.STORAGE_SERVICE:
    case EntityType.SEARCH_SERVICE:
    case EntityType.API_SERVICE:
    case EntityType.TYPE:
      displayName = getPartialNameFromFQN(entityFQN, ['service']);

      break;

    case EntityType.GLOSSARY:
    case EntityType.GLOSSARY_TERM:
    case EntityType.DOMAIN:
      displayName = entityFQN.split(FQN_SEPARATOR_CHAR).pop();

      break;
    default:
      displayName = getPartialNameFromFQN(entityFQN, ['database']) || entityFQN;

      break;
  }

  // Remove quotes if the name is wrapped in quotes
  if (displayName) {
    displayName = displayName.replaceAll(/(?:^"+)|(?:"+$)/g, '');
  }

  return displayName;
};

export const getFeedPanelHeaderText = (
  threadType: ThreadType = ThreadType.Conversation
) => {
  switch (threadType) {
    case ThreadType.Announcement:
      return t('label.announcement');
    case ThreadType.Task:
      return t('label.task');
    case ThreadType.Conversation:
    default:
      return t('label.conversation');
  }
};

export const getFeedChangeFieldLabel = (fieldName?: EntityField) => {
  const fieldNameLabelMapping = {
    [EntityField.DESCRIPTION]: t('label.description'),
    [EntityField.COLUMNS]: t('label.column-plural'),
    [EntityField.SCHEMA_FIELDS]: t('label.schema-field-plural'),
    [EntityField.TAGS]: t('label.tag-plural'),
    [EntityField.TASKS]: t('label.task-plural'),
    [EntityField.ML_FEATURES]: t('label.ml-feature-plural'),
    [EntityField.SCHEMA_TEXT]: t('label.schema-text'),
    [EntityField.OWNER]: t('label.owner-plural'),
    [EntityField.REVIEWERS]: t('label.reviewer-plural'),
    [EntityField.SYNONYMS]: t('label.synonym-plural'),
    [EntityField.RELATEDTERMS]: t('label.related-term-plural'),
    [EntityField.REFERENCES]: t('label.reference-plural'),
    [EntityField.EXTENSION]: t('label.extension'),
    [EntityField.DISPLAYNAME]: t('label.display-name'),
    [EntityField.NAME]: t('label.name'),
    [EntityField.MESSAGE_SCHEMA]: t('label.message-schema'),
    [EntityField.CHARTS]: t('label.chart-plural'),
    [EntityField.DATA_MODEL]: t('label.data-model'),
    [EntityField.CONSTRAINT]: t('label.constraint'),
    [EntityField.TABLE_CONSTRAINTS]: t('label.table-constraint-plural'),
    [EntityField.PARTITIONS]: t('label.partition-plural'),
    [EntityField.REPLICATION_FACTOR]: t('label.replication-factor'),
    [EntityField.SOURCE_URL]: t('label.source-url'),
    [EntityField.MUTUALLY_EXCLUSIVE]: t('label.mutually-exclusive'),
    [EntityField.EXPERTS]: t('label.expert-plural'),
    [EntityField.FIELDS]: t('label.field-plural'),
    [EntityField.PARAMETER_VALUES]: t('label.parameter-plural'),
    [EntityField.DATA_TYPE_DISPLAY]: t('label.data-type-display'),
  };

  return isUndefined(fieldName) ? '' : fieldNameLabelMapping[fieldName];
};

export const getTestCaseNameListForResult = (
  testResultSummary: Array<EntityTestResultSummaryObject>,
  status: TestCaseStatus
) =>
  testResultSummary.reduce((acc, curr) => {
    if (curr.status === status) {
      acc.push(curr.testCaseName ?? '');
    }

    return acc;
  }, [] as Array<string>);

export const formatTestStatusData = (
  testResultSummary: Array<EntityTestResultSummaryObject>
) => {
  const successCases = getTestCaseNameListForResult(
    testResultSummary,
    TestCaseStatus.Success
  );
  const failedCases = getTestCaseNameListForResult(
    testResultSummary,
    TestCaseStatus.Failed
  );
  const abortedCases = getTestCaseNameListForResult(
    testResultSummary,
    TestCaseStatus.Aborted
  );

  return {
    success: {
      status: TestCaseStatus.Success,
      count: successCases.length,
      testCases: successCases,
    },
    failed: {
      status: TestCaseStatus.Failed,
      count: failedCases.length,
      testCases: failedCases,
    },
    aborted: {
      status: TestCaseStatus.Aborted,
      count: abortedCases.length,
      testCases: abortedCases,
    },
  };
};

export const HTMLToMarkdown = new TurndownService({
  bulletListMarker: '-',
  fence: '```',
  codeBlockStyle: 'fenced',
})
  .addRule('codeblock', {
    filter: ['pre'],
    replacement: function (content: string) {
      return '```\n' + content + '\n```';
    },
  })
  .addRule('strikethrough', {
    filter: ['del', 's'],
    replacement: function (content: string) {
      return '~~' + content + '~~';
    },
  });

export const MarkdownToHTMLConverter = new Showdown.Converter({
  strikethrough: true,
  tables: true,
  tasklists: true,
  simpleLineBreaks: true,
});

export const getUpdatedThread = (id: string) => {
  return new Promise<Thread>((resolve, reject) => {
    getFeedById(id)
      .then((res) => {
        if (res.status === 200) {
          resolve(res.data);
        } else {
          reject(res.data);
        }
      })
      .catch((error: AxiosError) => {
        reject(error);
      });
  });
};

export const deletePost = async (
  threadId: string,
  postId: string,
  isThread: boolean,
  callback?: (value: SetStateAction<Thread[]>) => void
) => {
  if (isThread) {
    try {
      const data = await deleteThread(threadId);
      callback?.((prev) => prev.filter((thread) => thread.id !== data.id));
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  } else {
    try {
      const deleteResponse = await deletePostById(threadId, postId);
      if (deleteResponse && callback) {
        const data = await getUpdatedThread(threadId);
        callback((pre) => {
          return pre.map((thread) => {
            if (thread.id === data.id) {
              return {
                ...thread,
                posts: data.posts && data.posts.slice(-3),
                postsCount: data.postsCount,
              };
            } else {
              return thread;
            }
          });
        });
      } else {
        throw t('server.fetch-updated-conversation-error');
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }
};

export const updateThreadData = async (
  threadId: string,
  postId: string,
  isThread: boolean,
  data: Operation[],
  callback: (value: SetStateAction<Thread[]>) => void
): Promise<void> => {
  if (isThread) {
    try {
      const res = await updateThread(threadId, data);
      callback((prevData) => {
        return prevData.map((thread) => {
          if (isEqual(threadId, thread.id)) {
            return {
              ...thread,
              reactions: res.reactions,
              message: res.message,
              announcement: res?.announcement,
            };
          } else {
            return thread;
          }
        });
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  } else {
    try {
      const res = await updatePost(threadId, postId, data);
      callback((prevData) => {
        return prevData.map((thread) => {
          if (isEqual(threadId, thread.id)) {
            const updatedPosts = (thread.posts || []).map((post) => {
              if (isEqual(postId, post.id)) {
                return {
                  ...post,
                  reactions: res.reactions,
                  message: res.message,
                };
              } else {
                return post;
              }
            });

            return { ...thread, posts: updatedPosts };
          } else {
            return thread;
          }
        });
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }
};

export const prepareFeedLink = (
  entityType: string,
  entityFQN: string,
  subTab?: string
) => {
  const withoutFeedEntities = [
    EntityType.WEBHOOK,
    EntityType.TYPE,
    EntityType.KNOWLEDGE_PAGE,
  ];

  const entityLink = entityUtilClassBase.getEntityLink(entityType, entityFQN);

  if (withoutFeedEntities.includes(entityType as EntityType)) {
    return entityLink;
  } else {
    const activityFeedLink = `${entityLink}/${TabSpecificField.ACTIVITY_FEED}`;

    return subTab ? `${activityFeedLink}/${subTab}` : activityFeedLink;
  }
};

export const getFeedCounts = async (
  entityType: string,
  entityFQN: string,
  domainOrCallback: string | undefined | ((countValue: FeedCounts) => void),
  callback?: (countValue: FeedCounts) => void
) => {
  try {
    const domain =
      typeof domainOrCallback === 'string' || domainOrCallback === undefined
        ? domainOrCallback
        : undefined;
    const feedCountCallback =
      typeof domainOrCallback === 'function' ? domainOrCallback : callback;

    if (!feedCountCallback) {
      return;
    }

    const [activityRes, taskCounts] = await Promise.all([
      getEntityActivityByFqn(entityType, entityFQN, {
        days: 30,
        limit: 100,
        domain,
      }),
      getTaskCounts({ aboutEntity: entityFQN, domain }),
    ]);

    const activityCount = activityRes?.data?.length ?? 0;

    const openTaskCount = taskCounts.open ?? 0;
    const closedTaskCount = taskCounts.completed ?? 0;
    const totalTasksCount = taskCounts.total ?? 0;

    feedCountCallback({
      conversationCount: activityCount,
      totalTasksCount,
      openTaskCount,
      closedTaskCount,
      totalCount: activityCount + totalTasksCount,
      mentionCount: 0,
    });
  } catch (err) {
    showErrorToast(err as AxiosError, t('server.entity-feed-fetch-error'));
  }
};

export const fetchEntityTaskCountsInto = async (
  entityFqn: string,
  setFeedCount: Dispatch<SetStateAction<FeedCounts>>,
  domain?: string
) => {
  try {
    const taskCounts = await getTaskCounts({ aboutEntity: entityFqn, domain });
    setFeedCount((prev) => {
      const openTaskCount = taskCounts.open ?? 0;
      const closedTaskCount = taskCounts.completed ?? 0;
      const totalTasksCount = taskCounts.total ?? 0;

      return {
        ...prev,
        openTaskCount,
        closedTaskCount,
        totalTasksCount,
        totalCount: (prev.conversationCount ?? 0) + totalTasksCount,
      };
    });
  } catch (err) {
    showErrorToast(err as AxiosError, t('server.entity-feed-fetch-error'));
  }
};

export const fetchEntityActivityCountInto = async (
  entityType: string,
  entityFqn: string,
  setFeedCount: Dispatch<SetStateAction<FeedCounts>>,
  domain?: string
) => {
  try {
    const activityRes = await getEntityActivityByFqn(entityType, entityFqn, {
      days: 30,
      limit: 0,
      domain,
    });
    setFeedCount((prev) => {
      const conversationCount = activityRes?.paging?.total ?? 0;

      return {
        ...prev,
        conversationCount,
        totalCount: conversationCount + (prev.totalTasksCount ?? 0),
      };
    });
  } catch (err) {
    showErrorToast(err as AxiosError, t('server.entity-feed-fetch-error'));
  }
};
