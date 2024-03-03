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

import { Badge, Button, Space, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { isUndefined, omit } from 'lodash';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { ReactComponent as PlusIcon } from '../../assets/svg/plus-primary.svg';
import ClassificationDetails from '../../components/Classifications/ClassificationDetails/ClassificationDetails';
import { ClassificationDetailsRef } from '../../components/Classifications/ClassificationDetails/ClassificationDetails.interface';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import LeftPanelCard from '../../components/common/LeftPanelCard/LeftPanelCard';
import Loader from '../../components/common/Loader/Loader';
import TagsLeftPanelSkeleton from '../../components/common/Skeleton/Tags/TagsLeftPanelSkeleton.component';
import EntityDeleteModal from '../../components/Modals/EntityDeleteModal/EntityDeleteModal';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { HTTP_STATUS_CODE } from '../../constants/Auth.constants';
import { TIER_CATEGORY } from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { CreateClassification } from '../../generated/api/classification/createClassification';
import {
  CreateTag,
  ProviderType,
} from '../../generated/api/classification/createTag';
import { Classification } from '../../generated/entity/classification/classification';
import { Tag } from '../../generated/entity/classification/tag';
import { Operation } from '../../generated/entity/policies/accessControl/rule';
import { useFqn } from '../../hooks/useFqn';
import {
  createClassification,
  createTag,
  deleteTag,
  getAllClassifications,
  getClassificationByName,
  patchClassification,
  patchTag,
} from '../../rest/tagAPI';
import { getCountBadge, getEntityDeleteMessage } from '../../utils/CommonUtils';
import { getEntityName } from '../../utils/EntityUtils';
import {
  checkPermission,
  DEFAULT_ENTITY_PERMISSION,
} from '../../utils/PermissionsUtils';
import { getTagPath } from '../../utils/RouterUtils';
import { getErrorText } from '../../utils/StringsUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import TagsForm from './TagsForm';
import { DeleteTagsType, SubmitProps } from './TagsPage.interface';

const TagsPage = () => {
  const { getEntityPermission, permissions } = usePermissionProvider();
  const history = useHistory();
  const { fqn: tagCategoryName } = useFqn();
  const [classifications, setClassifications] = useState<Array<Classification>>(
    []
  );
  const [currentClassification, setCurrentClassification] =
    useState<Classification>();
  const [isEditClassification, setIsEditClassification] =
    useState<boolean>(false);
  const [isAddingClassification, setIsAddingClassification] =
    useState<boolean>(false);
  const [isAddingTag, setIsAddingTag] = useState<boolean>(false);
  const [editTag, setEditTag] = useState<Tag>();
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUpdateLoading, setIsUpdateLoading] = useState<boolean>(false);
  const classificationDetailsRef = useRef<ClassificationDetailsRef>(null);

  const [deleteTags, setDeleteTags] = useState<DeleteTagsType>({
    data: undefined,
    state: false,
  });
  const [classificationPermissions, setClassificationPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const [isButtonLoading, setIsButtonLoading] = useState<boolean>(false);

  const { t } = useTranslation();
  const createClassificationPermission = useMemo(
    () =>
      checkPermission(
        Operation.Create,
        ResourceEntity.CLASSIFICATION,
        permissions
      ),
    [permissions]
  );

  const isClassificationDisabled = useMemo(
    () => currentClassification?.disabled ?? false,
    [currentClassification?.disabled]
  );

  const isTier = useMemo(
    () => currentClassification?.name === 'Tier',
    [currentClassification]
  );

  const fetchCurrentClassificationPermission = async () => {
    if (!currentClassification?.id) {
      return;
    }
    try {
      const response = await getEntityPermission(
        ResourceEntity.CLASSIFICATION,
        currentClassification?.id
      );
      setClassificationPermissions(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchClassifications = async (setCurrent?: boolean) => {
    setIsLoading(true);

    try {
      const response = await getAllClassifications({
        fields: 'termCount',
        limit: 1000,
      });
      setClassifications(response.data);
      if (setCurrent && response.data.length) {
        setCurrentClassification(response.data[0]);

        history.push(getTagPath(response.data[0].fullyQualifiedName));
      }
    } catch (error) {
      const errMsg = getErrorText(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.tag-category-lowercase'),
        })
      );
      showErrorToast(errMsg);
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCurrentClassification = async (fqn: string, update?: boolean) => {
    if (currentClassification?.fullyQualifiedName !== fqn || update) {
      setIsLoading(true);
      try {
        const currentClassification = await getClassificationByName(fqn, {
          fields: 'usageCount,termCount',
        });
        if (currentClassification) {
          setClassifications((prevClassifications) =>
            prevClassifications.map((data) => {
              if (data.fullyQualifiedName === fqn) {
                return {
                  ...data,
                  termCount: currentClassification.termCount,
                };
              }

              return data;
            })
          );
          setCurrentClassification(currentClassification);

          setIsLoading(false);
        } else {
          showErrorToast(t('server.unexpected-response'));
        }
      } catch (err) {
        const errMsg = getErrorText(
          err as AxiosError,
          t('server.entity-fetch-error', {
            entity: t('label.tag-category-lowercase'),
          })
        );
        showErrorToast(errMsg);
        setError(errMsg);
        setCurrentClassification({ name: fqn, description: '' });
        setIsLoading(false);
      }
    }
  };

  const handleCreateClassification = async (data: CreateClassification) => {
    setIsButtonLoading(true);
    try {
      const res = await createClassification(data);
      await fetchClassifications();
      history.push(getTagPath(res.fullyQualifiedName));
    } catch (error) {
      if (
        (error as AxiosError).response?.status === HTTP_STATUS_CODE.CONFLICT
      ) {
        showErrorToast(
          t('server.entity-already-exist', {
            entity: t('label.classification'),
            entityPlural: t('label.classification-lowercase-plural'),
            name: data.name,
          })
        );
      } else {
        showErrorToast(
          error as AxiosError,
          t('server.create-entity-error', {
            entity: t('label.classification-lowercase'),
          })
        );
      }
    } finally {
      setIsAddingClassification(false);
      setIsButtonLoading(false);
    }
  };

  const handleCancel = () => {
    setEditTag(undefined);
    setIsAddingTag(false);
    setIsAddingClassification(false);
  };

  const handleAfterDeleteAction = useCallback(() => {
    if (!isUndefined(currentClassification)) {
      const renamingClassification = [...classifications].filter(
        (data) => data.id !== currentClassification.id
      );
      const updatedCurrentClassification = renamingClassification[0];
      setClassifications(renamingClassification);
      history.push(
        getTagPath(
          updatedCurrentClassification?.fullyQualifiedName ??
            updatedCurrentClassification?.name
        )
      );
    }
  }, [currentClassification, classifications, setClassifications]);

  /**
   * Takes category name and tag id and delete the tag
   * @param categoryName - tag category name
   * @param tagId -  tag id
   */
  const handleDeleteTag = async (tagId: string) => {
    try {
      const res = await deleteTag(tagId);

      if (res) {
        if (currentClassification) {
          setClassifications((prev) =>
            prev.map((item) => {
              if (
                item.fullyQualifiedName ===
                currentClassification.fullyQualifiedName
              ) {
                return {
                  ...item,
                  termCount: (item.termCount ?? 0) - 1,
                };
              }

              return item;
            })
          );
        }
        classificationDetailsRef.current?.refreshClassificationTags();
      } else {
        showErrorToast(
          t('server.delete-entity-error', {
            entity: t('label.tag-lowercase'),
          })
        );
      }
    } catch (err) {
      showErrorToast(
        err as AxiosError,
        t('server.delete-entity-error', { entity: t('label.tag-lowercase') })
      );
    } finally {
      setDeleteTags({ data: undefined, state: false });
    }
  };

  /**
   * It redirects to respective function call based on tag/Classification
   */
  const handleConfirmClick = async () => {
    if (deleteTags.data?.id) {
      await handleDeleteTag(deleteTags.data.id);
    }
  };

  const handleUpdateClassification = async (
    updatedClassification: Classification
  ) => {
    if (!isUndefined(currentClassification)) {
      setIsUpdateLoading(true);

      const patchData = compare(currentClassification, updatedClassification);
      try {
        const response = await patchClassification(
          currentClassification?.id ?? '',
          patchData
        );
        setClassifications((prev) =>
          prev.map((item) => {
            if (
              item.fullyQualifiedName ===
              currentClassification.fullyQualifiedName
            ) {
              return {
                ...item,
                ...response,
              };
            }

            return item;
          })
        );
        setCurrentClassification((prev) => ({ ...prev, ...response }));
        if (
          currentClassification?.fullyQualifiedName !==
            updatedClassification.fullyQualifiedName ||
          currentClassification?.name !== updatedClassification.name
        ) {
          history.push(getTagPath(response.fullyQualifiedName));
        }
      } catch (error) {
        if (
          (error as AxiosError).response?.status === HTTP_STATUS_CODE.CONFLICT
        ) {
          showErrorToast(
            t('server.entity-already-exist', {
              entity: t('label.classification'),
              entityPlural: t('label.classification-lowercase-plural'),
              name: updatedClassification.name,
            })
          );
        } else {
          showErrorToast(
            error as AxiosError,
            t('server.entity-updating-error', {
              entity: t('label.classification-lowercase'),
            })
          );
        }
      } finally {
        setIsEditClassification(false);
        setIsUpdateLoading(false);
      }
    }
  };

  const handleCreatePrimaryTag = async (data: CreateTag) => {
    try {
      await createTag({
        ...data,
        classification: currentClassification?.fullyQualifiedName,
      });

      setClassifications((prevClassifications) => {
        return prevClassifications.map((data) => {
          if (
            data.fullyQualifiedName ===
            currentClassification?.fullyQualifiedName
          ) {
            return {
              ...data,
              termCount: (data.termCount ?? 0) + 1,
            };
          }

          return data;
        });
      });
      classificationDetailsRef.current?.refreshClassificationTags();
    } catch (error) {
      if (
        (error as AxiosError).response?.status === HTTP_STATUS_CODE.CONFLICT
      ) {
        showErrorToast(
          t('server.entity-already-exist', {
            entity: t('label.tag'),
            entityPlural: t('label.tag-lowercase-plural'),
            name: data.name,
          })
        );
      } else {
        showErrorToast(
          error as AxiosError,
          t('server.create-entity-error', {
            entity: t('label.tag-lowercase'),
          })
        );
      }
    } finally {
      setIsAddingTag(false);
    }
  };

  const handleUpdatePrimaryTag = async (updatedData: Tag) => {
    if (!isUndefined(editTag)) {
      setIsButtonLoading(true);
      const patchData = compare(editTag, updatedData);
      try {
        await patchTag(editTag.id ?? '', patchData);
        classificationDetailsRef.current?.refreshClassificationTags();
      } catch (error) {
        if (
          (error as AxiosError).response?.status === HTTP_STATUS_CODE.CONFLICT
        ) {
          showErrorToast(
            t('server.entity-already-exist', {
              entity: t('label.tag'),
              entityPlural: t('label.tag-lowercase-plural'),
              name: updatedData.name,
            })
          );
        } else {
          showErrorToast(
            error as AxiosError,
            t('server.entity-updating-error', {
              entity: t('label.tag-lowercase'),
            })
          );
        }
      } finally {
        setIsButtonLoading(false);
        handleCancel();
      }
    }
  };

  const handleActionDeleteTag = (record: Tag) => {
    if (currentClassification) {
      setDeleteTags({
        data: {
          id: record.id as string,
          name: record.name,
          categoryName: currentClassification?.fullyQualifiedName,
          isCategory: false,
          status: 'waiting',
        },
        state: true,
      });
    }
  };

  const handleEditTagClick = (selectedTag: Tag) => {
    setIsAddingTag(true);
    setEditTag(selectedTag);
  };

  const handleAddNewTagClick = () => {
    setIsAddingTag(true);
  };

  const handleEditDescriptionClick = () => {
    setIsEditClassification(true);
  };

  const handleCancelEditDescription = () => {
    setIsEditClassification(false);
  };

  useEffect(() => {
    if (currentClassification) {
      fetchCurrentClassificationPermission();
    }
  }, [currentClassification]);

  useEffect(() => {
    /**
     * If ClassificationName is present then fetch that category
     */
    if (tagCategoryName) {
      const isTier = tagCategoryName.startsWith(TIER_CATEGORY);
      fetchCurrentClassification(isTier ? TIER_CATEGORY : tagCategoryName);
    }
  }, [tagCategoryName]);

  useEffect(() => {
    /**
     * Fetch all classifications initially
     * Do not set current if we already have currentClassification set
     */
    fetchClassifications(!tagCategoryName);
  }, []);

  const onClickClassifications = (category: Classification) => {
    setCurrentClassification(category);

    history.push(getTagPath(category.fullyQualifiedName));
  };

  const handleAddTagSubmit = async (data: SubmitProps) => {
    const updatedData = omit(data, 'color', 'iconURL');
    const style = {
      color: data.color,
      iconURL: data.iconURL,
    };
    if (editTag) {
      await handleUpdatePrimaryTag({ ...editTag, ...updatedData, style });
    } else {
      await handleCreatePrimaryTag({ ...updatedData, style });
    }
  };

  const handleCancelClassificationDelete = () =>
    setDeleteTags({ data: undefined, state: false });

  const leftPanelLayout = useMemo(
    () => (
      <LeftPanelCard id="tags">
        <TagsLeftPanelSkeleton loading={isLoading}>
          <div className="p-y-xs" data-testid="data-summary-container">
            <Space
              className="w-full p-x-sm m-b-sm"
              direction="vertical"
              size={12}>
              <Typography.Text className="text-sm font-semibold">
                {t('label.classification-plural')}
              </Typography.Text>
              <Tooltip
                title={
                  !createClassificationPermission &&
                  t('message.no-permission-for-action')
                }>
                <Button
                  block
                  className=" text-primary"
                  data-testid="add-classification"
                  disabled={!createClassificationPermission}
                  onClick={() => {
                    setIsAddingClassification((prevState) => !prevState);
                  }}>
                  <div className="d-flex items-center justify-center">
                    <PlusIcon className="anticon" />
                    <Typography.Text
                      className="p-l-xss"
                      ellipsis={{ tooltip: true }}>
                      {t('label.add-entity', {
                        entity: t('label.classification'),
                      })}
                    </Typography.Text>
                  </div>
                </Button>
              </Tooltip>
            </Space>

            {classifications.map((category: Classification) => (
              <div
                className={classNames(
                  'align-center content-box cursor-pointer text-grey-body text-body d-flex p-y-xss p-x-sm m-y-xss',
                  {
                    activeCategory:
                      currentClassification?.name === category.name,
                  }
                )}
                data-testid="side-panel-classification"
                key={category.name}
                onClick={() => onClickClassifications(category)}>
                <Typography.Paragraph
                  className="ant-typography-ellipsis-custom self-center m-b-0 tag-category"
                  data-testid="tag-name"
                  ellipsis={{ rows: 1, tooltip: true }}>
                  {getEntityName(category)}
                  {category.disabled && (
                    <Badge
                      className="m-l-xs badge-grey opacity-60"
                      count={t('label.disabled')}
                      data-testid="disabled"
                      size="small"
                    />
                  )}
                </Typography.Paragraph>

                {getCountBadge(
                  category.termCount,
                  'self-center m-l-auto',
                  currentClassification?.fullyQualifiedName ===
                    category.fullyQualifiedName
                )}
              </div>
            ))}
          </div>
        </TagsLeftPanelSkeleton>
      </LeftPanelCard>
    ),
    [
      isLoading,
      classifications,
      currentClassification,
      createClassificationPermission,
    ]
  );

  const createTagsPermission = useMemo(
    () =>
      checkPermission(Operation.Create, ResourceEntity.TAG, permissions) ||
      classificationPermissions.EditAll,
    [permissions, classificationPermissions]
  );

  const editTagsDescriptionPermission = useMemo(
    () =>
      checkPermission(
        Operation.EditDescription,
        ResourceEntity.TAG,
        permissions
      ) || classificationPermissions.EditAll,
    [permissions, classificationPermissions]
  );

  const editTagsDisplayNamePermission = useMemo(
    () =>
      checkPermission(
        Operation.EditDisplayName,
        ResourceEntity.TAG,
        permissions
      ) || classificationPermissions.EditAll,
    [permissions, classificationPermissions]
  );

  const editTagsPermission = useMemo(
    () =>
      checkPermission(Operation.EditAll, ResourceEntity.TAG, permissions) ||
      classificationPermissions.EditAll,
    [permissions, classificationPermissions]
  );

  const tagsFormPermissions = useMemo(
    () => ({
      createTags: createTagsPermission,
      editAll: editTagsPermission,
      editDescription: editTagsDescriptionPermission,
      editDisplayName: editTagsDisplayNamePermission,
    }),
    [
      createTagsPermission,
      editTagsPermission,
      editTagsDescriptionPermission,
      editTagsDisplayNamePermission,
    ]
  );

  const disableEditButton = useMemo(
    () =>
      !(
        editTagsDescriptionPermission ||
        editTagsDisplayNamePermission ||
        editTagsPermission
      ) || isClassificationDisabled,
    [
      editTagsDescriptionPermission,
      editTagsDisplayNamePermission,
      editTagsPermission,
      isClassificationDisabled,
    ]
  );

  const tagsFormHeader = useMemo(
    () =>
      editTag
        ? t('label.edit-entity', {
            entity: t('label.tag'),
          })
        : t('message.adding-new-tag', {
            categoryName:
              currentClassification?.displayName ?? currentClassification?.name,
          }),
    [editTag, currentClassification]
  );

  if (isLoading) {
    return <Loader />;
  }
  if (error) {
    return (
      <ErrorPlaceHolder>
        <Typography.Paragraph className="text-center m-auto">
          {error}
        </Typography.Paragraph>
      </ErrorPlaceHolder>
    );
  }

  return (
    <PageLayoutV1 leftPanel={leftPanelLayout} pageTitle={t('label.tag-plural')}>
      {isUpdateLoading ? (
        <Loader />
      ) : (
        <ClassificationDetails
          classificationPermissions={classificationPermissions}
          currentClassification={currentClassification}
          deleteTags={deleteTags}
          disableEditButton={disableEditButton}
          handleActionDeleteTag={handleActionDeleteTag}
          handleAddNewTagClick={handleAddNewTagClick}
          handleAfterDeleteAction={handleAfterDeleteAction}
          handleCancelEditDescription={handleCancelEditDescription}
          handleEditDescriptionClick={handleEditDescriptionClick}
          handleEditTagClick={handleEditTagClick}
          handleUpdateClassification={handleUpdateClassification}
          isAddingTag={isAddingTag}
          isEditClassification={isEditClassification}
          ref={classificationDetailsRef}
        />
      )}

      {/* Classification Form */}
      {isAddingClassification && (
        <TagsForm
          isClassification
          showMutuallyExclusive
          data={classifications}
          header={t('label.adding-new-classification')}
          isEditing={false}
          isLoading={isButtonLoading}
          isTier={isTier}
          visible={isAddingClassification}
          onCancel={handleCancel}
          onSubmit={handleCreateClassification}
        />
      )}

      {/* Tags Form */}
      {isAddingTag && (
        <TagsForm
          header={tagsFormHeader}
          initialValues={editTag}
          isEditing={!isUndefined(editTag)}
          isLoading={isButtonLoading}
          isSystemTag={editTag?.provider === ProviderType.System}
          isTier={isTier}
          permissions={tagsFormPermissions}
          visible={isAddingTag}
          onCancel={handleCancel}
          onSubmit={handleAddTagSubmit}
        />
      )}

      <EntityDeleteModal
        bodyText={getEntityDeleteMessage(deleteTags.data?.name ?? '', '')}
        entityName={deleteTags.data?.name ?? ''}
        entityType={t('label.classification')}
        visible={deleteTags.state}
        onCancel={handleCancelClassificationDelete}
        onConfirm={handleConfirmClick}
      />
    </PageLayoutV1>
  );
};

export default TagsPage;
