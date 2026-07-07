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
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { cloneDeep, debounce, isEqual, isNil, isUndefined } from 'lodash';
import { EntityTags } from 'Models';
import {
  FC,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useActivityFeedProvider } from '../../../components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { ActivityFeedTab } from '../../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { ActivityFeedLayoutType } from '../../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import ActivityThreadPanel from '../../../components/ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import BlockEditor from '../../../components/BlockEditor/BlockEditor';
import { BlockEditorRef } from '../../../components/BlockEditor/BlockEditor.interface';
import { EntityAttachmentProvider } from '../../../components/common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import TabsLabel from '../../../components/common/TabsLabel/TabsLabel.component';
import { GenericProvider } from '../../../components/Customization/GenericProvider/GenericProvider';
import { QueryVoteType } from '../../../components/Database/TableQueries/TableQueries.interface';
import { VotingDataProps } from '../../../components/Entity/Voting/voting.interface';
import {
  CREATE_PAGE_HASH,
  KNOWLEDGE_CENTER_CLASSIFICATION,
  LONG_DELAY,
  SHORT_DELAY,
} from '../../../constants/constants';
import { CustomizeEntityType } from '../../../constants/Customize.constants';
import { FEED_COUNT_INITIAL_DATA } from '../../../constants/entity.constants';
import {
  getKnowledgePageFields,
  KNOWLEDGE_PAGE_FIELDS,
  KNOWLEDGE_PAGE_UN_SAVED_CHANGE_STATE,
} from '../../../constants/KnowledgeCenter.constant';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import {
  CreateThread,
  ThreadType,
} from '../../../generated/api/feed/createThread';
import { TagLabel } from '../../../generated/type/tagLabel';
import { useCurrentUserPreferences } from '../../../hooks/currentUserStore/useCurrentUserStore';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useArticleDraftStore } from '../../../hooks/useArticleDraftStore';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { FeedCounts } from '../../../interface/feed.interface';
import {
  ContentChangeState,
  KnowledgeCenterPageProps,
  KnowledgePage,
  RecentlyViewedQuickLinks,
} from '../../../interface/knowledge-center.interface';
import { postThread } from '../../../rest/feedsAPI';
import {
  followKnowledgePage,
  getKnowledgePageByFqn,
  patchKnowledgePage,
  unFollowKnowledgePage,
  updateKnowledgePageVote,
} from '../../../rest/knowledgeCenterAPI';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import {
  fetchEntityActivityCountInto,
  fetchEntityTaskCountsInto,
  getFeedCounts,
} from '../../../utils/FeedUtilsPure';
import i18n from '../../../utils/i18next/LocalUtil';
import { getKnowledgePageName } from '../../../utils/KnowledgePagePureUtils';
import {
  addToKnowledgeCenterRecentViewed,
  updateKnowledgeCenterRecentViewed,
} from '../../../utils/KnowledgePageUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { getTagsWithoutTier } from '../../../utils/TablePureUtils';
import tagClassBase from '../../../utils/TagClassBase';
import { createTagObject } from '../../../utils/TagsPureUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import KnowledgeDetailPageHeader from '../KnowledgeDetailPageHeader/KnowledgeDetailPageHeader';
import KnowledgePageDetailRightPanel from '../KnowledgePageDetailRightPanel/KnowledgePageDetailRightPanel';
import { TitleComponent } from '../TitleComponent/TitleComponent';
import KnowledgePageDetailSkeleton from './KnowledgePageDetailSkeleton';
interface KnowledgePageDetailComponentProps {
  onPageChange: (page: Partial<KnowledgeCenterPageProps>) => void;
  fetchKnowledgePageHierarchy?: (forceRefresh?: boolean) => Promise<void>;
  isRightPanelOpen?: boolean;
  onToggleRightPanel?: () => void;
}

const KnowledgePageDetailComponent: FC<KnowledgePageDetailComponentProps> = ({
  onPageChange,
  fetchKnowledgePageHierarchy,
  isRightPanelOpen = true,
  onToggleRightPanel,
}) => {
  const { t } = i18n;
  const { hash } = useCustomLocation();
  const { currentUser } = useApplicationStore();
  const editorRef = useRef<BlockEditorRef>({} as BlockEditorRef);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const pendingSaveCountByArticleRef = useRef<Map<string, number>>(new Map());
  const knowledgePageIdRef = useRef<string | undefined>();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const location = useLocation();
  const navigate = useNavigate();

  const { postFeed, deleteFeed, updateFeed } = useActivityFeedProvider();
  const { setDraft, removeDraft, getDraft } = useArticleDraftStore();
  const USERId = currentUser?.id ?? '';

  const { fqn, tab } = useRequiredParams<{ fqn: string; tab?: string }>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [knowledgePage, setKnowledgePage] = useState<KnowledgePage>();
  const [activeTab, setActiveTab] = useState<string>(
    tab ?? EntityTabs.OVERVIEW
  );
  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );

  const [threadLink, setThreadLink] = useState<string>('');
  const [permissions, setPermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );
  const [contentChangeState, setContentChangeState] =
    useState<ContentChangeState>(ContentChangeState.SAVED);

  const {
    preferences: { recentlyViewedQuickLinks },
  } = useCurrentUserPreferences();
  const recentlyViewed =
    recentlyViewedQuickLinks as unknown as RecentlyViewedQuickLinks['data'];

  const fetchPermission = async () => {
    setIsLoading(true);
    try {
      const response = await getEntityPermissionByFqn(
        ResourceEntity.KNOWLEDGE_PAGE as unknown as ResourceEntity,
        fqn
      );
      setPermissions(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchKnowledgePage = async (fqn: string) => {
    setIsLoading(true);
    try {
      const response = await getKnowledgePageByFqn(fqn, {
        fields: getKnowledgePageFields([
          KNOWLEDGE_PAGE_FIELDS.RELATED_ARTICLES,
          KNOWLEDGE_PAGE_FIELDS.EDITORS,
          KNOWLEDGE_PAGE_FIELDS.PARENT,
        ]),
      });

      const draft = getDraft(response.id);
      const hasChanges =
        draft &&
        ((draft.description !== undefined &&
          draft.description !== response.description) ||
          (draft.displayName !== undefined &&
            draft.displayName !== response.displayName));

      const serverChangedSinceDraft =
        draft?.version !== undefined && draft.version !== response.version;

      if (hasChanges && !serverChangedSinceDraft) {
        const pageWithDraft: KnowledgePage = {
          ...response,
          description: draft.description ?? response.description,
          displayName: draft.displayName ?? response.displayName,
        };
        setKnowledgePage(pageWithDraft);

        try {
          const patch = compare(response, pageWithDraft);
          const saved = await patchKnowledgePage(response.id, patch);
          setKnowledgePage((prev) => {
            if (prev?.id !== response.id) {
              return prev;
            }

            return {
              ...(prev ?? response),
              description: saved.description,
              displayName: saved.displayName,
              version: saved.version,
            };
          });
          removeDraft(response.id);
          if (response.id === knowledgePageIdRef.current) {
            setContentChangeState(ContentChangeState.SAVED);
          }
        } catch (syncError) {
          showErrorToast(syncError as AxiosError);
          if (response.id === knowledgePageIdRef.current) {
            setContentChangeState(ContentChangeState.UN_SAVED);
          }
        }
      } else {
        setKnowledgePage(response);
        if (draft) {
          removeDraft(response.id);
        }
      }

      addToKnowledgeCenterRecentViewed({ ...response, timestamp: 0 });
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const updateVoteHandler = async (data: VotingDataProps, id: string) => {
    try {
      const { entity } = await updateKnowledgePageVote(id, data);

      setKnowledgePage((prev) => {
        const currentKnowledgePage = prev as KnowledgePage;

        return { ...currentKnowledgePage, votes: entity.votes };
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const voteStatus = useMemo(() => {
    if (isUndefined(knowledgePage?.votes)) {
      return QueryVoteType.unVoted;
    }

    const upVoters = knowledgePage?.votes.upVoters || [];
    const downVoters = knowledgePage?.votes.downVoters || [];

    if (upVoters.some((user) => user.id === USERId)) {
      return QueryVoteType.votedUp;
    } else if (downVoters.some((user) => user.id === USERId)) {
      return QueryVoteType.votedDown;
    } else {
      return QueryVoteType.unVoted;
    }
  }, [knowledgePage, USERId]);

  const updateDelay = useMemo(
    () => (hash.slice(1) === CREATE_PAGE_HASH ? LONG_DELAY : SHORT_DELAY),
    [hash]
  );

  const handleVoteChange = async (type: VotingDataProps) => {
    let updatedVoteType;

    // current vote is same as selected vote, it means user is removing vote, else up/down voting
    if (voteStatus === type.updatedVoteType) {
      updatedVoteType = QueryVoteType.unVoted;
    } else {
      updatedVoteType = type.updatedVoteType;
    }

    knowledgePage &&
      (await updateVoteHandler({ updatedVoteType }, knowledgePage.id));
  };

  const { isFollowing, tags, displayName } = useMemo(
    () => ({
      isFollowing: Boolean(
        knowledgePage?.followers?.some(({ id }) => id === USERId)
      ),

      displayName: knowledgePage?.displayName ?? '',

      tags: getTagsWithoutTier(knowledgePage?.tags ?? []),
    }),
    [knowledgePage, USERId]
  );

  const handleToggleDelete = () => {
    setKnowledgePage((prev) => {
      if (!prev) {
        return prev;
      }

      return { ...prev, deleted: !prev?.deleted };
    });
  };

  const followKnowledgePageHandler = async (knowledgePageId: string) => {
    try {
      const res = await followKnowledgePage(knowledgePageId, USERId);
      const { newValue } = res.changeDescription.fieldsAdded[0];
      setKnowledgePage((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          followers: [...(prev?.followers ?? []), ...newValue],
        };
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const unFollowKnowledgePageHandler = async (knowledgePageId: string) => {
    try {
      const res = await unFollowKnowledgePage(knowledgePageId, USERId);
      const { oldValue } = res.changeDescription.fieldsDeleted[0];

      setKnowledgePage((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          followers: (prev?.followers ?? []).filter(
            (follower) => follower.id !== oldValue[0].id
          ),
        };
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleFollowChange = async () => {
    const knowledgePageId = knowledgePage?.id ?? '';

    if (isFollowing) {
      await unFollowKnowledgePageHandler(knowledgePageId);
    } else {
      await followKnowledgePageHandler(knowledgePageId);
    }
  };

  const createThread = async (data: CreateThread) => {
    try {
      await postThread(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  // Multiple saves (content/displayName) can be in flight at once since they
  // are debounced independently, and saves for an article the user has
  // navigated away from can still resolve in the background. Track pending
  // counts per article id so a stale save from a different article can
  // never mask or clear the currently displayed article's own pending count.
  const getPendingSaveCount = (articleId: string) =>
    pendingSaveCountByArticleRef.current.get(articleId) ?? 0;

  const beginTrackedSave = useCallback((articleId: string) => {
    pendingSaveCountByArticleRef.current.set(
      articleId,
      getPendingSaveCount(articleId) + 1
    );
    if (articleId === knowledgePageIdRef.current) {
      setContentChangeState(ContentChangeState.SAVING);
    }
  }, []);

  const endTrackedSave = useCallback(
    (savedArticleId: string) => {
      const remaining = Math.max(0, getPendingSaveCount(savedArticleId) - 1);
      if (remaining === 0) {
        pendingSaveCountByArticleRef.current.delete(savedArticleId);
        if (savedArticleId === knowledgePageIdRef.current) {
          setContentChangeState(ContentChangeState.SAVED);
        }
        removeDraft(savedArticleId);
      } else {
        pendingSaveCountByArticleRef.current.set(savedArticleId, remaining);
      }
    },
    [removeDraft]
  );

  const updatedPageContent = useCallback(
    async (updatedContent: string) => {
      const hasContentEditPermission =
        permissions.EditAll || permissions.EditDescription;

      if (isUndefined(knowledgePage) || !hasContentEditPermission) {
        return;
      }

      const currentKnowledgePage = cloneDeep(knowledgePage);
      const existingContent = currentKnowledgePage.description;

      if (existingContent === updatedContent) {
        return;
      }

      try {
        beginTrackedSave(currentKnowledgePage.id);

        const updatedKnowledgePage: KnowledgePage = {
          ...currentKnowledgePage,
          description: updatedContent,
        };

        const patch = compare(currentKnowledgePage, updatedKnowledgePage);

        const response = await patchKnowledgePage(
          currentKnowledgePage.id,
          patch
        );

        setKnowledgePage((prev) => {
          if (prev?.id !== currentKnowledgePage.id) {
            return prev;
          }

          return {
            ...(prev ?? currentKnowledgePage),
            description: response.description,
            version: response.version,
          };
        });
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        endTrackedSave(currentKnowledgePage.id);
      }
    },
    [
      knowledgePage,
      setKnowledgePage,
      permissions,
      beginTrackedSave,
      endTrackedSave,
    ]
  );

  const handleContentSave = useCallback(
    debounce(updatedPageContent, updateDelay),
    [updatedPageContent, updateDelay, permissions]
  );

  const saveDraftContent = useCallback(
    debounce(
      (id: string, fqn: string, description: string, version?: number) => {
        setDraft(id, { description, fqn, version });
      },
      300
    ),
    [setDraft]
  );

  const handleContentOnChange = useCallback(
    (content: string) => {
      const isChanged = !isEqual(knowledgePage?.description ?? '', content);
      if (isChanged) {
        setContentChangeState(ContentChangeState.UN_SAVED);
        if (knowledgePage?.id) {
          saveDraftContent(
            knowledgePage.id,
            knowledgePage.fullyQualifiedName,
            content,
            knowledgePage.version
          );
        }
      } else if (
        !knowledgePage?.id ||
        getPendingSaveCount(knowledgePage.id) === 0
      ) {
        setContentChangeState(ContentChangeState.SAVED);
      }
      handleContentSave(content);
    },
    [knowledgePage, handleContentSave, saveDraftContent]
  );

  const updatePage = async (updatedKnowledgePage: KnowledgePage) => {
    if (isUndefined(knowledgePage)) {
      return;
    }
    const currentKnowledgePage = cloneDeep(knowledgePage);
    try {
      const patch = compare(currentKnowledgePage, updatedKnowledgePage);
      const response = await patchKnowledgePage(currentKnowledgePage.id, patch);

      setKnowledgePage((prev) => ({
        ...(prev ?? currentKnowledgePage),
        tags: response.tags,
        owners: response.owners,
        reviewers: response.reviewers,
        domains: response.domains,
        dataProducts: response.dataProducts,
        version: response.version,
      }));

      const existingDraft = getDraft(currentKnowledgePage.id);
      if (existingDraft) {
        setDraft(currentKnowledgePage.id, { version: response.version });
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const updatePageTag = async (selectedTags: EntityTags[]) => {
    if (isUndefined(knowledgePage) || isUndefined(selectedTags)) {
      return;
    }

    const updatedTags: TagLabel[] = createTagObject(selectedTags);
    const currentKnowledgePage = cloneDeep(knowledgePage);
    try {
      const updatedKnowledgePage: KnowledgePage = {
        ...currentKnowledgePage,
        tags: updatedTags,
      };
      const patch = compare(currentKnowledgePage, updatedKnowledgePage);

      const response = await patchKnowledgePage(currentKnowledgePage.id, patch);

      setKnowledgePage((prev) => ({
        ...(prev ?? currentKnowledgePage),
        tags: response.tags,
        version: response.version,
      }));

      const existingDraft = getDraft(currentKnowledgePage.id);
      if (existingDraft) {
        setDraft(currentKnowledgePage.id, { version: response.version });
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleDisplayNameUpdate = useCallback(
    async (updatedDisplayName: string) => {
      const hasDisplayNameEditPermission =
        permissions.EditAll || permissions.EditDisplayName;

      if (!knowledgePage || !hasDisplayNameEditPermission) {
        return;
      }
      const currentKnowledgePage = cloneDeep(knowledgePage);
      const updatedKnowledgePage = {
        ...knowledgePage,
        displayName: updatedDisplayName.trim(),
      };

      try {
        beginTrackedSave(currentKnowledgePage.id);

        const patch = compare(currentKnowledgePage, updatedKnowledgePage);

        const response = await patchKnowledgePage(
          currentKnowledgePage.id,
          patch
        );
        updateKnowledgeCenterRecentViewed(
          recentlyViewed.map((recentView) => {
            if (recentView.id === response.id) {
              return { ...recentView, displayName: response.displayName };
            }

            return recentView;
          })
        );

        setKnowledgePage((prev) => {
          if (prev?.id !== currentKnowledgePage.id) {
            return prev;
          }

          return {
            ...(prev ?? currentKnowledgePage),
            displayName: response.displayName,
            version: response.version,
          };
        });
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        endTrackedSave(currentKnowledgePage.id);
      }
    },
    [
      knowledgePage,
      setKnowledgePage,
      permissions,
      beginTrackedSave,
      endTrackedSave,
    ]
  );

  const handleDisplayNameSave = useCallback(
    debounce(handleDisplayNameUpdate, updateDelay),
    [handleDisplayNameUpdate, updateDelay, permissions]
  );

  const saveDraftDisplayName = useCallback(
    debounce(
      (id: string, fqn: string, displayName: string, version?: number) => {
        setDraft(id, { displayName, fqn, version });
      },
      300
    ),
    [setDraft]
  );

  const handleSave = useCallback(() => {
    saveDraftContent.flush();
    saveDraftDisplayName.flush();
    handleDisplayNameSave.flush();
    handleContentSave.flush();
  }, [
    saveDraftContent,
    saveDraftDisplayName,
    handleDisplayNameSave,
    handleContentSave,
  ]);

  const handleDisplayNameChange = useCallback(
    (updatedDisplayName: string) => {
      const isChanged = !isEqual(
        knowledgePage?.displayName ?? '',
        updatedDisplayName
      );
      if (isChanged) {
        setContentChangeState(ContentChangeState.UN_SAVED);
        if (knowledgePage?.id) {
          saveDraftDisplayName(
            knowledgePage.id,
            knowledgePage.fullyQualifiedName,
            updatedDisplayName,
            knowledgePage.version
          );
        }
      } else if (
        !knowledgePage?.id ||
        getPendingSaveCount(knowledgePage.id) === 0
      ) {
        setContentChangeState(ContentChangeState.SAVED);
      }
      handleDisplayNameSave(updatedDisplayName);
    },
    [knowledgePage, handleDisplayNameSave, saveDraftDisplayName]
  );

  const handleRelatedEntitiesUpdate = async (
    updatedRelatedEntities: KnowledgePage['relatedEntities']
  ) => {
    if (isUndefined(knowledgePage)) {
      return;
    }

    const currentKnowledgePage = cloneDeep(knowledgePage);
    try {
      const updatedKnowledgePage: KnowledgePage = {
        ...currentKnowledgePage,
        relatedEntities: updatedRelatedEntities,
      };
      const patch = compare(currentKnowledgePage, updatedKnowledgePage);

      const response = await patchKnowledgePage(currentKnowledgePage.id, patch);

      setKnowledgePage((previousPage) => ({
        ...((previousPage ?? {}) as KnowledgePage),
        relatedEntities: response['relatedEntities'],
        version: response.version,
      }));

      const existingDraft = getDraft(currentKnowledgePage.id);
      if (existingDraft) {
        setDraft(currentKnowledgePage.id, { version: response.version });
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = () => {
    if (knowledgePage?.fullyQualifiedName) {
      getFeedCounts(
        EntityType.KNOWLEDGE_PAGE,
        knowledgePage.fullyQualifiedName,
        handleFeedCount
      );
    }
  };

  const fetchTaskCounts = useCallback(() => {
    if (knowledgePage?.fullyQualifiedName) {
      fetchEntityTaskCountsInto(knowledgePage.fullyQualifiedName, setFeedCount);
    }
  }, [knowledgePage?.fullyQualifiedName]);

  const fetchActivityCount = useCallback(() => {
    if (knowledgePage?.fullyQualifiedName) {
      fetchEntityActivityCountInto(
        EntityType.KNOWLEDGE_PAGE,
        knowledgePage.fullyQualifiedName,
        setFeedCount
      );
    }
  }, [knowledgePage?.fullyQualifiedName]);

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      navigate(contextCenterClassBase.getArticlePath(fqn, activeKey));
      setActiveTab(activeKey);
    }
  };

  const handleTitleKeyDown = (e: KeyboardEvent) => {
    if (e.shiftKey) {
      return;
    }
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isNil(editorRef.current.editor)) {
        editorRef.current.editor.commands.focus('start');
      }
    }
  };

  const tabs = useMemo(() => {
    const items = [
      {
        name: t('label.content'),
        label: <div data-testid="overview">{t('label.content')}</div>,
        key: EntityTabs.OVERVIEW,
        children: (
          <>
            <TitleComponent
              autoFocus={hash.slice(1) === CREATE_PAGE_HASH}
              placeholder={getKnowledgePageName(knowledgePage)}
              readOnly={!(permissions.EditAll || permissions.EditDisplayName)}
              ref={titleRef}
              value={displayName}
              onChange={handleDisplayNameChange}
              onKeyDown={handleTitleKeyDown}
            />
            <EntityAttachmentProvider
              allowFileUpload
              entityFqn={knowledgePage?.fullyQualifiedName ?? ''}
              entityType={EntityType.KNOWLEDGE_PAGE}>
              <BlockEditor
                content={knowledgePage?.description ?? ''}
                editable={permissions.EditAll || permissions.EditDescription}
                ref={editorRef}
                showInlineAlert={false}
                onChange={handleContentOnChange}
              />
            </EntityAttachmentProvider>
          </>
        ),
      },
      {
        name: t('label.activity-feed-and-task-plural'),
        label: (
          <TabsLabel
            count={feedCount.totalCount}
            id={EntityTabs.ACTIVITY_FEED}
            isActive={activeTab === EntityTabs.ACTIVITY_FEED}
            name={t('label.activity-feed-and-task-plural')}
          />
        ),
        key: EntityTabs.ACTIVITY_FEED,
        children: (
          <ActivityFeedTab
            entityType={EntityType.KNOWLEDGE_PAGE}
            feedCount={feedCount}
            layoutType={ActivityFeedLayoutType.THREE_PANEL}
            owners={knowledgePage?.owners}
            onFeedUpdate={getEntityFeedCount}
            onUpdateEntityDetails={() => fetchKnowledgePage(fqn)}
          />
        ),
      },
    ];

    return items;
  }, [knowledgePage, feedCount, activeTab, permissions, displayName, fqn]);

  const hasViewPermission = useMemo(
    () => permissions.ViewAll || permissions.ViewBasic,
    [permissions]
  );

  const isContentUnsaved = useMemo(
    () => KNOWLEDGE_PAGE_UN_SAVED_CHANGE_STATE.includes(contentChangeState),
    [contentChangeState]
  );

  const getHeaderElement = useCallback(
    () => (
      <KnowledgeDetailPageHeader
        contentChangeState={contentChangeState}
        fetchKnowledgePageHierarchy={fetchKnowledgePageHierarchy}
        isLoading={isLoading}
        knowledgePage={knowledgePage}
        permissions={permissions}
        onFollowChange={handleFollowChange}
        onSave={handleSave}
        onSetThreadLink={setThreadLink}
        onToggleDelete={handleToggleDelete}
        onVoteChange={handleVoteChange}
      />
    ),
    [
      contentChangeState,
      isLoading,
      knowledgePage,
      permissions,
      setThreadLink,
      handleToggleDelete,
      handleVoteChange,
      handleSave,
    ]
  );

  useEffect(() => {
    knowledgePageIdRef.current = knowledgePage?.id;
  }, [knowledgePage?.id]);

  useEffect(() => {
    fetchPermission();
  }, []);

  useEffect(() => {
    if (tab) {
      setActiveTab(tab);
    }
  }, [tab]);

  useEffect(() => {
    setContentChangeState(ContentChangeState.SAVED);
  }, [fqn]);

  useEffect(() => {
    if (hasViewPermission) {
      fetchKnowledgePage(fqn);
    }
  }, [fqn, hasViewPermission]);

  useEffect(() => {
    if (knowledgePage?.fullyQualifiedName) {
      fetchTaskCounts();
      fetchActivityCount();
    }
  }, [knowledgePage?.fullyQualifiedName]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isContentUnsaved) {
        event.preventDefault();
        event.returnValue = '';
      }
    };

    const handleBeforeNavigate = (event: PopStateEvent) => {
      if (isContentUnsaved) {
        const confirm = window.confirm(t('message.unsaved-change-in-page'));
        if (!confirm) {
          event.preventDefault();
          window.history.pushState(null, '', location.pathname);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handleBeforeNavigate);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handleBeforeNavigate);
    };
  }, [isContentUnsaved, location.pathname]);

  const activeTabContent = useMemo(
    () => tabs?.find((t) => t?.key === activeTab)?.children ?? null,
    [tabs, activeTab]
  );

  useEffect(() => {
    return () => {
      saveDraftContent.flush();
      saveDraftDisplayName.flush();
    };
  }, [saveDraftContent, saveDraftDisplayName]);

  useEffect(() => {
    tagClassBase.setFilterClassification([]);

    return () => {
      tagClassBase.setFilterClassification([KNOWLEDGE_CENTER_CLASSIFICATION]);
    };
  }, []);

  const pageConfig = useMemo(() => {
    let rightPanel = null;
    if (
      isRightPanelOpen &&
      activeTab !== EntityTabs.ACTIVITY_FEED &&
      knowledgePage
    ) {
      rightPanel = (
        <GenericProvider
          data={knowledgePage}
          permissions={permissions}
          type={EntityType.KNOWLEDGE_PAGE as unknown as CustomizeEntityType}
          onUpdate={updatePage}>
          <KnowledgePageDetailRightPanel
            handleRelatedEntitiesUpdate={handleRelatedEntitiesUpdate}
            knowledgePage={knowledgePage}
            permissions={permissions}
            tags={tags}
            updatePageTag={updatePageTag}
          />
        </GenericProvider>
      );
    }

    return {
      activeTab,
      data: knowledgePage,
      feedCount: feedCount?.totalCount,
      handlers: {
        contentChangeState,
        onFollowChange: handleFollowChange,
        onSave: handleSave,
        onSetThreadLink: setThreadLink,
        onToggleDelete: handleToggleDelete,
        onUpdate: updatePage,
        onVoteChange: handleVoteChange,
      },
      header: <div className="tw:mb-5 tw:rounded-xl">{getHeaderElement()}</div>,
      isRightPanelOpen,
      onTabChange: handleTabChange,
      onToggleRightPanel,
      rightPanel,
      tabs,
      title: getKnowledgePageName(knowledgePage, t),
    };
  }, [
    knowledgePage,
    isRightPanelOpen,
    onToggleRightPanel,
    permissions,
    contentChangeState,
    activeTab,
    feedCount,
    tags,
    tabs,
    getHeaderElement,
  ]);

  useEffect(() => {
    onPageChange(pageConfig);
  }, [pageConfig, onPageChange]);

  if (isLoading) {
    return <KnowledgePageDetailSkeleton />;
  }

  if (!hasViewPermission) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.knowledge-page'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  if (!knowledgePage) {
    return <ErrorPlaceHolder className="m-0" />;
  }

  return (
    <>
      {activeTabContent}
      {threadLink ? (
        <ActivityThreadPanel
          createThread={createThread}
          deletePostHandler={deleteFeed}
          open={Boolean(threadLink)}
          postFeedHandler={postFeed}
          threadLink={threadLink}
          threadType={ThreadType.Conversation}
          updateThreadHandler={updateFeed}
          onCancel={() => setThreadLink('')}
        />
      ) : null}
    </>
  );
};

export default KnowledgePageDetailComponent;
