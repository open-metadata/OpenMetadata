/*
 *  Copyright 2023 Collate.
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
import { Box, Card, Typography } from '@openmetadata/ui-core-components';
import { Skeleton } from 'antd';
import { AxiosError } from 'axios';
import { groupBy, isEmpty, map, startCase, uniqueId } from 'lodash';
import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconArticle } from '../../../assets/svg/ic-articles.svg';
import { ReactComponent as EyeIcon } from '../../../assets/svg/ic-eye.svg';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../../components/common/Loader/Loader';
import WidgetCard from '../../../components/common/WidgetCard/WidgetCard';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import {
  KNOWLEDGE_CENTER_CLASSIFICATION,
  PAGE_SIZE_MEDIUM,
} from '../../../constants/constants';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../enums/common.enum';
import { TabSpecificField } from '../../../enums/entity.enum';
import { Tag } from '../../../generated/entity/classification/tag';
import { useCurrentUserPreferences } from '../../../hooks/currentUserStore/useCurrentUserStore';
import {
  KnowledgePage,
  RecentlyViewedQuickLinks,
} from '../../../interface/knowledge-center.interface';
import { getListKnowledgePages } from '../../../rest/knowledgeCenterAPI';
import { getTags } from '../../../rest/tagAPI';
import { getLink } from '../../../utils/KnowledgePageUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import BookMarkWidget from '../BookMarkWidget/BookMarkWidget';

export interface KnowledgePageListRightPanelProps {
  onAdd: () => void;
  permissions: OperationPermission;
  refreshBookMarkWidget: boolean;
  refreshTagsCategory: boolean;
  onRefreshBookMarkWidget: (value: boolean) => void;
  onRefreshTagsCategory: (value: boolean) => void;
}

type QuickLinkTuple = [string, KnowledgePage[]];

type QuickLinkByTag = Array<QuickLinkTuple>;

const KnowledgePageListRightPanel: FC<KnowledgePageListRightPanelProps> = ({
  onAdd,
  permissions,
  refreshBookMarkWidget,
  refreshTagsCategory,
  onRefreshTagsCategory,
  onRefreshBookMarkWidget,
}) => {
  const { t } = useTranslation();
  const [quickLinksByTag, setQuickLinksByTag] = useState<QuickLinkByTag>([]);
  const [knowledgeCenterTags, setKnowledgeCenterTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const {
    preferences: { recentlyViewedQuickLinks },
  } = useCurrentUserPreferences();
  const recentlyViewed =
    recentlyViewedQuickLinks as unknown as RecentlyViewedQuickLinks['data'];

  const fetchQuickLinkByTag = async (tagFqn: string) => {
    try {
      const { data } = await getListKnowledgePages({
        fields: `${TabSpecificField.OWNERS},${TabSpecificField.TAGS}`,
        tagFQN: tagFqn,
      });

      return data;
    } catch {
      return [];
    }
  };

  const fetchKnowledgeCenterTags = async () => {
    setIsLoading(true);
    try {
      const { data } = await getTags({
        parent: KNOWLEDGE_CENTER_CLASSIFICATION,
        limit: PAGE_SIZE_MEDIUM,
      });

      setKnowledgeCenterTags(data);

      const tagsObj = groupBy(data, 'fullyQualifiedName');

      // Fetch all quick links concurrently and set state only once
      const quickLinkPromises = Object.keys(tagsObj).map(async (tag) => {
        const quickLinks = await fetchQuickLinkByTag(tag);

        return [tag, quickLinks] as QuickLinkTuple;
      });

      const allQuickLinks = await Promise.all(quickLinkPromises);
      setQuickLinksByTag(allQuickLinks);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshTagsCategory = async () => {
    // reset quick links
    setQuickLinksByTag([]);
    try {
      const tagsObj = groupBy(knowledgeCenterTags, 'fullyQualifiedName');

      // Fetch all quick links concurrently and set state only once
      const quickLinkPromises = Object.keys(tagsObj).map(async (tag) => {
        const quickLinks = await fetchQuickLinkByTag(tag);

        return [tag, quickLinks] as QuickLinkTuple;
      });

      const allQuickLinks = await Promise.all(quickLinkPromises);
      setQuickLinksByTag(allQuickLinks);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      onRefreshTagsCategory(false);
    }
  };

  useEffect(() => {
    fetchKnowledgeCenterTags();
  }, []);

  useEffect(() => {
    if (refreshTagsCategory) {
      handleRefreshTagsCategory();
    }
  }, [refreshTagsCategory, knowledgeCenterTags]);

  if (isLoading) {
    return (
      <div className="p-md p-x-lg" data-testid="loader">
        {Array.from({ length: 3 }).map(() => (
          <div className="m-b-lg" key={uniqueId()}>
            <Box className="tw:w-full" direction="col">
              <Skeleton
                active
                paragraph={{ rows: 1, width: 100 }}
                title={false}
              />
              <Skeleton
                active
                paragraph={{ rows: 3, width: '100%' }}
                title={false}
              />
            </Box>
          </div>
        ))}
      </div>
    );
  }

  if (!isLoading && isEmpty(quickLinksByTag) && !refreshTagsCategory) {
    return (
      <ErrorPlaceHolder
        buttonId="add-quick-link"
        className="border-none"
        heading={t('label.quick-link-plural')}
        permission={permissions.Create}
        permissionValue={t('label.create-entity', {
          entity: t('label.quick-link'),
        })}
        size={SIZE.MEDIUM}
        type={ERROR_PLACEHOLDER_TYPE.CREATE}
        onClick={onAdd}
      />
    );
  }

  const recentViewsElement = map(recentlyViewed, (page) =>
    getLink(page, 'recent-viewed')
  );

  return (
    <Card className="tw:h-full tw:p-5 tw:overflow-auto">
      <Card.Content
        className="tw:p-0 tw:flex tw:flex-col tw:gap-6 knowledge-center-list-right-panel"
        data-testid="knowledge-center-right-panel">
        <BookMarkWidget
          handleRefreshBookMarkWidget={onRefreshBookMarkWidget}
          refresh={refreshBookMarkWidget}
        />

        <WidgetCard
          title={t('label.recently-viewed')}
          titleIcon={<EyeIcon height={16} width={16} />}>
          {isEmpty(recentlyViewed) ? (
            <Typography className="tw:text-gray-500" size="text-xs">
              {t('message.no-recently-viewed-date')}
            </Typography>
          ) : (
            <Box direction="col" gap={2}>
              {recentViewsElement}
            </Box>
          )}
        </WidgetCard>

        {refreshTagsCategory ? (
          <Loader />
        ) : (
          <>
            {map(quickLinksByTag, ([tagFqn, uniqueLinks]) => {
              if (isEmpty(uniqueLinks)) {
                return null;
              }

              return (
                <WidgetCard
                  title={startCase(tagFqn.split(FQN_SEPARATOR_CHAR)[1])}
                  titleIcon={<IconArticle height={16} width={16} />}>
                  <Box direction="col" gap={2}>
                    {map(uniqueLinks, (matchedQuickLink) =>
                      getLink(matchedQuickLink, `tag-category-${tagFqn}`)
                    )}
                  </Box>
                </WidgetCard>
              );
            })}
          </>
        )}
      </Card.Content>
    </Card>
  );
};

export default KnowledgePageListRightPanel;
