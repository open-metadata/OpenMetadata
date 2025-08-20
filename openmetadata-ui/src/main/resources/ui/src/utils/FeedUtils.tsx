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

import { RightOutlined } from '@ant-design/icons';
import Icon from '@ant-design/icons/lib/components/Icon';
import { Typography } from 'antd';
import { AxiosError } from 'axios';
import { Operation } from 'fast-json-patch';
import { isEqual, isUndefined, lowerCase } from 'lodash';
import { ReactNode } from 'react';
import ReactDOM from 'react-dom';
import Showdown from 'showdown';
import TurndownService from 'turndown';
import AddIcon from '../assets/svg/added-icon.svg?react';
import UpdatedIcon from '../assets/svg/updated-icon.svg?react';
import { MentionSuggestionsItem } from '../components/ActivityFeed/FeedEditor/FeedEditor.interface';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import {
  EntityField,
  entityLinkRegEx,
  EntityRegEx,
  entityRegex,
  EntityUrlMapType,
  ENTITY_URL_MAP,
  hashtagRegEx,
  linkRegEx,
  mentionRegEx,
  teamsLinkRegEx,
} from '../constants/Feeds.constants';
import { EntityType, FqnPart, TabSpecificField } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { OwnerType } from '../enums/user.enum';
import {
  CardStyle,
  EntityTestResultSummaryObject,
  FieldOperation,
  TestCaseStatus,
  Thread,
  ThreadType,
} from '../generated/entity/feed/thread';
import { User } from '../generated/entity/teams/user';
import {
  deletePostById,
  deleteThread,
  getFeedById,
  updatePost,
  updateThread,
} from '../rest/feedsAPI';
import { searchData } from '../rest/miscAPI';
import {
  getEntityPlaceHolder,
  getPartialNameFromFQN,
  getPartialNameFromTableFQN,
  getRandomColor,
  Transi18next,
} from './CommonUtils';
import { getRelativeCalendar } from './date-time/DateTimeUtils';
import EntityLink from './EntityLink';
import entityUtilClassBase from './EntityUtilClassBase';
import {
  ENTITY_LINK_SEPARATOR,
  getEntityBreadcrumbs,
  getEntityName,
} from './EntityUtils';
import Fqn from './Fqn';
import { t } from './i18next/LocalUtil';
import {
  getImageWithResolutionAndFallback,
  ImageQuality,
} from './ProfilerUtils';
import { getSanitizeContent } from './sanitize.utils';
import { getDecodedFqn, getEncodedFqn } from './StringsUtils';
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

export const getFeedListWithRelativeDays = (feedList: Thread[]) => {
  const updatedFeedList = feedList.map((feed) => ({
    ...feed,
    relativeDay: getRelativeCalendar(feed.updatedAt || 0),
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
  }

  return `${document.location.protocol}//${
    document.location.host
  }/${entityType}/${getEncodedFqn(entityFqn)}`;
};

export async function suggestions(
  searchTerm: string,
  mentionChar: string
): Promise<MentionSuggestionsItem[]> {
  if (mentionChar === '@') {
    let atValues = [];

    const data = await searchData(
      searchTerm ?? '',
      1,
      5,
      'isBot:false',
      'displayName.keyword',
      'asc',
      [SearchIndex.USER, SearchIndex.TEAM]
    );
    const hits = data.data.hits.hits;

    atValues = await Promise.all(
      hits.map(async (hit) => {
        const entityType = hit._source.entityType;
        const name = getEntityPlaceHolder(
          `@${hit._source.name ?? hit._source.displayName}`,
          hit._source.deleted
        );

        return {
          id: hit._id,
          value: name,
          link: buildMentionLink(
            ENTITY_URL_MAP[entityType as EntityUrlMapType],
            hit._source.name
          ),
          type:
            hit._index === SearchIndex.USER ? OwnerType.USER : OwnerType.TEAM,
          name: hit._source.name,
          displayName: hit._source.displayName,
        };
      })
    );

    return atValues as MentionSuggestionsItem[];
  } else {
    let hashValues = [];
    const data = await searchData(
      searchTerm ?? '',
      1,
      5,
      '',
      'displayName.keyword',
      'asc',
      SearchIndex.DATA_ASSET
    );
    const hits = data.data.hits.hits;

    hashValues = hits.map((hit) => {
      const entityType = hit._source.entityType;
      const breadcrumbs = getEntityBreadcrumbs(
        hit._source,
        entityType as EntityType,
        false
      );

      return {
        id: hit._id,
        value: `#${entityType}/${hit._source.name}`,
        link: buildMentionLink(
          entityType,
          hit._source.fullyQualifiedName ?? ''
        ),
        type: entityType,
        name: hit._source.displayName || hit._source.name,
        breadcrumbs,
      };
    });

    return hashValues;
  }
}

/**
 *
 * @param item  - MentionSuggestionsItem
 * @param user - User
 * @returns HTMLDIVELEMENT
 */
export const userMentionItemWithAvatar = (
  item: MentionSuggestionsItem,
  user?: User
) => {
  const wrapper = document.createElement('div');
  const profileUrl =
    getImageWithResolutionAndFallback(
      ImageQuality['6x'],
      user?.profile?.images
    ) ?? '';

  const { color, character } = getRandomColor(item.name);

  ReactDOM.render(
    <div className="d-flex gap-2">
      <div className="mention-profile-image">
        {profileUrl ? (
          <img
            alt={item.name}
            data-testid="profile-image"
            referrerPolicy="no-referrer"
            src={profileUrl}
          />
        ) : (
          <div
            className="flex-center flex-shrink align-middle mention-avatar"
            data-testid="avatar"
            style={{ backgroundColor: color }}>
            <span>{character}</span>
          </div>
        )}
      </div>
      <span className="d-flex items-center truncate w-56">
        {getEntityName(item)}
      </span>
    </div>,
    wrapper
  );

  return wrapper;
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
    const markdownLink = entityLinkDetails[i][3];
    updatedMessage = updatedMessage.replaceAll(m, markdownLink);
  });

  return getSanitizeContent(updatedMessage);
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
      const deleteResponse = await deletePostById(threadId, postId);
      // get updated thread only if delete response and callback is present
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

/**
 * if entity field is columns::name::description
 * return columns > name > description
 */
export const getEntityFieldDisplay = (entityField: string) => {
  if (entityField && entityField.length) {
    const entityFields = entityField.split(ENTITY_LINK_SEPARATOR);
    const separator = (
      <span className="p-x-xss">
        <RightOutlined className="text-xs m-t-xss cursor-default text-grey-muted align-middle " />
      </span>
    );

    return entityFields.map((field, i) => {
      return (
        <span key={`field-${i}`}>
          {field}
          {i < entityFields.length - 1 ? separator : null}
        </span>
      );
    });
  }

  return null;
};

export const updateThreadData = async (
  threadId: string,
  postId: string,
  isThread: boolean,
  data: Operation[],
  callback: (value: React.SetStateAction<Thread[]>) => void
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

export const prepareFeedLink = (entityType: string, entityFQN: string) => {
  const withoutFeedEntities = [
    EntityType.WEBHOOK,
    EntityType.GLOSSARY,
    EntityType.GLOSSARY_TERM,
    EntityType.TYPE,
  ];

  const entityLink = entityUtilClassBase.getEntityLink(entityType, entityFQN);

  if (!withoutFeedEntities.includes(entityType as EntityType)) {
    return `${entityLink}/${TabSpecificField.ACTIVITY_FEED}`;
  } else {
    return entityLink;
  }
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
    displayName = displayName.replace(/(?:^"+)|(?:"+$)/g, '');
  }

  return displayName;
};

export const MarkdownToHTMLConverter = new Showdown.Converter({
  strikethrough: true,
  tables: true,
  tasklists: true,
  simpleLineBreaks: true,
});

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

export const getFieldOperationIcon = (fieldOperation?: FieldOperation) => {
  let icon;

  switch (fieldOperation) {
    case FieldOperation.Added:
      icon = AddIcon;

      break;
    case FieldOperation.Deleted:
      icon = UpdatedIcon;

      break;
  }

  return (
    icon && (
      <Icon component={icon} height={16} name={fieldOperation} width={16} />
    )
  );
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

export const getTestCaseResultCount = (
  count: number,
  status: TestCaseStatus
) => (
  <div
    className={`test-result-container ${lowerCase(status)}`}
    data-testid={`test-${status}`}>
    <Typography.Text
      className="font-medium text-md"
      data-testid={`test-${status}-value`}>
      {count}
    </Typography.Text>
  </div>
);

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

const getActionLabelFromCardStyle = (
  cardStyle?: CardStyle,
  isApplication?: boolean
) => {
  let action: ReactNode = isApplication
    ? t('label.installed-lowercase')
    : t('label.added-lowercase');

  if (cardStyle === CardStyle.EntityDeleted) {
    action = (
      <Typography.Text className="text-danger">
        {isApplication
          ? t('label.uninstalled-lowercase')
          : t('label.deleted-lowercase')}
      </Typography.Text>
    );
  } else if (cardStyle === CardStyle.EntitySoftDeleted) {
    action = t('label.soft-deleted-lowercase');
  }

  return action;
};

export const getFeedHeaderTextFromCardStyle = (
  fieldOperation?: FieldOperation,
  cardStyle?: CardStyle,
  fieldName?: string,
  entityType?: EntityType
) => {
  if (fieldName === 'assets') {
    return (
      <Transi18next
        i18nKey="message.feed-asset-action-header"
        renderElement={<Typography.Text className="font-bold" />}
        values={{
          action: getActionLabelFromCardStyle(cardStyle),
        }}
      />
    );
  }
  switch (cardStyle) {
    case CardStyle.CustomProperties:
      return (
        <Transi18next
          i18nKey="message.feed-custom-property-header"
          renderElement={<Typography.Text className="font-bold" />}
        />
      );
    case CardStyle.TestCaseResult:
      return (
        <Transi18next
          i18nKey="message.feed-test-case-header"
          renderElement={<Typography.Text className="font-bold" />}
        />
      );
    case CardStyle.Description:
    case CardStyle.Tags:
    case CardStyle.Owner:
      return (
        <Transi18next
          i18nKey="message.feed-field-action-entity-header"
          renderElement={
            <Typography.Text
              className="font-bold"
              style={{ fontSize: '14px' }}
            />
          }
          values={{
            field: t(
              `label.${cardStyle === CardStyle.Tags ? 'tag-plural' : cardStyle}`
            ),
            action: t(
              `label.${fieldOperation ?? FieldOperation.Updated}-lowercase`
            ),
          }}
        />
      );

    case CardStyle.EntityCreated:
    case CardStyle.EntityDeleted:
    case CardStyle.EntitySoftDeleted:
      if (entityType === EntityType.APPLICATION) {
        return (
          <Typography.Text>
            {getActionLabelFromCardStyle(cardStyle, true)}{' '}
            {t('label.app-lowercase')}
          </Typography.Text>
        );
      }

      return getActionLabelFromCardStyle(cardStyle);

    case CardStyle.Default:
    default:
      return t('label.posted-on-lowercase');
  }
};
