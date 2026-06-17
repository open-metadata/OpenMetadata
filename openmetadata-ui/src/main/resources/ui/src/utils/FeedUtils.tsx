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
import type { ReactNode } from 'react';
import ReactDOM from 'react-dom';
import { ReactComponent as AddIcon } from '../assets/svg/added-icon.svg';
import { ReactComponent as UpdatedIcon } from '../assets/svg/updated-icon.svg';
import type { MentionSuggestionsItem } from '../components/ActivityFeed/FeedEditor/FeedEditor.interface';
import { EntityUrlMapType, ENTITY_URL_MAP } from '../constants/Feeds.constants';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { OwnerType } from '../enums/user.enum';
import { ActivityEventType } from '../generated/entity/activity/activityEvent';
import { CardStyle, FieldOperation } from '../generated/entity/feed/thread';
import type { User } from '../generated/entity/teams/user';
import { searchQuery } from '../rest/searchAPI';
import { getRandomColor } from './ColorUtils';
import { getEntityBreadcrumbs } from './EntityBreadcrumbPureUtils';
import { getEntityPlaceHolder } from './EntityDisplayUtils';
import { getEntityName } from './EntityNameUtils';
import { ENTITY_LINK_SEPARATOR } from './EntityPureUtils';
import { buildMentionLink } from './FeedUtilsPure';
import { t, Transi18next } from './i18next/LocalUtil';
import {
  getImageWithResolutionAndFallback,
  ImageQuality,
} from './ProfilerUtils';
import { getTermQuery } from './SearchUtils';

// Re-exports from FeedUtilsPure (backward compat)
export {
  buildMentionLink,
  deletePost,
  entityDisplayName,
  fetchEntityActivityCountInto,
  fetchEntityTaskCountsInto,
  formatTestStatusData,
  getBackendFormat,
  getEntityColumnFQN,
  getEntityDetail,
  getEntityField,
  getEntityFQN,
  getEntityFQNFromAbout,
  getEntityType,
  getEntityTypeFromAbout,
  getFeedChangeFieldLabel,
  getFeedCounts,
  getFeedListWithRelativeDays,
  getFeedPanelHeaderText,
  getFrontEndFormat,
  getHashTagList,
  getMentionList,
  getReplyText,
  getTestCaseNameListForResult,
  getUpdatedThread,
  HTMLToMarkdown,
  isEntityReferenceAbout,
  MarkdownToHTMLConverter,
  prepareFeedLink,
  updateThreadData,
} from './FeedUtilsPure';

export async function suggestions(
  searchTerm: string,
  mentionChar: string
): Promise<MentionSuggestionsItem[]> {
  if (mentionChar === '@') {
    let atValues = [];

    const data = await searchQuery({
      query: searchTerm ?? '',
      pageNumber: 1,
      pageSize: 5,
      queryFilter: getTermQuery({ isBot: 'false' }),
      sortField: 'displayName.keyword',
      sortOrder: 'asc',
      searchIndex: [SearchIndex.USER, SearchIndex.TEAM],
    });
    const hits = data.hits.hits;

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
            entityType === EntityType.USER ? OwnerType.USER : OwnerType.TEAM,
          name: hit._source.name,
          displayName: hit._source.displayName,
        };
      })
    );

    return atValues as MentionSuggestionsItem[];
  } else {
    let hashValues = [];
    const data = await searchQuery({
      query: searchTerm ?? '',
      pageNumber: 1,
      pageSize: 5,
      sortField: 'displayName.keyword',
      sortOrder: 'asc',
      searchIndex: SearchIndex.DATA_ASSET,
    });
    const hits = data.hits.hits;

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
            className="flex-center shrink align-middle mention-avatar"
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
          {t(`label.${field}`, { defaultValue: field })}
          {i < entityFields.length - 1 ? separator : null}
        </span>
      );
    });
  }

  return null;
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

export const getActivityEventHeaderText = (
  eventType?: ActivityEventType,
  fieldName?: string,
  _entityType?: EntityType
): ReactNode => {
  if (!eventType) {
    return t('label.posted-on-lowercase');
  }

  switch (eventType) {
    case ActivityEventType.EntityCreated:
      return (
        <Typography.Text className="font-bold">
          {t('label.created-lowercase')}
        </Typography.Text>
      );
    case ActivityEventType.EntityDeleted:
    case ActivityEventType.EntitySoftDeleted:
      return (
        <Typography.Text className="font-bold">
          {t('label.deleted-lowercase')}
        </Typography.Text>
      );
    case ActivityEventType.EntityRestored:
      return (
        <Typography.Text className="font-bold">
          {t('label.restored-lowercase')}
        </Typography.Text>
      );
    case ActivityEventType.DescriptionUpdated:
    case ActivityEventType.ColumnDescriptionUpdated:
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
            field: t('label.description'),
            action: t('label.updated-lowercase'),
          }}
        />
      );
    case ActivityEventType.TagsUpdated:
    case ActivityEventType.ColumnTagsUpdated:
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
            field: t('label.tag-plural'),
            action: t('label.added-lowercase'),
          }}
        />
      );
    case ActivityEventType.OwnerUpdated:
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
            field: t('label.owner'),
            action: t('label.updated-lowercase'),
          }}
        />
      );
    case ActivityEventType.DomainUpdated:
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
            field: t('label.domain'),
            action: t('label.updated-lowercase'),
          }}
        />
      );
    case ActivityEventType.TierUpdated:
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
            field: t('label.tier'),
            action: t('label.updated-lowercase'),
          }}
        />
      );
    case ActivityEventType.CustomPropertyUpdated:
      return (
        <Transi18next
          i18nKey="message.feed-custom-property-header"
          renderElement={<Typography.Text className="font-bold" />}
        />
      );
    case ActivityEventType.TestCaseStatusChanged:
      return (
        <Transi18next
          i18nKey="message.feed-test-case-header"
          renderElement={<Typography.Text className="font-bold" />}
        />
      );
    case ActivityEventType.PipelineStatusChanged:
      return (
        <Typography.Text className="font-bold">
          {t('label.pipeline-status-changed')}
        </Typography.Text>
      );
    case ActivityEventType.EntityUpdated:
    default:
      if (fieldName) {
        return (
          <Typography.Text className="font-bold">
            {t('label.updated-field-for-lowercase', { field: fieldName })}
          </Typography.Text>
        );
      }

      return (
        <Typography.Text className="font-bold">
          {t('label.updated-lowercase')}
        </Typography.Text>
      );
  }
};
