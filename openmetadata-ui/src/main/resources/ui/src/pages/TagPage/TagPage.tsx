/*
 *  Copyright 2024 Collate.
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
import {
  Button,
  Col,
  Divider,
  Dropdown,
  Row,
  Space,
  Tabs,
  Tooltip,
} from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { cloneDeep, isEmpty, startsWith } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as IconTag } from '../../assets/svg/classification.svg';
import { ReactComponent as IconDisableTag } from '../../assets/svg/disable-tag.svg';
import { ReactComponent as EditIcon } from '../../assets/svg/edit-new.svg';
import { ReactComponent as IconDelete } from '../../assets/svg/ic-delete.svg';
import { ReactComponent as IconDropdown } from '../../assets/svg/menu.svg';
import { ReactComponent as StyleIcon } from '../../assets/svg/style.svg';
import { ActivityFeedTab } from '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import {
  ActivityFeedLayoutType,
  ActivityFeedTabs,
} from '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import { withActivityFeed } from '../../components/AppRouter/withActivityFeed';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import { ManageButtonItemLabel } from '../../components/common/ManageButtonContentItem/ManageButtonContentItem.component';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import StatusBadge from '../../components/common/StatusBadge/StatusBadge.component';
import { StatusType } from '../../components/common/StatusBadge/StatusBadge.interface';
import TabsLabel from '../../components/common/TabsLabel/TabsLabel.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import { GenericProvider } from '../../components/Customization/GenericProvider/GenericProvider';
import { GenericTab } from '../../components/Customization/GenericTab/GenericTab';
import { AssetSelectionModal } from '../../components/DataAssets/AssetsSelectionModal/AssetSelectionModal';
import { EntityHeader } from '../../components/Entity/EntityHeader/EntityHeader.component';
import { EntityStatusBadge } from '../../components/Entity/EntityStatusBadge/EntityStatusBadge.component';
import EntitySummaryPanel from '../../components/Explore/EntitySummaryPanel/EntitySummaryPanel.component';
import { EntityDetailsObjectInterface } from '../../components/Explore/ExplorePage.interface';
import AssetsTabs, {
  AssetsTabRef,
} from '../../components/Glossary/GlossaryTerms/tabs/AssetsTabs.component';
import { AssetsOfEntity } from '../../components/Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import EntityDeleteModal from '../../components/Modals/EntityDeleteModal/EntityDeleteModal';
import EntityNameModal from '../../components/Modals/EntityNameModal/EntityNameModal.component';
import StyleModal from '../../components/Modals/StyleModal/StyleModal.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import {
  BLACK_COLOR,
  DE_ACTIVE_COLOR,
  ROUTES,
} from '../../constants/constants';
import { CustomizeEntityType } from '../../constants/Customize.constants';
import { TAGS_DOCS } from '../../constants/docs.constants';
import { FEED_COUNT_INITIAL_DATA } from '../../constants/entity.constants';
import { COMMON_RESIZABLE_PANEL_CONFIG } from '../../constants/ResizablePanel.constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { Classification } from '../../generated/entity/classification/classification';
import { ProviderType, Tag } from '../../generated/entity/classification/tag';
import { EntityStatus } from '../../generated/entity/data/glossaryTerm';
import { PageType } from '../../generated/system/ui/page';
import { Style } from '../../generated/type/tagLabel';
import { useCustomPages } from '../../hooks/useCustomPages';
import { useFqn } from '../../hooks/useFqn';
import { FeedCounts } from '../../interface/feed.interface';
import { searchQuery } from '../../rest/searchAPI';
import {
  deleteTag,
  getClassificationById,
  getTagByFqn,
  patchTag,
} from '../../rest/tagAPI';
import { getEntityDeleteMessage, getFeedCounts } from '../../utils/CommonUtils';
import entityUtilClassBase from '../../utils/EntityUtilClassBase';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import {
  getClassificationDetailsPath,
  getClassificationTagPath,
} from '../../utils/RouterUtils';
import {
  getExcludedIndexesBasedOnEntityTypeEditTagPermission,
  getQueryFilterToExcludeTermsAndEntities,
  getTagAssetsQueryFilter,
  getTagImageSrc,
} from '../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import './tag-page.less';
import { TagTabs } from './TagPage.inteface';

const TagPage = () => {
  const { t } = useTranslation();
  const { fqn: tagFqn } = useFqn();
  const navigate = useNavigate();
  const { tab: activeTab = TagTabs.OVERVIEW } = useRequiredParams<{
    tab?: string;
  }>();
  const { permissions, getEntityPermission } = usePermissionProvider();
  const { customizedPage, isLoading: isCustomPageLoading } = useCustomPages(
    PageType.Tag
  );
  const [isLoading, setIsLoading] = useState(true);
  const [tagItem, setTagItem] = useState<Tag>();
  const [assetModalVisible, setAssetModalVisible] = useState(false);
  const [parentClassification, setParentClassification] =
    useState<Classification | null>(null);

  const [isNameEditing, setIsNameEditing] = useState<boolean>(false);
  const [isStyleEditing, setIsStyleEditing] = useState(false);
  const [isDelete, setIsDelete] = useState<boolean>(false);
  const [showActions, setShowActions] = useState(false);
  const [assetCount, setAssetCount] = useState<number>(0);
  const [tagPermissions, setTagPermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );
  const assetTabRef = useRef<AssetsTabRef>(null);
  const [previewAsset, setPreviewAsset] =
    useState<EntityDetailsObjectInterface>();
  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );
  const breadcrumb: TitleBreadcrumbProps['titleLinks'] = useMemo(() => {
    return tagItem
      ? [
          {
            name: 'Classifications',
            url: ROUTES.TAGS,
            activeTitle: false,
          },
          {
            name: tagItem.classification?.name ?? '',
            url: tagItem.classification?.fullyQualifiedName
              ? getClassificationDetailsPath(
                  tagItem.classification.fullyQualifiedName
                )
              : '',
            activeTitle: false,
          },
        ]
      : [];
  }, [tagItem]);

  const handleAssetClick = useCallback(
    (asset?: EntityDetailsObjectInterface) => {
      setPreviewAsset(asset);
    },
    []
  );

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const { editTagsPermission, disabledAwarePermissions } = useMemo(() => {
    if (tagItem) {
      const isEditable = !tagItem.disabled && !tagItem.deleted;

      return {
        editTagsPermission: isEditable && tagPermissions.EditAll,
        disabledAwarePermissions: {
          ...tagPermissions,
          EditOwners:
            isEditable && (tagPermissions.EditAll || tagPermissions.EditOwners),
          EditAll: isEditable && tagPermissions.EditAll,
        },
      };
    }

    return {
      editTagsPermission: false,
      disabledAwarePermissions: tagPermissions,
    };
  }, [tagPermissions, tagItem?.disabled, tagItem?.deleted]);

  const editEntitiesTagPermission = useMemo(
    () => getExcludedIndexesBasedOnEntityTypeEditTagPermission(permissions),
    [permissions]
  );

  const haveAssetEditPermission = useMemo(
    () =>
      editTagsPermission ||
      !isEmpty(editEntitiesTagPermission.entitiesHavingPermission),
    [editTagsPermission, editEntitiesTagPermission.entitiesHavingPermission]
  );

  const isCertificationClassification = useMemo(
    () => startsWith(tagFqn, 'Certification.'),
    [tagFqn]
  );

  const showDisableOption = useMemo(
    () =>
      tagPermissions.EditAll &&
      !tagItem?.deleted &&
      !parentClassification?.disabled,
    [tagPermissions.EditAll, tagItem?.deleted, parentClassification?.disabled]
  );

  const fetchCurrentTagPermission = async () => {
    if (!tagItem?.id) {
      return;
    }
    try {
      const response = await getEntityPermission(
        ResourceEntity.TAG,
        tagItem?.id
      );
      setTagPermissions(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchClassificationDetails = async (classificationId: string) => {
    if (!classificationId) {
      return;
    }
    try {
      const response = await getClassificationById(classificationId);
      setParentClassification(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const getTagData = async () => {
    try {
      setIsLoading(true);
      if (tagFqn) {
        const response = await getTagByFqn(tagFqn, {
          fields: [
            TabSpecificField.DOMAINS,
            TabSpecificField.OWNERS,
            TabSpecificField.REVIEWERS,
          ],
        });
        setTagItem(response);

        fetchClassificationDetails(response.classification?.id || '');
      }
    } catch (e) {
      showErrorToast(e as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const activeTabHandler = (tab: string) => {
    if (tagItem) {
      navigate(
        {
          pathname: getClassificationTagPath(
            tagItem.fullyQualifiedName ?? '',
            tab
          ),
        },
        {
          replace: true,
        }
      );
    }
  };

  const updateTag = async (updatedData: Tag) => {
    if (tagItem) {
      const jsonPatch = compare(tagItem, updatedData);

      try {
        const response = await patchTag(tagItem.id ?? '', jsonPatch);

        setTagItem(response);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    }
  };

  const onNameSave = async (obj: Tag) => {
    if (tagItem) {
      const { name, displayName } = obj;
      let updatedDetails = cloneDeep(tagItem);

      updatedDetails = {
        ...tagItem,
        name: name?.trim(),
        displayName: displayName?.trim(),
      };

      await updateTag(updatedDetails);
      setIsNameEditing(false);
    }
  };

  const onStyleSave = async (data: Style) => {
    if (tagItem) {
      const style: Style = {
        color: data.color ?? '',
        iconURL: data.iconURL ?? '',
      };

      const updatedDetails = {
        ...tagItem,
        style,
      };

      await updateTag(updatedDetails);
      setIsStyleEditing(false);
    }
  };

  const handleEnableDisableTagClick = useCallback(async () => {
    if (tagItem) {
      const updatedTag = {
        ...tagItem,
        disabled: !tagItem.disabled,
      };
      await updateTag(updatedTag);
    }
  }, [tagItem, updateTag]);

  const handleTagDelete = async (id: string) => {
    try {
      await deleteTag(id);
      showSuccessToast(
        t('server.entity-deleted-successfully', {
          entity: t('label.tag-lowercase'),
        })
      );
      setIsLoading(true);

      if (tagItem?.classification?.fullyQualifiedName) {
        navigate(
          getClassificationDetailsPath(
            tagItem.classification.fullyQualifiedName
          )
        );
      }
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.delete-entity-error', {
          entity: t('label.glossary'),
        })
      );
    }
  };

  const handleDelete = async () => {
    if (tagItem?.id) {
      await handleTagDelete(tagItem.id);
      setIsDelete(false);
    }
  };

  const handleAddTagClick = () => {
    navigate(ROUTES.TAGS);
  };

  const fetchClassificationTagAssets = async () => {
    try {
      const res = await searchQuery({
        query: '',
        pageNumber: 1,
        pageSize: 0,
        queryFilter: getTagAssetsQueryFilter(tagFqn),
        searchIndex: SearchIndex.ALL,
      });

      setAssetCount(res.hits.total.value ?? 0);
      if (res.hits.total.value === 0) {
        setPreviewAsset(undefined);
      }
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.asset-plural'),
        })
      );
      setAssetCount(0);
    }
  };

  const fetchFeedCount = async () => {
    if (tagItem?.fullyQualifiedName) {
      await getFeedCounts(
        EntityType.TAG,
        tagItem.fullyQualifiedName,
        handleFeedCount
      );
    }
  };

  const handleAssetSave = useCallback(() => {
    fetchClassificationTagAssets();
    assetTabRef.current?.refreshAssets();
    activeTab !== TagTabs.ASSETS && activeTabHandler(TagTabs.ASSETS);
  }, [assetTabRef]);

  const manageButtonContent: ItemType[] = [
    ...(editTagsPermission
      ? [
          {
            label: (
              <ManageButtonItemLabel
                description={t('message.rename-entity', {
                  entity: t('label.tag-lowercase'),
                })}
                icon={EditIcon}
                id="rename-button"
                name={t('label.rename')}
              />
            ),
            key: 'rename-button',
            onClick: (e: { domEvent: { stopPropagation: () => void } }) => {
              e.domEvent.stopPropagation();
              setIsNameEditing(true);
              setShowActions(false);
            },
          },
          {
            label: (
              <ManageButtonItemLabel
                description={t('message.edit-entity-style-description', {
                  entity: t('label.tag-lowercase'),
                })}
                icon={StyleIcon}
                id="rename-button"
                name={t('label.style')}
              />
            ),
            key: 'edit-style-button',
            onClick: (e: { domEvent: { stopPropagation: () => void } }) => {
              e.domEvent.stopPropagation();
              setIsStyleEditing(true);
              setShowActions(false);
            },
          },
        ]
      : []),
    ...(showDisableOption
      ? [
          {
            label: (
              <ManageButtonItemLabel
                description={
                  tagItem?.disabled
                    ? t('message.enable-tag-description')
                    : t('message.disable-tag-description')
                }
                icon={IconDisableTag}
                id="enable-disable-tag"
                name={
                  tagItem?.disabled ? t('label.enable') : t('label.disable')
                }
              />
            ),
            key: 'disable-button',
            onClick: (e: { domEvent: { stopPropagation: () => void } }) => {
              e.domEvent.stopPropagation();
              handleEnableDisableTagClick();
              setShowActions(false);
            },
          },
        ]
      : []),
    ...(tagItem?.provider !== ProviderType.System && tagPermissions.EditAll
      ? [
          {
            label: (
              <ManageButtonItemLabel
                description={t(
                  'message.delete-entity-type-action-description',
                  {
                    entityType: t('label.tag-lowercase'),
                  }
                )}
                icon={IconDelete}
                id="delete-button"
                name={t('label.delete')}
              />
            ),
            key: 'delete-button',
            onClick: (e: { domEvent: { stopPropagation: () => void } }) => {
              e.domEvent.stopPropagation();
              setIsDelete(true);
              setShowActions(false);
            },
          },
        ]
      : []),
  ];

  const tabItems = useMemo(() => {
    if (!tagItem) {
      return [];
    }

    const items = [
      {
        label: <TabsLabel id={TagTabs.OVERVIEW} name={t('label.overview')} />,
        key: 'overview',
        children: <GenericTab type={PageType.Tag} />,
      },
      {
        label: (
          <TabsLabel
            count={assetCount ?? 0}
            id="assets"
            isActive={activeTab === TagTabs.ASSETS}
            name={t('label.asset-plural')}
          />
        ),
        key: 'assets',
        children: (
          <ResizablePanels
            className="tag-height-with-resizable-panel"
            firstPanel={{
              wrapInCard: false,
              className: 'tag-resizable-panel-container',
              children: (
                <AssetsTabs
                  assetCount={assetCount}
                  entityFqn={tagItem.fullyQualifiedName ?? ''}
                  isSummaryPanelOpen={Boolean(previewAsset)}
                  permissions={
                    {
                      Create:
                        haveAssetEditPermission &&
                        !isCertificationClassification,
                      EditAll:
                        haveAssetEditPermission &&
                        !isCertificationClassification,
                    } as OperationPermission
                  }
                  ref={assetTabRef}
                  type={AssetsOfEntity.TAG}
                  onAddAsset={() => setAssetModalVisible(true)}
                  onAssetClick={handleAssetClick}
                  onRemoveAsset={handleAssetSave}
                />
              ),
              ...COMMON_RESIZABLE_PANEL_CONFIG.LEFT_PANEL,
            }}
            hideSecondPanel={!previewAsset}
            secondPanel={{
              wrapInCard: false,
              children: previewAsset && (
                <EntitySummaryPanel
                  entityDetails={previewAsset}
                  handleClosePanel={() => setPreviewAsset(undefined)}
                />
              ),
              ...COMMON_RESIZABLE_PANEL_CONFIG.RIGHT_PANEL,
              className:
                'entity-summary-resizable-right-panel-container tag-resizable-panel-container',
            }}
          />
        ),
      },
      {
        label: (
          <TabsLabel
            count={feedCount.totalCount}
            id={TagTabs.ACTIVITY_FEED}
            isActive={activeTab === TagTabs.ACTIVITY_FEED}
            name={t('label.activity-feed-and-task-plural')}
          />
        ),
        key: TagTabs.ACTIVITY_FEED,
        children: (
          <ActivityFeedTab
            refetchFeed
            entityFeedTotalCount={feedCount.totalCount}
            entityType={EntityType.TAG}
            feedCount={feedCount}
            layoutType={ActivityFeedLayoutType.THREE_PANEL}
            owners={tagItem.owners}
            subTab={ActivityFeedTabs.ALL}
            onFeedUpdate={fetchFeedCount}
            onUpdateEntityDetails={getTagData}
            onUpdateFeedCount={handleFeedCount}
          />
        ),
      },
    ];

    return items;
  }, [
    tagItem,
    previewAsset,
    activeTab,
    assetCount,
    feedCount,
    assetTabRef,
    handleAssetSave,
    editTagsPermission,
  ]);
  const icon = useMemo(() => {
    if (tagItem?.style?.iconURL) {
      const iconUrl = getTagImageSrc(tagItem.style.iconURL);

      return (
        <img
          alt={tagItem.name ?? t('label.tag')}
          className="align-middle object-contain"
          data-testid="icon"
          height={36}
          src={iconUrl}
          width={32}
        />
      );
    }

    return <IconTag className="h-9" style={{ color: DE_ACTIVE_COLOR }} />;
  }, [tagItem]);

  const badge = useMemo(() => {
    if (!tagItem) {
      return null;
    }

    const shouldShowStatus = entityUtilClassBase.shouldShowEntityStatus(
      EntityType.TAG
    );
    const entityStatus =
      'entityStatus' in tagItem
        ? tagItem.entityStatus
        : EntityStatus.Unprocessed;

    const statusBadge =
      shouldShowStatus && entityStatus ? (
        <EntityStatusBadge showDivider={false} status={entityStatus} />
      ) : null;

    const disabledBadge = tagItem.disabled ? (
      <>
        <Divider className="m-x-xs h-6" type="vertical" />
        <StatusBadge
          dataTestId="disabled"
          label={t('label.disabled')}
          status={StatusType.Stopped}
        />
      </>
    ) : null;

    if (!statusBadge && !disabledBadge) {
      return null;
    }

    return (
      <Space>
        {statusBadge}
        {disabledBadge}
      </Space>
    );
  }, [tagItem]);

  useEffect(() => {
    getTagData();
    fetchClassificationTagAssets();
    fetchFeedCount();
  }, [tagFqn]);

  useEffect(() => {
    if (tagItem) {
      fetchCurrentTagPermission();
    }
  }, [tagItem]);

  if (isLoading || isCustomPageLoading) {
    return <Loader />;
  }

  if (!tagItem) {
    return (
      <ErrorPlaceHolder
        buttonId="add-tag"
        className="mt-0-important"
        doc={TAGS_DOCS}
        heading={t('label.tag')}
        type={ERROR_PLACEHOLDER_TYPE.NO_DATA}
        onClick={handleAddTagClick}
      />
    );
  }

  return (
    <PageLayoutV1 pageTitle={tagItem.name}>
      <Row gutter={[0, 12]}>
        <Col span={24}>
          <Row
            className="data-classification"
            data-testid="data-classification"
            gutter={[0, 12]}>
            <Col className="p-x-md" flex="1">
              <EntityHeader
                badge={badge}
                breadcrumb={breadcrumb}
                entityData={tagItem}
                entityType={EntityType.TAG}
                icon={icon}
                serviceName={tagItem.name}
                titleColor={tagItem.style?.color ?? BLACK_COLOR}
              />
            </Col>
            {haveAssetEditPermission && (
              <Col className="p-x-md">
                <div className="d-flex self-end">
                  {!isCertificationClassification && !tagItem.disabled && (
                    <Button
                      data-testid="data-classification-add-button"
                      type="primary"
                      onClick={() => setAssetModalVisible(true)}>
                      {t('label.add-entity', {
                        entity: t('label.asset-plural'),
                      })}
                    </Button>
                  )}
                  {manageButtonContent.length > 0 && (
                    <Dropdown
                      align={{ targetOffset: [-12, 0] }}
                      className="m-l-xs"
                      menu={{
                        items: manageButtonContent,
                      }}
                      open={showActions}
                      overlayStyle={{ width: '350px' }}
                      placement="bottomRight"
                      trigger={['click']}
                      onOpenChange={setShowActions}>
                      <Tooltip
                        placement="topRight"
                        title={t('label.manage-entity', {
                          entity: t('label.tag-lowercase'),
                        })}>
                        <Button
                          className="flex-center"
                          data-testid="manage-button"
                          icon={
                            <IconDropdown className="manage-dropdown-icon" />
                          }
                          onClick={() => setShowActions(true)}
                        />
                      </Tooltip>
                    </Dropdown>
                  )}
                </div>
              </Col>
            )}
          </Row>
        </Col>

        <GenericProvider<Tag>
          customizedPage={customizedPage}
          data={tagItem as Tag}
          isVersionView={false}
          permissions={disabledAwarePermissions}
          type={EntityType.TAG as CustomizeEntityType}
          onUpdate={(updatedData: Tag) =>
            Promise.resolve(updateTag(updatedData))
          }>
          <Col span={24} style={{ overflowY: 'auto' }}>
            <Tabs
              destroyInactiveTabPane
              activeKey={activeTab}
              className="tabs-new tag-page-tabs"
              items={tabItems}
              onChange={activeTabHandler}
            />
          </Col>
        </GenericProvider>
      </Row>

      <EntityDeleteModal
        bodyText={getEntityDeleteMessage(tagItem.name, '')}
        entityName={tagItem.name}
        entityType="Tag"
        visible={isDelete}
        onCancel={() => setIsDelete(false)}
        onConfirm={handleDelete}
      />

      <EntityNameModal
        allowRename
        entity={tagItem}
        nameValidationRules={[
          {
            min: 1,
            max: 128,
            message: t('message.entity-size-in-between', {
              entity: t('label.name'),
              min: 1,
              max: 128,
            }),
          },
        ]}
        title={t('label.edit-entity', {
          entity: t('label.name'),
        })}
        visible={isNameEditing}
        onCancel={() => setIsNameEditing(false)}
        onSave={onNameSave}
      />
      <StyleModal
        open={isStyleEditing}
        style={tagItem.style}
        onCancel={() => setIsStyleEditing(false)}
        onSubmit={onStyleSave}
      />
      {tagItem.fullyQualifiedName && assetModalVisible && (
        <AssetSelectionModal
          entityFqn={tagItem.fullyQualifiedName}
          open={assetModalVisible}
          queryFilter={getQueryFilterToExcludeTermsAndEntities(
            tagItem.fullyQualifiedName,
            editEntitiesTagPermission.entitiesNotHavingPermission
          )}
          type={AssetsOfEntity.TAG}
          onCancel={() => setAssetModalVisible(false)}
          onSave={handleAssetSave}
        />
      )}
    </PageLayoutV1>
  );
};

export default withActivityFeed(TagPage);
