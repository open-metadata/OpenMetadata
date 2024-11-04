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
import { Button, Col, Dropdown, Row, Tabs, Tooltip } from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { cloneDeep } from 'lodash';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { ReactComponent as IconTag } from '../../assets/svg/classification.svg';
import { ReactComponent as EditIcon } from '../../assets/svg/edit-new.svg';
import { ReactComponent as IconDelete } from '../../assets/svg/ic-delete.svg';
import { ReactComponent as IconDropdown } from '../../assets/svg/menu.svg';
import { ReactComponent as StyleIcon } from '../../assets/svg/style.svg';
import DescriptionV1 from '../../components/common/EntityDescription/DescriptionV1';
import Loader from '../../components/common/Loader/Loader';
import { ManageButtonItemLabel } from '../../components/common/ManageButtonContentItem/ManageButtonContentItem.component';
import StatusBadge from '../../components/common/StatusBadge/StatusBadge.component';
import { StatusType } from '../../components/common/StatusBadge/StatusBadge.interface';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import { EntityHeader } from '../../components/Entity/EntityHeader/EntityHeader.component';
import { EntityDetailsObjectInterface } from '../../components/Explore/ExplorePage.interface';
import AssetsTabs, {
  AssetsTabRef,
} from '../../components/Glossary/GlossaryTerms/tabs/AssetsTabs.component';
import EntityDeleteModal from '../../components/Modals/EntityDeleteModal/EntityDeleteModal';
import EntityNameModal from '../../components/Modals/EntityNameModal/EntityNameModal.component';
import StyleModal from '../../components/Modals/StyleModal/StyleModal.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { DE_ACTIVE_COLOR, ROUTES } from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { Tag } from '../../generated/entity/classification/tag';
import { Operation } from '../../generated/entity/policies/policy';
import { Style } from '../../generated/type/tagLabel';
import { useFqn } from '../../hooks/useFqn';
import { MOCK_GLOSSARY_NO_PERMISSIONS } from '../../mocks/Glossary.mock';
import { searchData } from '../../rest/miscAPI';
import { deleteTag, getTagByFqn, patchTag } from '../../rest/tagAPI';
import { getCountBadge, getEntityDeleteMessage } from '../../utils/CommonUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { checkPermission } from '../../utils/PermissionsUtils';
import {
  getClassificationDetailsPath,
  getClassificationTagPath,
} from '../../utils/RouterUtils';
import {
  escapeESReservedCharacters,
  getEncodedFqn,
} from '../../utils/StringsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { TagTabs } from './TagPage.inteface';

const TagPage = () => {
  const { t } = useTranslation();
  const { fqn: tagFqn } = useFqn();
  const history = useHistory();
  const { tab: activeTab = TagTabs.OVERVIEW } = useParams<{ tab?: string }>();
  const { permissions } = usePermissionProvider();
  const [isLoading, setIsLoading] = useState(false);
  const [tagItem, setTagItem] = useState<Tag>();
  const [isDescriptionEditable, setIsDescriptionEditable] =
    useState<boolean>(false);
  const [isNameEditing, setIsNameEditing] = useState<boolean>(false);
  const [isStyleEditing, setIsStyleEditing] = useState(false);
  const [isDelete, setIsDelete] = useState<boolean>(false);
  const [showActions, setShowActions] = useState(false);
  const [assetCount, setAssetCount] = useState<number>(0);
  const assetTabRef = useRef<AssetsTabRef>(null);
  const [previewAsset, setPreviewAsset] =
    useState<EntityDetailsObjectInterface>();
  const resourceType = ResourceEntity.TAG;
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

  const hasEditPermission = useMemo(() => !tagItem?.disabled, [tagItem]);

  const onDescriptionUpdate = async (updatedHTML?: string) => {
    if (tagItem) {
      if (tagItem.description !== updatedHTML) {
        const updatedTableDetails = {
          ...tagItem,
          description: updatedHTML,
        };
        const jsonPatch = compare(tagItem, updatedTableDetails);
        try {
          const response = await patchTag(tagItem.id ?? '', jsonPatch);

          setTagItem(response);

          if (tagItem?.name !== updatedTableDetails.name) {
            history.push(
              getClassificationTagPath(response.fullyQualifiedName ?? '')
            );
          }
        } catch (error) {
          showErrorToast(error as AxiosError);
        }
        setIsDescriptionEditable(false);
      } else {
        setIsDescriptionEditable(false);
      }
    }
  };

  const getTagData = async () => {
    try {
      setIsLoading(true);
      if (tagFqn) {
        const response = await getTagByFqn(tagFqn);
        setTagItem(response);
      }
    } catch (e) {
      if (e instanceof AxiosError) {
        showErrorToast(e);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const activeTabHandler = (tab: string) => {
    if (tagItem) {
      history.push({
        pathname: getClassificationTagPath(
          tagItem.fullyQualifiedName ?? '',
          tab
        ),
      });
    }
  };

  const editDescriptionPermission = useMemo(() => {
    const editDescription = checkPermission(
      Operation.EditDescription,
      resourceType,
      permissions
    );

    return editDescription;
  }, [permissions, resourceType]);

  const updateTag = async (updatedData: Tag) => {
    if (tagItem) {
      const jsonPatch = compare(tagItem, updatedData);

      try {
        const response = await patchTag(tagItem.id ?? '', jsonPatch);

        setTagItem(response);

        if (tagItem?.name !== updatedData.name) {
          history.push(
            getClassificationTagPath(response.fullyQualifiedName ?? '')
          );
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    }
  };

  const onNameSave = async (obj: { name: string; displayName: string }) => {
    if (tagItem) {
      const { name, displayName } = obj;
      let updatedDetails = cloneDeep(tagItem);

      updatedDetails = {
        ...tagItem,
        name: name?.trim() || tagItem.name,
        displayName: displayName?.trim(),
      };

      await updateTag(updatedDetails);
      setIsNameEditing(false);
    }
  };

  const onStyleSave = async (data: Style) => {
    if (tagItem) {
      const style: Style = {
        color: data.color || undefined,
        iconURL: data.iconURL || undefined,
      };

      const updatedDetails = {
        ...tagItem,
        style,
        description: tagItem.description ?? '',
      };

      await updateTag(updatedDetails);
      setIsStyleEditing(false);
    }
  };

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
        history.push(
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

  const fetchClassificationTagAssets = async () => {
    try {
      const encodedFqn = getEncodedFqn(escapeESReservedCharacters(tagFqn));
      const res = await searchData(
        '',
        1,
        0,
        `(tags.tagFQN:"${encodedFqn}")`,
        '',
        '',
        SearchIndex.ALL
      );

      setAssetCount(res.data.hits.total.value ?? 0);
    } catch (error) {
      setAssetCount(0);
    }
  };

  const handleAssetSave = useCallback(() => {
    fetchClassificationTagAssets();
    assetTabRef.current?.refreshAssets();
    activeTab !== TagTabs.ASSETS && activeTabHandler(TagTabs.ASSETS);
  }, [assetTabRef]);

  const manageButtonContent: ItemType[] = [
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
      onClick: (e) => {
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
      onClick: (e) => {
        e.domEvent.stopPropagation();
        setIsStyleEditing(true);
        setShowActions(false);
      },
    },
    {
      label: (
        <ManageButtonItemLabel
          description={t('message.delete-entity-type-action-description', {
            entityType: t('label.tag-lowercase'),
          })}
          icon={IconDelete}
          id="delete-button"
          name={t('label.delete')}
        />
      ),
      key: 'delete-button',
      onClick: (e) => {
        e.domEvent.stopPropagation();
        setIsDelete(true);
        setShowActions(false);
      },
    },
  ];

  const tabItems = useMemo(() => {
    const items = [
      {
        label: <div data-testid="overview">{t('label.overview')}</div>,
        key: 'overview',
        children: (
          <Row className="p-md">
            <Col span={24}>
              <DescriptionV1
                removeBlur
                description={tagItem?.description}
                entityFqn={tagItem?.fullyQualifiedName}
                entityName={getEntityName(tagItem)}
                entityType={EntityType.TAG}
                hasEditAccess={hasEditPermission && editDescriptionPermission}
                isEdit={hasEditPermission && isDescriptionEditable}
                showActions={!tagItem?.deleted}
                showCommentsIcon={false}
                onCancel={() => setIsDescriptionEditable(false)}
                onDescriptionEdit={() => setIsDescriptionEditable(true)}
                onDescriptionUpdate={onDescriptionUpdate}
              />
            </Col>
          </Row>
        ),
      },
      {
        label: (
          <div data-testid="assets">
            {t('label.asset-plural')}
            <span className="p-l-xs ">
              {getCountBadge(assetCount ?? 0, '', activeTab === 'assets')}
            </span>
          </div>
        ),
        key: 'assets',
        children: (
          <AssetsTabs
            assetCount={assetCount}
            entityFqn={tagItem?.fullyQualifiedName ?? ''}
            isSummaryPanelOpen={Boolean(previewAsset)}
            permissions={MOCK_GLOSSARY_NO_PERMISSIONS}
            ref={assetTabRef}
            onAssetClick={handleAssetClick}
            onRemoveAsset={handleAssetSave}
          />
        ),
      },
    ];

    return items;
  }, [
    tagItem,
    activeTab,
    assetCount,
    assetTabRef,
    handleAssetSave,
    isDescriptionEditable,
    editDescriptionPermission,
  ]);

  const icon = useMemo(() => {
    if (tagItem?.style && (tagItem as Tag).style?.iconURL) {
      return (
        <img
          className="align-middle object-contain"
          data-testid="icon"
          height={36}
          src={(tagItem as Tag).style?.iconURL}
          width={32}
        />
      );
    }

    return <IconTag className="h-9" style={{ color: DE_ACTIVE_COLOR }} />;
  }, [tagItem]);

  useEffect(() => {
    getTagData();
    fetchClassificationTagAssets();
  }, []);

  return (
    <>
      {isLoading ? (
        <Loader />
      ) : (
        tagItem && (
          <PageLayoutV1 pageTitle={tagItem.name}>
            <Row gutter={[0, 8]}>
              <Col span={24}>
                <>
                  <Row
                    className="data-classification"
                    data-testid="data-classification"
                    gutter={[0, 12]}>
                    <Col className="p-x-md" flex="auto">
                      <EntityHeader
                        badge={
                          !hasEditPermission && (
                            <StatusBadge
                              dataTestId="disabled"
                              label="Disabled"
                              status={StatusType.Stopped}
                            />
                          )
                        }
                        breadcrumb={breadcrumb}
                        entityData={tagItem}
                        entityType={EntityType.TAG}
                        icon={icon}
                        serviceName=""
                        titleColor={tagItem.style?.color ?? 'black'}
                      />
                    </Col>
                    {hasEditPermission && (
                      <Col className="p-x-md">
                        <div style={{ textAlign: 'right' }}>
                          {manageButtonContent.length > 0 && (
                            <Dropdown
                              align={{ targetOffset: [-12, 0] }}
                              className="m-l-xs"
                              menu={{
                                items: manageButtonContent,
                              }}
                              open={showActions}
                              overlayClassName="glossary-manage-dropdown-list-container"
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
                                  className="glossary-manage-dropdown-button tw-px-1.5"
                                  data-testid="manage-button"
                                  icon={
                                    <IconDropdown className="vertical-align-inherit manage-dropdown-icon" />
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
                </>
              </Col>

              <Col span={24}>
                <Tabs
                  destroyInactiveTabPane
                  activeKey={activeTab}
                  className="classification-tabs custom-tab-spacing"
                  items={tabItems}
                  onChange={activeTabHandler}
                />
              </Col>
            </Row>

            {tagItem && (
              <EntityDeleteModal
                bodyText={getEntityDeleteMessage(tagItem.name, '')}
                entityName={tagItem.name}
                entityType="Tag"
                visible={isDelete}
                onCancel={() => setIsDelete(false)}
                onConfirm={handleDelete}
              />
            )}

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
          </PageLayoutV1>
        )
      )}
    </>
  );
};

export default TagPage;
