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

import { Badge, Button, Stack, Typography, useTheme } from '@mui/material';
import { useForm } from 'antd/lib/form/Form';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as PlusIcon } from '../../assets/svg/plus-primary.svg';
import ClassificationDetails from '../../components/Classifications/ClassificationDetails/ClassificationDetails';
import { ClassificationDetailsRef } from '../../components/Classifications/ClassificationDetails/ClassificationDetails.interface';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import ResizableLeftPanels from '../../components/common/ResizablePanels/ResizableLeftPanels';
import TagsLeftPanelSkeleton from '../../components/common/Skeleton/Tags/TagsLeftPanelSkeleton.component';
import EntityDeleteModal from '../../components/Modals/EntityDeleteModal/EntityDeleteModal';
import { HTTP_STATUS_CODE } from '../../constants/Auth.constants';
import { TIER_CATEGORY } from '../../constants/constants';
import { LEARNING_PAGE_IDS } from '../../constants/Learning.constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { TabSpecificField } from '../../enums/entity.enum';
import { CreateClassification } from '../../generated/api/classification/createClassification';
import { CreateTag } from '../../generated/api/classification/createTag';
import { Classification } from '../../generated/entity/classification/classification';
import { Tag } from '../../generated/entity/classification/tag';
import { Operation } from '../../generated/entity/policies/accessControl/rule';
import { withPageLayout } from '../../hoc/withPageLayout';
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
import tagClassBase from '../../utils/TagClassBase';
import { showErrorToast } from '../../utils/ToastUtils';
import ClassificationFormDrawer from './ClassificationFormDrawer';
import TagFormDrawer from './TagFormDrawer';
import { DeleteTagsType } from './TagsPage.interface';

const TagsPage = () => {
  const { getEntityPermission, permissions } = usePermissionProvider();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const { fqn: tagCategoryName } = useFqn();
  const [tagForm] = useForm();
  const [classificationForm] = useForm();
  const [classifications, setClassifications] = useState<Array<Classification>>(
    []
  );
  const [currentClassification, setCurrentClassification] =
    useState<Classification>();
  const [editTag, setEditTag] = useState<Tag>();
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isClassificationLoading, setIsClassificationLoading] =
    useState<boolean>(false);
  const [isTagFormLoading, setIsTagFormLoading] = useState<boolean>(false);
  const [isClassificationFormLoading, setIsClassificationFormLoading] =
    useState<boolean>(false);
  const [isTagDrawerOpen, setIsTagDrawerOpen] = useState<boolean>(false);
  const [isClassificationDrawerOpen, setIsClassificationDrawerOpen] =
    useState<boolean>(false);
  const classificationDetailsRef = useRef<ClassificationDetailsRef>(null);

  const [deleteTags, setDeleteTags] = useState<DeleteTagsType>({
    data: undefined,
    state: false,
  });
  const [classificationPermissions, setClassificationPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

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
        fields: [
          TabSpecificField.TERM_COUNT,
          TabSpecificField.OWNERS,
          TabSpecificField.DOMAINS,
        ],
        limit: 1000,
      });
      setClassifications(response.data);
      if (setCurrent && response.data.length) {
        setCurrentClassification(response.data[0]);

        navigate(getTagPath(response.data[0].fullyQualifiedName));
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

  const fetchCurrentClassification = async (fqn: string) => {
    setIsClassificationLoading(true);
    try {
      const currentClassification = await getClassificationByName(fqn, {
        fields: tagClassBase.getClassificationFields(),
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
      setCurrentClassification(undefined);
    } finally {
      setIsClassificationLoading(false);
    }
  };

  const handleCreateClassification = async (data: CreateClassification) => {
    try {
      const res = await createClassification(data);
      await fetchClassifications();
      navigate(getTagPath(res.fullyQualifiedName));
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
    }
  };

  const handleAfterDeleteAction = useCallback(() => {
    if (!isUndefined(currentClassification)) {
      const renamingClassification = [...classifications].filter(
        (data) => data.id !== currentClassification.id
      );
      const updatedCurrentClassification = renamingClassification[0];
      setClassifications(renamingClassification);
      navigate(
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
        t('server.delete-entity-error', {
          entity: t('label.tag-lowercase'),
        })
      );
    } finally {
      setDeleteTags({ data: undefined, state: false });
    }
  };

  /**
   * It redirects to respective function call based on tag/Classification
   */
  const handleConfirmClick = useCallback(async () => {
    if (deleteTags.data?.id) {
      await handleDeleteTag(deleteTags.data.id);
    }
  }, [deleteTags.data?.id, handleDeleteTag]);

  const handleUpdateClassification = useCallback(
    async (updatedClassification: Classification) => {
      if (!isUndefined(currentClassification)) {
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
            navigate(getTagPath(response.fullyQualifiedName));
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
        }
      }
    },
    [currentClassification, history]
  );

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
    }
  };

  const handleUpdatePrimaryTag = async (updatedData: Tag) => {
    if (!isUndefined(editTag)) {
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
      }
    }
  };

  const handleActionDeleteTag = useCallback(
    (record: Tag) => {
      if (currentClassification) {
        setDeleteTags({
          data: {
            id: record.id,
            name: record.name,
            categoryName: currentClassification?.fullyQualifiedName,
            isCategory: false,
            status: 'waiting',
          },
          state: true,
        });
      }
    },
    [currentClassification]
  );

  const handleToggleDisable = useCallback(async (tag: Tag) => {
    try {
      const updatedTag = {
        ...tag,
        disabled: !tag.disabled,
      };
      const patchData = compare(tag, updatedTag);
      await patchTag(tag.id ?? '', patchData);
      classificationDetailsRef.current?.refreshClassificationTags();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-updating-error', {
          entity: t('label.tag-lowercase'),
        })
      );
    }
  }, []);

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
    navigate(getTagPath(category.fullyQualifiedName));
  };

  const handleAddTagSubmit = useCallback(
    async (data: CreateTag | Tag) => {
      if (editTag) {
        await handleUpdatePrimaryTag({ ...editTag, ...data } as Tag);
      } else {
        await handleCreatePrimaryTag(data as CreateTag);
      }
    },
    [editTag, handleUpdatePrimaryTag, handleCreatePrimaryTag]
  );

  const handleCancelClassificationDelete = useCallback(() => {
    setDeleteTags({ data: undefined, state: false });
  }, []);

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
            categoryName: getEntityName(currentClassification),
          }),
    [editTag, currentClassification]
  );

  const handleTagDrawerClose = useCallback(() => {
    setIsTagDrawerOpen(false);
    tagForm.resetFields();
    setEditTag(undefined);
  }, [tagForm]);

  const handleTagDrawerOpen = useCallback(() => {
    setIsTagDrawerOpen(true);
  }, []);

  const handleClassificationDrawerClose = useCallback(() => {
    setIsClassificationDrawerOpen(false);
    classificationForm.resetFields();
  }, [classificationForm]);

  const handleClassificationDrawerOpen = useCallback(() => {
    setIsClassificationDrawerOpen(true);
    classificationForm.resetFields();
  }, [classificationForm]);

  const handleTagFormSubmit = useCallback(
    async (formData: CreateTag) => {
      setIsTagFormLoading(true);
      try {
        await handleAddTagSubmit(formData);
        handleTagDrawerClose();
      } finally {
        setIsTagFormLoading(false);
      }
    },
    [handleAddTagSubmit, handleTagDrawerClose]
  );

  const handleClassificationFormSubmit = useCallback(
    async (formData: CreateClassification) => {
      setIsClassificationFormLoading(true);
      try {
        await handleCreateClassification(formData);
        handleClassificationDrawerClose();
      } finally {
        setIsClassificationFormLoading(false);
      }
    },
    [handleCreateClassification, handleClassificationDrawerClose]
  );

  const handleEditTagClick = useCallback(
    (selectedTag: Tag) => {
      setEditTag(selectedTag);
      handleTagDrawerOpen();
    },
    [handleTagDrawerOpen]
  );

  const handleAddNewTagClick = useCallback(() => {
    setEditTag(undefined);
    tagForm.resetFields();
    handleTagDrawerOpen();
  }, [handleTagDrawerOpen, tagForm]);

  const leftPanelLayout = useMemo(
    () => (
      <div className="h-full" data-testid="tags-left-panel">
        <TagsLeftPanelSkeleton loading={isLoading}>
          <div className="p-y-xs" data-testid="data-summary-container">
            <Stack
              className="w-full p-x-sm m-b-sm"
              direction="column"
              spacing={2}>
              {createClassificationPermission && (
                <Button
                  fullWidth
                  className="text-primary"
                  data-testid="add-classification"
                  startIcon={<PlusIcon style={{ height: 16, width: 16 }} />}
                  sx={{
                    fontWeight: theme.typography.body2.fontWeight,
                    border: `1px solid ${theme.palette.allShades.blueGray[100]}`,
                    boxShadow: 'none',
                    '&:hover': {
                      boxShadow: 'none',
                      backgroundColor: 'transparent',
                      border: `1px solid ${theme.palette.allShades.brand[500]}`,
                    },
                  }}
                  variant="outlined"
                  onClick={() => {
                    classificationForm.resetFields();
                    handleClassificationDrawerOpen();
                  }}>
                  {t('label.add-entity', {
                    entity: t('label.classification'),
                  })}
                </Button>
              )}
            </Stack>

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
                <Typography
                  noWrap
                  className="self-center m-b-0 tag-category"
                  data-testid="tag-name"
                  sx={{
                    fontWeight:
                      currentClassification?.name === category.name
                        ? theme.typography.fontWeightBold
                        : 'inherit',
                    color:
                      currentClassification?.name === category.name
                        ? 'primary.main'
                        : 'inherit',
                  }}
                  title={getEntityName(category)}
                  variant="body2">
                  {getEntityName(category)}
                  {category.disabled && (
                    <Badge
                      badgeContent={t('label.disabled')}
                      className="m-l-xs"
                      color="default"
                      data-testid="disabled"
                      sx={{
                        '& .MuiBadge-badge': {
                          position: 'relative',
                          transform: 'none',
                          height: 'auto',
                          padding: '2px 8px',
                          color: theme.palette.grey[700],
                          backgroundColor: theme.palette.grey[300],
                          fontSize: theme.typography.caption.fontSize,
                        },
                      }}
                    />
                  )}
                </Typography>

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
      </div>
    ),
    [
      isLoading,
      classifications,
      currentClassification,
      createClassificationPermission,
      handleClassificationDrawerOpen,
      classificationForm,
      t,
    ]
  );

  if (isLoading) {
    return <Loader />;
  }
  if (error) {
    return (
      <ErrorPlaceHolder>
        <Typography className="text-center m-auto" component="p">
          {error}
        </Typography>
      </ErrorPlaceHolder>
    );
  }

  return (
    <div>
      <ResizableLeftPanels
        showLearningIcon
        className="content-height-with-resizable-panel"
        firstPanel={{
          className: 'content-resizable-panel-container',
          minWidth: 280,
          flex: 0.13,
          children: leftPanelLayout,
          title: t('label.classification-plural'),
        }}
        learningPageId={LEARNING_PAGE_IDS.CLASSIFICATION}
        learningTitle={t('label.classification-plural')}
        pageTitle={getEntityName(currentClassification)}
        secondPanel={{
          children: (
            <>
              <ClassificationDetails
                classificationPermissions={classificationPermissions}
                currentClassification={currentClassification}
                deleteTags={deleteTags}
                disableEditButton={disableEditButton}
                handleActionDeleteTag={handleActionDeleteTag}
                handleAddNewTagClick={handleAddNewTagClick}
                handleAfterDeleteAction={handleAfterDeleteAction}
                handleEditTagClick={handleEditTagClick}
                handleToggleDisable={handleToggleDisable}
                handleUpdateClassification={handleUpdateClassification}
                isAddingTag={false}
                isClassificationLoading={isClassificationLoading}
                ref={classificationDetailsRef}
              />

              <EntityDeleteModal
                bodyText={getEntityDeleteMessage(
                  deleteTags.data?.name ?? '',
                  ''
                )}
                entityName={deleteTags.data?.name ?? ''}
                entityType={t('label.classification')}
                visible={deleteTags.state}
                onCancel={handleCancelClassificationDelete}
                onConfirm={handleConfirmClick}
              />
            </>
          ),
          className: 'content-resizable-panel-container',
          minWidth: 800,
          flex: 0.87,
        }}
      />

      <TagFormDrawer
        editTag={editTag}
        formRef={tagForm}
        isLoading={isTagFormLoading}
        isTier={isTier}
        open={isTagDrawerOpen}
        permissions={tagsFormPermissions}
        tagsFormHeader={tagsFormHeader}
        onClose={handleTagDrawerClose}
        onSubmit={handleTagFormSubmit}
      />

      <ClassificationFormDrawer
        classifications={classifications}
        formRef={classificationForm}
        isLoading={isClassificationFormLoading}
        isTier={isTier}
        open={isClassificationDrawerOpen}
        onClose={handleClassificationDrawerClose}
        onSubmit={handleClassificationFormSubmit}
      />
    </div>
  );
};

export default withPageLayout(TagsPage);
