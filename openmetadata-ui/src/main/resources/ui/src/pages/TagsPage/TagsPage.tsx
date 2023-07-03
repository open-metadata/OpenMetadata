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

import {
  Badge,
  Button,
  Col,
  Row,
  Space,
  Spin,
  Switch,
  Table,
  Tooltip,
  Typography,
} from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { ReactComponent as IconTag } from 'assets/svg/classification.svg';
import { ReactComponent as LockIcon } from 'assets/svg/closed-lock.svg';
import { ReactComponent as IconDisableTag } from 'assets/svg/disable-tag.svg';
import { ReactComponent as EditIcon } from 'assets/svg/edit-new.svg';
import { AxiosError } from 'axios';
import AppBadge from 'components/common/Badge/Badge.component';
import Description from 'components/common/description/Description';
import ManageButton from 'components/common/entityPageInfo/ManageButton/ManageButton';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import LeftPanelCard from 'components/common/LeftPanelCard/LeftPanelCard';
import NextPrevious from 'components/common/next-previous/NextPrevious';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import EntityHeaderTitle from 'components/Entity/EntityHeaderTitle/EntityHeaderTitle.component';
import Loader from 'components/Loader/Loader';
import EntityDeleteModal from 'components/Modals/EntityDeleteModal/EntityDeleteModal';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import TagsLeftPanelSkeleton from 'components/Skeleton/Tags/TagsLeftPanelSkeleton.component';
import { HTTP_STATUS_CODE } from 'constants/auth.constants';
import { LOADING_STATE } from 'enums/common.enum';
import { EntityType } from 'enums/entity.enum';
import { compare } from 'fast-json-patch';
import { CreateTag } from 'generated/api/classification/createTag';
import { capitalize, isUndefined } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory, useParams } from 'react-router-dom';
import {
  createClassification,
  createTag,
  deleteTag,
  getAllClassifications,
  getClassificationByName,
  getTags,
  patchClassification,
  patchTag,
} from 'rest/tagAPI';
import { getEntityName } from 'utils/EntityUtils';
import { getDeleteIcon, getUsageCountLink } from 'utils/TagsUtils';
import { ReactComponent as PlusIcon } from '../../assets/svg/plus-primary.svg';
import {
  DE_ACTIVE_COLOR,
  INITIAL_PAGING_VALUE,
  NO_DATA_PLACEHOLDER,
  PAGE_SIZE,
  TIER_CATEGORY,
} from '../../constants/constants';
import { CreateClassification } from '../../generated/api/classification/createClassification';
import { ProviderType } from '../../generated/entity/bot';
import { Classification } from '../../generated/entity/classification/classification';
import { Tag } from '../../generated/entity/classification/tag';
import { Operation } from '../../generated/entity/policies/accessControl/rule';
import { Paging } from '../../generated/type/paging';
import {
  getActiveCatClass,
  getCountBadge,
  getEntityDeleteMessage,
} from '../../utils/CommonUtils';
import {
  checkPermission,
  DEFAULT_ENTITY_PERMISSION,
} from '../../utils/PermissionsUtils';
import { getTagPath } from '../../utils/RouterUtils';
import { getErrorText } from '../../utils/StringsUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import TagsForm from './TagsForm';
import { DeleteTagsType } from './TagsPage.interface';

const TagsPage = () => {
  const { getEntityPermission, permissions } = usePermissionProvider();
  const history = useHistory();
  const { tagCategoryName } = useParams<Record<string, string>>();
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

  const [deleteTags, setDeleteTags] = useState<DeleteTagsType>({
    data: undefined,
    state: false,
  });
  const [classificationPermissions, setClassificationPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [currentClassificationName, setCurrentClassificationName] =
    useState<string>('');
  const [tags, setTags] = useState<Tag[]>();
  const [paging, setPaging] = useState<Paging>({} as Paging);
  const [currentPage, setCurrentPage] = useState<number>(INITIAL_PAGING_VALUE);
  const [isTagsLoading, setIsTagsLoading] = useState(false);
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
  const [deleteStatus, setDeleteStatus] = useState<LOADING_STATE>(
    LOADING_STATE.INITIAL
  );

  const isTier = useMemo(
    () => currentClassification?.name === 'Tier',
    [currentClassification]
  );

  const createTagPermission = useMemo(
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

  const createTagsPermission = useMemo(
    () =>
      checkPermission(Operation.Create, ResourceEntity.TAG, permissions) ||
      classificationPermissions.EditAll,
    [permissions, classificationPermissions]
  );

  const editClassificationPermission = useMemo(
    () => classificationPermissions.EditAll,
    [classificationPermissions]
  );

  const isClassificationDisabled = useMemo(
    () => currentClassification?.disabled ?? false,
    [currentClassification]
  );

  const fetchCurrentClassificationPermission = async () => {
    try {
      const response = await getEntityPermission(
        ResourceEntity.CLASSIFICATION,
        currentClassification?.id as string
      );
      setClassificationPermissions(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchClassificationChildren = async (
    currentClassificationName: string,
    paging?: Paging
  ) => {
    setIsTagsLoading(true);

    try {
      const tagsResponse = await getTags({
        arrQueryFields: ['usageCount'],
        parent: currentClassificationName,
        after: paging?.after,
        before: paging?.before,
        limit: PAGE_SIZE,
      });
      setTags(tagsResponse.data);
      setPaging(tagsResponse.paging);
    } catch (error) {
      const errMsg = getErrorText(
        error as AxiosError,
        t('server.entity-fetch-error', { entity: t('label.tag-plural') })
      );
      showErrorToast(errMsg);
      setError(errMsg);
      setTags([]);
    } finally {
      setIsTagsLoading(false);
    }
  };

  const fetchClassifications = async (setCurrent?: boolean) => {
    setIsLoading(true);

    try {
      const response = await getAllClassifications(['termCount'], 1000);
      setClassifications(response.data);
      if (setCurrent && response.data.length) {
        setCurrentClassification(response.data[0]);
        setCurrentClassificationName(response.data[0].name);

        history.push(getTagPath(response.data[0].name));
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

  const fetchCurrentClassification = async (name: string, update?: boolean) => {
    if (currentClassification?.name !== name || update) {
      setIsLoading(true);
      try {
        const currentClassification = await getClassificationByName(name, [
          'usageCount',
          'termCount',
        ]);
        if (currentClassification) {
          setClassifications((prevClassifications) =>
            prevClassifications.map((data) => {
              if (data.name === name) {
                return {
                  ...data,
                  termCount: currentClassification.termCount,
                };
              }

              return data;
            })
          );
          setCurrentClassification(currentClassification);
          setCurrentClassificationName(currentClassification.name);
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
        setCurrentClassification({ name, description: '' });
        setIsLoading(false);
      }
    }
  };

  const handleCreateClassification = async (data: CreateClassification) => {
    setIsButtonLoading(true);
    try {
      const res = await createClassification(data);
      await fetchClassifications();
      history.push(getTagPath(res.name));
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
  const handleDeleteTag = (tagId: string) => {
    deleteTag(tagId)
      .then((res) => {
        if (res) {
          if (currentClassification) {
            setDeleteStatus(LOADING_STATE.SUCCESS);
            setCurrentClassification({
              ...currentClassification,
            });
          }
        } else {
          showErrorToast(
            t('server.delete-entity-error', {
              entity: t('label.tag-lowercase'),
            })
          );
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          t('server.delete-entity-error', { entity: t('label.tag-lowercase') })
        );
      })
      .finally(() => {
        setDeleteTags({ data: undefined, state: false });
        setDeleteStatus(LOADING_STATE.INITIAL);
      });
  };

  /**
   * It redirects to respective function call based on tag/Classification
   */
  const handleConfirmClick = () => {
    if (deleteTags.data?.id) {
      setDeleteStatus(LOADING_STATE.WAITING);
      handleDeleteTag(deleteTags.data.id);
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
        if (response) {
          fetchClassifications();
          if (currentClassification?.name !== updatedClassification.name) {
            history.push(getTagPath(response.name));
          } else {
            await fetchCurrentClassification(currentClassification?.name, true);
          }
        } else {
          throw t('server.unexpected-response');
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

  const handleUpdateDisplayName = (data: {
    name: string;
    displayName: string;
  }) => {
    if (!isUndefined(currentClassification)) {
      return handleUpdateClassification({
        ...currentClassification,
        ...data,
      });
    }

    return new Promise<void>((resolve) => resolve());
  };

  const handleUpdateDescription = async (updatedHTML: string) => {
    if (!isUndefined(currentClassification)) {
      handleUpdateClassification({
        ...currentClassification,
        description: updatedHTML,
      });
    }
  };

  const handleEnableDisableClassificationClick = useCallback(() => {
    if (!isUndefined(currentClassification)) {
      handleUpdateClassification({
        ...currentClassification,
        disabled: !isClassificationDisabled,
      });
    }
  }, [
    currentClassification,
    handleUpdateClassification,
    isClassificationDisabled,
  ]);

  const handleUpdateMutuallyExclusive = async (value: boolean) => {
    if (!isUndefined(currentClassification)) {
      handleUpdateClassification({
        ...currentClassification,
        mutuallyExclusive: value,
      });
    }
  };

  const handleCreatePrimaryTag = async (data: CreateTag) => {
    try {
      await createTag({
        ...data,
        classification: currentClassification?.name ?? '',
      });

      fetchCurrentClassification(currentClassification?.name as string, true);
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
        const response = await patchTag(editTag.id ?? '', patchData);
        if (response) {
          fetchCurrentClassification(
            currentClassification?.name as string,
            true
          );
        } else {
          throw t('server.unexpected-response');
        }
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
          categoryName: currentClassification?.name,
          isCategory: false,
          status: 'waiting',
        },
        state: true,
      });
    }
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

  useEffect(() => {
    currentClassification &&
      fetchClassificationChildren(currentClassification?.name);
  }, [currentClassification]);

  const onClickClassifications = (category: Classification) => {
    setCurrentClassification(category);
    setCurrentClassificationName(category.name);
    history.push(getTagPath(category.name));
  };

  const handlePageChange = useCallback(
    (cursorType: string | number, activePage?: number) => {
      if (cursorType) {
        const pagination = {
          [cursorType]: paging[cursorType as keyof Paging] as string,
          total: paging.total,
        } as Paging;

        setCurrentPage(activePage ?? INITIAL_PAGING_VALUE);
        fetchClassificationChildren(currentClassificationName, pagination);
      }
    },
    [fetchClassificationChildren, paging, currentClassificationName]
  );

  // Use the component in the render method

  const fetchLeftPanel = () => {
    return (
      <LeftPanelCard id="tags">
        <TagsLeftPanelSkeleton loading={isLoading}>
          <div className="tw-py-2" data-testid="data-summary-container">
            <div className="tw-px-3">
              <h6 className="tw-heading tw-text-sm tw-font-semibold">
                {t('label.classification-plural')}
              </h6>
              <div className="tw-mb-3">
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
                    icon={<PlusIcon className="anticon" />}
                    onClick={() => {
                      setIsAddingClassification((prevState) => !prevState);
                    }}>
                    <span>
                      {t('label.add-entity', {
                        entity: t('label.classification'),
                      })}
                    </span>
                  </Button>
                </Tooltip>
              </div>
            </div>

            {classifications.map((category: Classification) => (
              <div
                className={`tw-group align-center content-box cursor-pointer tw-text-grey-body tw-text-body d-flex p-y-xss p-x-sm m-y-xss ${getActiveCatClass(
                  category.name,
                  currentClassification?.name
                )}`}
                data-testid="side-panel-classification"
                key={category.name}
                onClick={() => onClickClassifications(category)}>
                <Typography.Paragraph
                  className="ant-typography-ellipsis-custom tag-category label-category self-center"
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
                  currentClassification?.name === category.name
                )}
              </div>
            ))}
          </div>
        </TagsLeftPanelSkeleton>
      </LeftPanelCard>
    );
  };

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

  const shouldDisableDeleteButton = useCallback(
    (record: Tag) =>
      record.provider === ProviderType.System ||
      !classificationPermissions.EditAll ||
      isClassificationDisabled,
    [classificationPermissions, isClassificationDisabled]
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

  const tableColumn = useMemo(
    () =>
      [
        {
          title: t('label.tag'),
          dataIndex: 'name',
          key: 'name',
          width: 200,
          render: (_, record) => (
            <Space>
              <Typography.Text>{record.name}</Typography.Text>
              {record.disabled ? (
                <Badge
                  className="m-l-xs badge-grey"
                  count={t('label.disabled')}
                  data-testid="disabled"
                />
              ) : null}
            </Space>
          ),
        },
        {
          title: t('label.display-name'),
          dataIndex: 'displayName',
          key: 'displayName',
          width: 200,
          render: (text) => (
            <Typography.Text>{text || NO_DATA_PLACEHOLDER}</Typography.Text>
          ),
        },
        {
          title: t('label.description'),
          dataIndex: 'description',
          key: 'description',
          render: (text: string, record: Tag) => (
            <>
              <div className="cursor-pointer d-flex">
                <div>
                  {text ? (
                    <RichTextEditorPreviewer markdown={text} />
                  ) : (
                    <span className="text-grey-muted">
                      {t('label.no-entity', {
                        entity: t('label.description'),
                      })}
                    </span>
                  )}
                </div>
              </div>
              <div className="tw-mt-1" data-testid="usage">
                <span className="text-grey-muted tw-mr-1">
                  {`${t('label.usage')}:`}
                </span>
                {record.usageCount ? (
                  <Link
                    className="link-text tw-align-middle"
                    data-testid="usage-count"
                    to={getUsageCountLink(record.fullyQualifiedName ?? '')}>
                    {record.usageCount}
                  </Link>
                ) : (
                  <span className="text-grey-muted">{t('label.not-used')}</span>
                )}
              </div>
            </>
          ),
        },
        {
          title: t('label.action-plural'),
          dataIndex: 'actions',
          key: 'actions',
          width: 120,
          align: 'center',
          render: (_, record: Tag) => {
            const disableDeleteButton = shouldDisableDeleteButton(record);
            let disabledDeleteMessage: string = t(
              'message.no-permission-for-action'
            );

            if (isClassificationDisabled) {
              disabledDeleteMessage = t(
                'message.disabled-classification-actions-message'
              );
            } else if (record.provider === ProviderType.System) {
              disabledDeleteMessage = t(
                'message.system-tag-delete-disable-message'
              );
            }

            return (
              <Space align="center" size={8}>
                <Tooltip
                  placement="topRight"
                  title={
                    disableEditButton &&
                    (isClassificationDisabled
                      ? t('message.disabled-classification-actions-message')
                      : t('message.no-permission-for-action'))
                  }>
                  <Button
                    className="p-0 flex-center"
                    data-testid="edit-button"
                    disabled={disableEditButton}
                    icon={
                      <EditIcon
                        data-testid="editTagDescription"
                        height={16}
                        name="edit"
                        width={16}
                      />
                    }
                    size="small"
                    type="text"
                    onClick={() => {
                      setIsAddingTag(true);
                      setEditTag(record);
                    }}
                  />
                </Tooltip>

                <Tooltip
                  placement="topRight"
                  title={disableDeleteButton && disabledDeleteMessage}>
                  <Button
                    className="p-0 flex-center"
                    data-testid="delete-tag"
                    disabled={disableDeleteButton}
                    icon={getDeleteIcon({
                      deleteTagId: deleteTags.data?.id,
                      status: deleteTags.data?.status,
                      id: record.id ?? '',
                    })}
                    size="small"
                    type="text"
                    onClick={() => handleActionDeleteTag(record)}
                  />
                </Tooltip>
              </Space>
            );
          },
        },
      ] as ColumnsType<Tag>,
    [
      currentClassification,
      classificationPermissions,
      deleteTags,
      tags,
      deleteTags,
    ]
  );

  const isSystemClassification = useMemo(
    () => currentClassification?.provider === ProviderType.System,
    [currentClassification]
  );

  const createPermission = useMemo(
    () => createTagPermission || classificationPermissions.EditAll,
    [classificationPermissions, createTagPermission]
  );

  const deletePermission = useMemo(
    () => classificationPermissions.Delete && !isSystemClassification,
    [classificationPermissions, isSystemClassification]
  );

  const editDisplayNamePermission = useMemo(
    () =>
      classificationPermissions.EditAll ||
      classificationPermissions.EditDisplayName,
    [classificationPermissions]
  );

  const editDescriptionPermission = useMemo(
    () =>
      classificationPermissions.EditAll ||
      classificationPermissions.EditDescription,
    [classificationPermissions]
  );

  const headerBadge = useMemo(
    () =>
      isSystemClassification ? (
        <AppBadge
          icon={<LockIcon height={12} />}
          label={capitalize(currentClassification?.provider)}
        />
      ) : null,
    [isSystemClassification, currentClassification]
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

  const showDisableOption = useMemo(
    () => !isTier && isSystemClassification && editClassificationPermission,
    [isTier, isSystemClassification, editClassificationPermission]
  );

  const showManageButton = useMemo(
    () => editDisplayNamePermission || deletePermission || showDisableOption,
    [editDisplayNamePermission, deletePermission, showDisableOption]
  );

  const addTagButtonToolTip = useMemo(() => {
    if (isClassificationDisabled) {
      return t('message.disabled-classification-actions-message');
    }
    if (!createPermission) {
      return t('message.no-permission-for-action');
    }

    return null;
  }, [createPermission, isClassificationDisabled]);

  const extraDropdownContent = useMemo(
    () => [
      ...(showDisableOption
        ? [
            {
              label: (
                <Row
                  className="cursor-pointer"
                  onClick={handleEnableDisableClassificationClick}>
                  <Col className="self-center" span={3}>
                    <IconDisableTag color={DE_ACTIVE_COLOR} width="18px" />
                  </Col>
                  <Col
                    className="text-left"
                    data-testid="disable-button"
                    span={21}>
                    <p
                      className="font-medium"
                      data-testid="disable-button-title">
                      {isClassificationDisabled
                        ? t('label.enable')
                        : t('label.disable')}
                    </p>
                    <p className="text-grey-muted text-xs">
                      {isClassificationDisabled
                        ? t('message.enable-classification-description')
                        : t('message.disable-classification-description')}
                    </p>
                  </Col>
                </Row>
              ),
              key: 'disable-button',
            },
          ]
        : []),
    ],
    [
      isClassificationDisabled,
      showDisableOption,
      handleEnableDisableClassificationClick,
      currentClassification,
    ]
  );

  if (isLoading) {
    return <Loader />;
  }

  if (error) {
    return (
      <ErrorPlaceHolder>
        <Typography.Paragraph className="tw-text-center tw-m-auto">
          {error}
        </Typography.Paragraph>
      </ErrorPlaceHolder>
    );
  }

  return (
    <PageLayoutV1
      leftPanel={fetchLeftPanel()}
      pageTitle={t('label.tag-plural')}>
      {isUpdateLoading ? (
        <Loader />
      ) : (
        <div className="p-x-md" data-testid="tags-container">
          {currentClassification && (
            <Row data-testid="header" wrap={false}>
              <Col flex="auto">
                <EntityHeaderTitle
                  badge={headerBadge}
                  className={isClassificationDisabled ? 'opacity-60' : ''}
                  displayName={currentClassification.displayName}
                  icon={
                    <IconTag
                      className="h-9"
                      style={{ color: DE_ACTIVE_COLOR }}
                    />
                  }
                  isDisabled={isClassificationDisabled}
                  name={currentClassification.name}
                  serviceName="classification"
                />
              </Col>

              <Col className="d-flex justify-end items-start" flex="270px">
                <Space>
                  {createPermission && (
                    <Tooltip title={addTagButtonToolTip}>
                      <Button
                        data-testid="add-new-tag-button"
                        disabled={isClassificationDisabled}
                        type="primary"
                        onClick={() => {
                          setIsAddingTag((prevState) => !prevState);
                        }}>
                        {t('label.add-entity', {
                          entity: t('label.tag'),
                        })}
                      </Button>
                    </Tooltip>
                  )}

                  {showManageButton && (
                    <ManageButton
                      isRecursiveDelete
                      afterDeleteAction={handleAfterDeleteAction}
                      allowRename={!isSystemClassification}
                      allowSoftDelete={false}
                      canDelete={deletePermission && !isClassificationDisabled}
                      displayName={
                        currentClassification.displayName ??
                        currentClassification.name
                      }
                      editDisplayNamePermission={
                        editDisplayNamePermission && !isClassificationDisabled
                      }
                      entityFQN={currentClassification.fullyQualifiedName}
                      entityId={currentClassification.id}
                      entityName={currentClassification.name}
                      entityType={EntityType.CLASSIFICATION}
                      extraDropdownContent={extraDropdownContent}
                      onEditDisplayName={handleUpdateDisplayName}
                    />
                  )}
                </Space>
              </Col>
            </Row>
          )}

          <div className="m-b-sm m-t-xs" data-testid="description-container">
            <Description
              className={isClassificationDisabled ? 'opacity-60' : ''}
              description={currentClassification?.description ?? ''}
              entityName={
                currentClassification?.displayName ??
                currentClassification?.name
              }
              hasEditAccess={
                editDescriptionPermission && !isClassificationDisabled
              }
              isEdit={isEditClassification}
              onCancel={() => setIsEditClassification(false)}
              onDescriptionEdit={() => setIsEditClassification(true)}
              onDescriptionUpdate={handleUpdateDescription}
            />
          </div>

          <div
            className="m-b-md m-t-xs d-flex justify-end"
            data-testid="mutually-exclusive-container">
            <Space align="center" size="small">
              <Typography.Text
                className="text-grey-muted"
                data-testid="mutually-exclusive-classification-label">
                {t('label.mutually-exclusive')}
              </Typography.Text>

              <Switch
                checked={currentClassification?.mutuallyExclusive}
                data-testid="mutually-exclusive-classification-button"
                disabled={isClassificationDisabled}
                onChange={handleUpdateMutuallyExclusive}
              />
            </Space>
          </div>

          <Table
            bordered
            className={isClassificationDisabled ? 'opacity-60' : ''}
            columns={tableColumn}
            data-testid="table"
            dataSource={tags}
            loading={{
              indicator: (
                <Spin indicator={<Loader size="small" />} size="small" />
              ),
              spinning: isTagsLoading,
            }}
            pagination={false}
            rowClassName={(record) => (record.disabled ? 'opacity-60' : '')}
            rowKey="id"
            size="small"
          />
          {paging.total > PAGE_SIZE && (
            <NextPrevious
              currentPage={currentPage}
              pageSize={PAGE_SIZE}
              paging={paging}
              pagingHandler={handlePageChange}
              totalCount={paging.total}
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
              onSubmit={(data) => {
                if (editTag) {
                  handleUpdatePrimaryTag({ ...editTag, ...data });
                } else {
                  handleCreatePrimaryTag(data);
                }
              }}
            />
          )}

          <EntityDeleteModal
            bodyText={getEntityDeleteMessage(deleteTags.data?.name ?? '', '')}
            entityName={deleteTags.data?.name ?? ''}
            entityType={t('label.classification')}
            loadingState={deleteStatus}
            visible={deleteTags.state}
            onCancel={() => setDeleteTags({ data: undefined, state: false })}
            onConfirm={handleConfirmClick}
          />
        </div>
      )}
    </PageLayoutV1>
  );
};

export default TagsPage;
