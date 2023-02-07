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
import { Operation } from 'fast-json-patch';
import i18next from 'i18next';
import { isEqual } from 'lodash';
import {
  deletePostById,
  deleteThread,
  getFeedById,
  updatePost,
  updateThread,
} from 'rest/feedsAPI';
import {
  getSearchedUsers,
  getSuggestions,
  getUserSuggestions,
  searchData,
} from 'rest/miscAPI';

import { RightOutlined } from '@ant-design/icons';
import React from 'react';
import Showdown from 'showdown';
import TurndownService from 'turndown';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import {
  entityLinkRegEx,
  EntityRegEx,
  entityRegex,
  entityUrlMap,
  hashtagRegEx,
  linkRegEx,
  mentionRegEx,
  teamsLinkRegEx,
} from '../constants/Feeds.constants';
import { EntityType, FqnPart, TabSpecificField } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { Thread, ThreadType } from '../generated/entity/feed/thread';
import {
  EntityFieldThreadCount,
  EntityFieldThreads,
  EntityThreadField,
} from '../interface/feed.interface';
import jsonData from '../jsons/en';
import {
  getEntityPlaceHolder,
  getPartialNameFromFQN,
  getPartialNameFromTableFQN,
} from './CommonUtils';
import { ENTITY_LINK_SEPARATOR } from './EntityUtils';
import { getEncodedFqn } from './StringsUtils';
import { getEntityLink } from './TableUtils';
import { getRelativeDateByTimeStamp } from './TimeUtils';
import { showErrorToast } from './ToastUtils';

export const getEntityType = (entityLink: string) => {
  const match = EntityRegEx.exec(entityLink);

  return match?.[1];
};
export const getEntityFQN = (entityLink: string) => {
  const match = EntityRegEx.exec(entityLink);

  return match?.[2];
};
export const getEntityField = (entityLink: string) => {
  const match = EntityRegEx.exec(entityLink);

  return match?.[3];
};

export const getFeedListWithRelativeDays = (feedList: Thread[]) => {
  const updatedFeedList = feedList.map((feed) => ({
    ...feed,
    relativeDay: getRelativeDateByTimeStamp(feed.updatedAt || 0),
  }));
  const relativeDays = [...new Set(updatedFeedList.map((f) => f.relativeDay))];

  return { updatedFeedList, relativeDays };
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

export const getReplyText = (
  count: number,
  singular?: string,
  plural?: string
) => {
  if (count === 0) {
    return i18next.t('label.reply-in-conversation');
  }
  if (count === 1) {
    return `${count} ${
      singular ? singular : i18next.t('label.older-reply-lowercase')
    }`;
  }

  return `${count} ${
    plural ? plural : i18next.t('label.older-reply-plural-lowercase')
  }`;
};

export const getEntityFieldThreadCounts = (
  field: EntityThreadField,
  entityFieldThreadCount: EntityFieldThreadCount[]
) => {
  const entityFieldThreads: EntityFieldThreads[] = [];

  entityFieldThreadCount.map((fieldCount) => {
    const entityField = getEntityField(fieldCount.entityLink);
    if (entityField?.startsWith(field)) {
      entityFieldThreads.push({
        entityLink: fieldCount.entityLink,
        count: fieldCount.count,
        entityField,
      });
    }
  });

  return entityFieldThreads;
};

export const getThreadField = (
  value: string,
  separator = ENTITY_LINK_SEPARATOR
) => {
  return value.split(separator).slice(-2);
};

export const getThreadValue = (
  columnName: string,
  columnField: string,
  entityFieldThreads: EntityFieldThreads[]
) => {
  let threadValue;

  entityFieldThreads?.forEach((thread) => {
    const threadField = getThreadField(thread.entityField);
    if (threadField[0] === columnName && threadField[1] === columnField) {
      threadValue = thread;
    }
  });

  return threadValue;
};

export const buildMentionLink = (entityType: string, entityFqn: string) => {
  return `${document.location.protocol}//${document.location.host}/${entityType}/${entityFqn}`;
};

export async function suggestions(searchTerm: string, mentionChar: string) {
  if (mentionChar === '@') {
    let atValues = [];
    if (!searchTerm) {
      const data = await getSearchedUsers('*', 0, 5);
      const hits = data.data.hits.hits;

      atValues = hits.map((hit) => {
        const entityType = hit._source.entityType;

        return {
          id: hit._id,
          value: getEntityPlaceHolder(
            `@${hit._source.name ?? hit._source.displayName}`,
            hit._source.deleted
          ),
          link: buildMentionLink(
            entityUrlMap[entityType as keyof typeof entityUrlMap],
            hit._source.name
          ),
        };
      });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await getUserSuggestions(searchTerm);
      const hits = data.data.suggest['metadata-suggest'][0]['options'];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      atValues = hits.map((hit: any) => {
        const entityType = hit._source.entityType;

        return {
          id: hit._id,
          value: getEntityPlaceHolder(
            `@${hit._source.name ?? hit._source.display_name}`,
            hit._source.deleted
          ),
          link: buildMentionLink(
            entityUrlMap[entityType as keyof typeof entityUrlMap],
            hit._source.name
          ),
        };
      });
    }

    return atValues;
  } else {
    let hashValues = [];
    if (!searchTerm) {
      const data = await searchData('*', 0, 5, '', '', '', SearchIndex.TABLE);
      const hits = data.data.hits.hits;

      hashValues = hits.map((hit) => {
        const entityType = hit._source.entityType;

        return {
          id: hit._id,
          value: `#${entityType}/${hit._source.name}`,
          link: buildMentionLink(
            entityType,
            getEncodedFqn(hit._source.fullyQualifiedName ?? '')
          ),
        };
      });
    } else {
      const data = await getSuggestions(searchTerm);
      const hits = data.data.suggest['metadata-suggest'][0]['options'];

      hashValues = hits.map((hit) => {
        const entityType = hit._source.entityType;

        return {
          id: hit._id,
          value: `#${entityType}/${hit._source.name}`,
          link: buildMentionLink(
            entityType,
            getEncodedFqn(hit._source.fullyQualifiedName ?? '')
          ),
        };
      });
    }

    return hashValues;
  }
}

export async function matcher(
  searchTerm: string,
  renderList: (matches: string[], search: string) => void,
  mentionChar: string
) {
  const matches = await suggestions(searchTerm, mentionChar);
  renderList(matches, searchTerm);
}

const getMentionList = (message: string) => {
  return message.match(mentionRegEx);
};

const getHashTagList = (message: string) => {
  return message.match(hashtagRegEx);
};

const getEntityDetail = (item: string) => {
  if (item.includes('teams')) {
    return item.match(teamsLinkRegEx);
  }

  return item.match(linkRegEx);
};

const getEntityLinkList = (message: string) => {
  return message.match(entityLinkRegEx);
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
  const urlEntries = Object.entries(entityUrlMap);

  mentionList.forEach((m, i) => {
    const updatedDetails = mentionDetails[i].slice(-2);
    const entityType = urlEntries.find((e) => e[1] === updatedDetails[0])?.[0];
    const entityLink = `<#E${ENTITY_LINK_SEPARATOR}${entityType}${ENTITY_LINK_SEPARATOR}${updatedDetails[1]}|${m}>`;
    updatedMessage = updatedMessage.replaceAll(m, entityLink);
  });
  hashtagList.forEach((h, i) => {
    const updatedDetails = hashtagDetails[i].slice(-2);
    const entityLink = `<#E${ENTITY_LINK_SEPARATOR}${updatedDetails[0]}${ENTITY_LINK_SEPARATOR}${updatedDetails[1]}|${h}>`;
    updatedMessage = updatedMessage.replaceAll(h, entityLink);
  });

  return updatedMessage;
};

export const getFrontEndFormat = (message: string) => {
  let updatedMessage = message;
  const entityLinkList = [...new Set(getEntityLinkList(message) ?? [])];
  const entityLinkDetails = entityLinkList.map(
    (m) => getEntityLinkDetail(m) ?? []
  );
  entityLinkList.forEach((m, i) => {
    const markdownLink = entityLinkDetails[i][3];
    updatedMessage = updatedMessage.replaceAll(m, markdownLink);
  });

  return updatedMessage;
};

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

/**
 *
 * @param threadId thread to be deleted
 * @param postId post to be deleted
 * @param isThread boolean, if true delete the thread else post
 * @param callback optional callback function to get the updated threads
 */
export const deletePost = async (
  threadId: string,
  postId: string,
  isThread: boolean,
  callback?: (value: React.SetStateAction<Thread[]>) => void
) => {
  /**
   * Delete the thread if isThread is true
   */
  if (isThread) {
    try {
      const data = await deleteThread(threadId);
      callback &&
        callback((prev) => prev.filter((thread) => thread.id !== data.id));
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  } else {
    try {
      const deletResponse = await deletePostById(threadId, postId);
      // get updated thread only if delete response and callback is present
      if (deletResponse && callback) {
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
        throw jsonData['api-error-messages'][
          'fetch-updated-conversation-error'
        ];
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }
};

/**
 * if entity field is columns::name::description
 * return columns > name > description
 */
export const getEntityFieldDisplay = (entityField: string) => {
  if (entityField && entityField.length) {
    const entityFields = entityField.split(ENTITY_LINK_SEPARATOR);
    const separator = (
      <span className="tw-px-1">
        <RightOutlined className="tw-text-xs tw-cursor-default tw-text-gray-400 tw-align-middle" />
      </span>
    );

    return entityFields.map((field, i) => {
      return (
        <span className="tw-font-bold" key={`field-${i}`}>
          {field}
          {i < entityFields.length - 1 ? separator : null}
        </span>
      );
    });
  }

  return null;
};

export const updateThreadData = (
  threadId: string,
  postId: string,
  isThread: boolean,
  data: Operation[],
  callback: (value: React.SetStateAction<Thread[]>) => void
) => {
  if (isThread) {
    updateThread(threadId, data)
      .then((res) => {
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
      })
      .catch((err: AxiosError) => {
        showErrorToast(err);
      });
  } else {
    updatePost(threadId, postId, data)
      .then((res) => {
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
      })
      .catch((err: AxiosError) => {
        showErrorToast(err);
      });
  }
};

export const getFeedAction = (type: ThreadType) => {
  if (type === ThreadType.Task) {
    return i18next.t('label.created-a-task-lowercase');
  }

  return i18next.t('label.posted-on-lowercase');
};

export const prepareFeedLink = (entityType: string, entityFQN: string) => {
  const withoutFeedEntities = [
    EntityType.WEBHOOK,
    EntityType.GLOSSARY,
    EntityType.GLOSSARY_TERM,
    EntityType.TYPE,
    EntityType.MLMODEL,
  ];

  const entityLink = getEntityLink(entityType, entityFQN);

  if (!withoutFeedEntities.includes(entityType as EntityType)) {
    return `${entityLink}/${TabSpecificField.ACTIVITY_FEED}`;
  } else {
    return entityLink;
  }
};

export const entityDisplayName = (entityType: string, entityFQN: string) => {
  let displayName;
  if (entityType === EntityType.TABLE) {
    displayName = getPartialNameFromTableFQN(
      entityFQN,
      [FqnPart.Database, FqnPart.Schema, FqnPart.Table],
      '.'
    );
  } else if (entityType === EntityType.DATABASE_SCHEMA) {
    displayName = getPartialNameFromTableFQN(entityFQN, [FqnPart.Schema]);
  } else if (
    [
      EntityType.DATABASE_SERVICE,
      EntityType.DASHBOARD_SERVICE,
      EntityType.MESSAGING_SERVICE,
      EntityType.PIPELINE_SERVICE,
      EntityType.TYPE,
      EntityType.MLMODEL,
    ].includes(entityType as EntityType)
  ) {
    displayName = getPartialNameFromFQN(entityFQN, ['service']);
  } else if (
    [EntityType.GLOSSARY, EntityType.GLOSSARY_TERM].includes(
      entityType as EntityType
    )
  ) {
    displayName = entityFQN.split(FQN_SEPARATOR_CHAR).pop();
  } else {
    displayName = getPartialNameFromFQN(entityFQN, ['database']);
  }

  // Remove quotes if the name is wrapped in quotes
  if (displayName) {
    displayName = displayName.replace(/(?:^"+)|(?:"+$)/g, '');
  }

  return displayName;
};

export const MarkdownToHTMLConverter = new Showdown.Converter({
  strikethrough: true,
});

export const getFeedPanelHeaderText = (
  threadType: ThreadType = ThreadType.Conversation
) => {
  switch (threadType) {
    case ThreadType.Announcement:
      return i18next.t('label.announcement');
    case ThreadType.Task:
      return i18next.t('label.task');
    case ThreadType.Conversation:
    default:
      return i18next.t('label.conversation');
  }
};
