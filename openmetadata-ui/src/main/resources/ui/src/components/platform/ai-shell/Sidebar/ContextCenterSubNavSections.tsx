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

import { Button, Typography } from '@openmetadata/ui-core-components';
import { File06, Link03, Plus } from '@untitledui/icons';
import { groupBy, isEmpty, startCase } from 'lodash';
import { FC, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FQN_SEPARATOR_CHAR } from '../../../../constants/char.constants';
import {
  KNOWLEDGE_CENTER_CLASSIFICATION,
  PAGE_SIZE_MEDIUM,
} from '../../../../constants/constants';
import {
  EntityType,
  TabSpecificField,
} from '../../../../enums/entity.enum';
import { useCurrentUserPreferences } from '../../../../hooks/currentUserStore/useCurrentUserStore';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import {
  KnowledgePage,
  PageType,
  RecentlyViewedQuickLinks,
} from '../../../../interface/knowledge-center.interface';
import { getListKnowledgePages } from '../../../../rest/knowledgeCenterAPI';
import { getTags } from '../../../../rest/tagAPI';
import { getUserById } from '../../../../rest/userAPI';
import contextCenterClassBase from '../../../../utils/ContextCenterClassBase';
import { getEntityName } from '../../../../utils/EntityNameUtils';

const MAX_ITEMS = 4;

interface ContextCenterSubNavSectionsProps {
  enabled: boolean;
  onUploadFile: () => void;
  onCreateArticle: () => void;
  onAddQuickLink: () => void;
}

interface QuickLinkSection {
  tagFqn: string;
  links: KnowledgePage[];
}

type PageEntry = {
  fullyQualifiedName?: string;
  displayName?: string;
  name?: string;
  pageType?: PageType;
  page?: { url?: string };
};

const ContextCenterSubNavSections: FC<ContextCenterSubNavSectionsProps> = ({
  enabled,
  onUploadFile,
  onCreateArticle,
  onAddQuickLink,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useApplicationStore();
  const {
    preferences: { recentlyViewedQuickLinks },
  } = useCurrentUserPreferences();

  const [bookmarks, setBookmarks] = useState<KnowledgePage[]>([]);
  const [quickLinkSections, setQuickLinkSections] = useState<
    QuickLinkSection[]
  >([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );

  const recentlyViewed =
    recentlyViewedQuickLinks as unknown as RecentlyViewedQuickLinks['data'];

  const toggleExpand = useCallback((sectionKey: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
      } else {
        next.add(sectionKey);
      }

      return next;
    });
  }, []);

  const fetchBookmarks = useCallback(async () => {
    if (!currentUser?.id) {
      return;
    }
    try {
      const user = await getUserById(currentUser.id, {
        fields: TabSpecificField.FOLLOWS,
      });
      const knowledgePageBookmarks = (user.follows ?? []).filter(
        (ref) => ref.type === EntityType.KNOWLEDGE_PAGE
      ) as unknown as KnowledgePage[];
      setBookmarks(knowledgePageBookmarks);
    } catch {
      setBookmarks([]);
    }
  }, [currentUser?.id]);

  const fetchQuickLinks = useCallback(async () => {
    try {
      const { data: tags } = await getTags({
        parent: KNOWLEDGE_CENTER_CLASSIFICATION,
        limit: PAGE_SIZE_MEDIUM,
      });

      const tagsObj = groupBy(tags, 'fullyQualifiedName');

      const sections = await Promise.all(
        Object.keys(tagsObj).map(async (tagFqn) => {
          try {
            const { data } = await getListKnowledgePages({
              fields: `${TabSpecificField.OWNERS},${TabSpecificField.TAGS}`,
              tagFQN: tagFqn,
            });

            return { tagFqn, links: data };
          } catch {
            return { tagFqn, links: [] };
          }
        })
      );

      setQuickLinkSections(sections.filter((s) => !isEmpty(s.links)));
    } catch {
      setQuickLinkSections([]);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setBookmarks([]);
      setQuickLinkSections([]);

      return;
    }

    fetchBookmarks();
    fetchQuickLinks();
  }, [enabled, fetchBookmarks, fetchQuickLinks]);

  const renderNavLink = useCallback(
    (page: PageEntry, testId: string) => {
      const label = getEntityName(page) || t('label.untitled');
      const isQuickLink = page.pageType === PageType.QUICK_LINK;
      const Icon = isQuickLink ? Link03 : File06;

      const handleClick = () => {
        if (isQuickLink && page.page?.url) {
          window.open(page.page.url, '_blank', 'noopener,noreferrer');
        } else {
          const path = page.fullyQualifiedName
            ? contextCenterClassBase.getArticlePath(page.fullyQualifiedName)
            : contextCenterClassBase.getArticlesListPath();
          navigate(path);
        }
      };

      return (
        <li key={page.fullyQualifiedName ?? testId}>
          <button
            aria-label={label}
            className="ask-sub-panel__item"
            data-testid={`ask-sub-panel-link-${testId}`}
            title={label}
            type="button"
            onClick={handleClick}>
            <span className="ask-sub-panel__item-icon">
              <Icon size={16} />
            </span>
            <span className="ask-sub-panel__item-label">{label}</span>
          </button>
        </li>
      );
    },
    [navigate, t]
  );

  const renderExpandableList = useCallback(
    (sectionKey: string, items: PageEntry[], keyPrefix: string) => {
      const isExpanded = expandedSections.has(sectionKey);
      const visible = isExpanded ? items : items.slice(0, MAX_ITEMS);
      const hasMore = items.length > MAX_ITEMS;

      return (
        <>
          {visible.map((page, i) =>
            renderNavLink(page, `${keyPrefix}-${page.fullyQualifiedName ?? i}`)
          )}
          {hasMore && (
            <li key={`${sectionKey}-toggle`}>
              <Button
                className="tw:font-normal tw:ml-3"
                color="link-color"
                data-testid={`ask-sub-panel-toggle-${sectionKey}`}
                type="button"
                onClick={() => toggleExpand(sectionKey)}>
                {isExpanded ? t('label.show-less') : t('label.view-more')}
              </Button>
            </li>
          )}
        </>
      );
    },
    [expandedSections, renderNavLink, t, toggleExpand]
  );

  return (
    <>
      <section className="ask-sub-panel__section ask-sub-panel__section--with-header">
        <Typography className="tw:text-gray-500" size="text-xs" weight="medium">
          {t('label.quick-action-plural')}
        </Typography>
        <ul className="ask-sub-panel__list">
          <li>
            <button
              className="ask-sub-panel__item ask-sub-panel__item--emphasized"
              data-testid="ask-sub-panel-upload-file"
              type="button"
              onClick={onUploadFile}>
              <span className="ask-sub-panel__item-icon">
                <Plus size={18} strokeWidth={1.8} />
              </span>
              <span className="ask-sub-panel__item-label">
                {t('label.upload-file')}
              </span>
            </button>
          </li>
          <li>
            <button
              className="ask-sub-panel__item ask-sub-panel__item--emphasized"
              data-testid="ask-sub-panel-create-article"
              type="button"
              onClick={onCreateArticle}>
              <span className="ask-sub-panel__item-icon">
                <Plus size={18} strokeWidth={1.8} />
              </span>
              <span className="ask-sub-panel__item-label">
                {t('label.create-entity', { entity: t('label.article') })}
              </span>
            </button>
          </li>
          <li>
            <button
              className="ask-sub-panel__item ask-sub-panel__item--emphasized"
              data-testid="ask-sub-panel-create-quick-link"
              type="button"
              onClick={onAddQuickLink}>
              <span className="ask-sub-panel__item-icon">
                <Plus size={18} strokeWidth={1.8} />
              </span>
              <span className="ask-sub-panel__item-label">
                {t('label.add-entity', { entity: t('label.quick-link') })}
              </span>
            </button>
          </li>
        </ul>
      </section>

      {!isEmpty(recentlyViewed) && (
        <section className="ask-sub-panel__section ask-sub-panel__section--with-header">
          <Typography
            className="tw:text-gray-500 tw:pl-1"
            size="text-xs"
            weight="medium">
            {t('label.recently-viewed')}
          </Typography>
          <ul className="ask-sub-panel__list">
            {renderExpandableList('recent', recentlyViewed ?? [], 'recent')}
          </ul>
        </section>
      )}

      {!isEmpty(bookmarks) && (
        <section className="ask-sub-panel__section ask-sub-panel__section--with-header">
          <Typography
            className="tw:text-gray-500 tw:pl-1"
            size="text-xs"
            weight="medium">
            {t('label.bookmark-plural')}
          </Typography>
          <ul className="ask-sub-panel__list">
            {renderExpandableList('bookmarks', bookmarks, 'bookmark')}
          </ul>
        </section>
      )}

      {quickLinkSections.map(({ tagFqn, links }) => (
        <section
          className="ask-sub-panel__section ask-sub-panel__section--with-header"
          key={tagFqn}>
          <Typography
            className="tw:text-gray-500 tw:pl-1"
            size="text-xs"
            weight="medium">
            {startCase(tagFqn.split(FQN_SEPARATOR_CHAR)[1])}
          </Typography>
          <ul className="ask-sub-panel__list">
            {renderExpandableList(`ql-${tagFqn}`, links, `ql-${tagFqn}`)}
          </ul>
        </section>
      ))}
    </>
  );
};

export default ContextCenterSubNavSections;
