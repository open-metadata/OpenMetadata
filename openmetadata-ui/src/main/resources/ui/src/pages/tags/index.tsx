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

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  Button,
  Col,
  Input,
  Row,
  Space,
  Spin,
  Table,
  Tooltip,
  Typography,
} from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import Description from 'components/common/description/Description';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import LeftPanelCard from 'components/common/LeftPanelCard/LeftPanelCard';
import NextPrevious from 'components/common/next-previous/NextPrevious';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import PageContainerV1 from 'components/containers/PageContainerV1';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import Loader from 'components/Loader/Loader';
import EntityDeleteModal from 'components/Modals/EntityDeleteModal/EntityDeleteModal';
import FormModal from 'components/Modals/FormModal';
import { ModalWithMarkdownEditor } from 'components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import TagsLeftPanelSkeleton from 'components/Skeleton/Tags/TagsLeftPanelSkeleton.component';
import { LOADING_STATE } from 'enums/common.enum';
import { compare } from 'fast-json-patch';
import { isEmpty, isUndefined, toLower, trim } from 'lodash';
import { FormErrorData } from 'Models';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory, useParams } from 'react-router-dom';
import {
  createClassification,
  createTag,
  deleteClassification,
  deleteTag,
  getAllClassifications,
  getClassificationByName,
  getTags,
  patchClassification,
  patchTag,
} from 'rest/tagAPI';
import { ReactComponent as PlusIcon } from '../../assets/svg/plus-primary.svg';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE,
  TIER_CATEGORY,
} from '../../constants/constants';
import { delimiterRegex } from '../../constants/regex.constants';
import { CreateClassification } from '../../generated/api/classification/createClassification';
import { ProviderType } from '../../generated/entity/bot';
import { Classification } from '../../generated/entity/classification/classification';
import { Tag } from '../../generated/entity/classification/tag';
import { Operation } from '../../generated/entity/policies/accessControl/rule';
import { EntityReference } from '../../generated/type/entityReference';
import { Paging } from '../../generated/type/paging';
import {
  getActiveCatClass,
  getCountBadge,
  getEntityDeleteMessage,
  getEntityName,
  isUrlFriendlyName,
} from '../../utils/CommonUtils';
import {
  checkPermission,
  DEFAULT_ENTITY_PERMISSION,
} from '../../utils/PermissionsUtils';
import {
  getExplorePathWithInitFilters,
  getTagPath,
} from '../../utils/RouterUtils';
import { getErrorText } from '../../utils/StringsUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import Form from './Form';
import './TagPage.style.less';
import { DeleteTagsType } from './TagsPage.interface';
import { getDeleteIcon } from './TagsPageUtils';

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
  const [isEditTag, setIsEditTag] = useState<boolean>(false);
  const [isAddingTag, setIsAddingTag] = useState<boolean>(false);
  const [editTag, setEditTag] = useState<Tag>();
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorDataClassification, setErrorDataClassification] =
    useState<FormErrorData>();
  const [errorDataTag, setErrorDataTag] = useState<FormErrorData>();
  const [deleteTags, setDeleteTags] = useState<DeleteTagsType>({
    data: undefined,
    state: false,
  });
  const [classificationPermissions, setClassificationPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [isNameEditing, setIsNameEditing] = useState<boolean>(false);
  const [currentClassificationName, setCurrentClassificationName] =
    useState<string>('');
  const [tags, setTags] = useState<Tag[]>();
  const [paging, setPaging] = useState<Paging>({} as Paging);
  const [currentPage, setCurrentPage] = useState<number>(INITIAL_PAGING_VALUE);
  const [isTagsLoading, setIsTagsLoading] = useState(false);
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

  const createTagPermission = useMemo(
    () => checkPermission(Operation.Create, ResourceEntity.TAG, permissions),
    [permissions]
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

  const handleEditNameCancel = () => {
    setIsNameEditing(false);
    setCurrentClassificationName(currentClassification?.name || '');
  };

  const fetchClassificationChildren = async (
    currentClassificationName: string,
    paging?: Paging
  ) => {
    setIsTagsLoading(true);

    try {
      const tagsResponse = await getTags({
        arrQueryFields: 'usageCount',
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
      const response = await getAllClassifications('termCount', 1000);
      setClassifications(response.data);
      if (setCurrent && response.data.length) {
        setCurrentClassification(response.data[0]);
        setCurrentClassificationName(response.data[0].name);

        history.push(getTagPath(response.data[0].name));
      }
    } catch (error) {
      const errMsg = getErrorText(
        error as AxiosError,
        t('server.fetch-tags-category-error')
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
          t('server.fetch-tags-category-error')
        );
        showErrorToast(errMsg);
        setError(errMsg);
        setCurrentClassification({ name } as Classification);
        setIsLoading(false);
      }
    }
  };

  const onNewCategoryChange = (
    data: CreateClassification,
    forceSet = false
  ) => {
    if (errorDataClassification || forceSet) {
      const errData: { [key: string]: string } = {};
      if (!data.name.trim()) {
        errData['name'] = 'Name is required';
      } else if (delimiterRegex.test(data.name)) {
        errData['name'] = 'Name with delimiters are not allowed';
      } else if (
        !isUndefined(
          classifications.find(
            (item) => toLower(item.name) === toLower(data.name)
          )
        )
      ) {
        errData['name'] = 'Name already exists';
      } else if (data.name.length < 2 || data.name.length > 64) {
        errData['name'] = 'Name size must be between 2 and 64';
      } else if (!isUrlFriendlyName(data.name.trim())) {
        errData['name'] = 'Special characters are not allowed';
      }
      setErrorDataClassification(errData);

      return errData;
    }

    return {};
  };

  const createCategory = (data: CreateClassification) => {
    const errData = onNewCategoryChange(data, true);
    if (!Object.values(errData).length) {
      createClassification({ ...data, name: trim(data.name) })
        .then((res) => {
          if (res) {
            fetchClassifications();
            setTimeout(() => {
              history.push(getTagPath(res.name));
            }, 100);
          } else {
            throw t('server.unexpected-response');
          }
        })
        .catch((err: AxiosError) => {
          showErrorToast(err, t('server.create-tag-category-error'));
        })
        .finally(() => {
          setIsAddingClassification(false);
        });
    }
  };

  /**
   * It will set current tag category for delete
   */
  const deleteTagHandler = () => {
    if (currentClassification) {
      setDeleteTags({
        data: {
          id: currentClassification.id as string,
          name: currentClassification.displayName || currentClassification.name,
          isCategory: true,
        },
        state: true,
      });
    }
  };

  /**
   * Take tag category id and delete.
   * @param classificationId - tag category id
   */
  const deleteClassificationById = (classificationId: string) => {
    deleteClassification(classificationId)
      .then((res) => {
        if (res) {
          setIsLoading(true);
          setDeleteStatus(LOADING_STATE.SUCCESS);
          setClassifications((classifications) => {
            const updatedClassification = classifications.filter(
              (data) => data.id !== classificationId
            );
            const currentClassification = updatedClassification[0];
            setTimeout(() => {
              history.push(
                getTagPath(
                  currentClassification?.fullyQualifiedName ||
                    currentClassification?.name
                )
              );
            }, 100);

            return updatedClassification;
          });
        } else {
          showErrorToast(t('server.delete-tag-category-error'));
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(err, t('server.delete-tag-category-error'));
      })
      .finally(() => {
        setDeleteTags({ data: undefined, state: false });
        setIsLoading(false);
        setDeleteStatus(LOADING_STATE.INITIAL);
      });
  };

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
          showErrorToast(t('server.delete-tag-error'));
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(err, t('server.delete-tag-error'));
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
    setDeleteStatus(LOADING_STATE.WAITING);
    if (deleteTags.data?.isCategory) {
      deleteClassificationById(deleteTags.data.id as string);
    } else {
      handleDeleteTag(deleteTags.data?.id as string);
    }
  };

  const handleUpdateCategory = async (
    updatedClassification: Classification
  ) => {
    if (!isUndefined(currentClassification)) {
      const patchData = compare(currentClassification, updatedClassification);
      try {
        const response = await patchClassification(
          currentClassification?.id || '',
          patchData
        );
        if (response) {
          fetchClassifications();
          if (currentClassification?.name !== updatedClassification.name) {
            history.push(getTagPath(response.name));
            setIsNameEditing(false);
          } else {
            await fetchCurrentClassification(currentClassification?.name, true);
          }
        } else {
          throw t('server.unexpected-response');
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsEditClassification(false);
      }
    }
  };

  const handleRenameSave = () => {
    if (!isUndefined(currentClassification)) {
      handleUpdateCategory({
        ...currentClassification,
        name: (currentClassificationName || currentClassification?.name) ?? '',
      });
    }
  };

  const handleUpdateDescription = async (updatedHTML: string) => {
    if (!isUndefined(currentClassification)) {
      handleUpdateCategory({
        ...currentClassification,
        description: updatedHTML,
      });
    }
  };

  const handleCategoryNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setCurrentClassificationName(e.target.value);
    },
    []
  );

  const onNewTagChange = (data: Classification, forceSet = false) => {
    if (errorDataTag || forceSet) {
      const errData: { [key: string]: string } = {};
      if (!data.name.trim()) {
        errData['name'] = 'Name is required';
      } else if (delimiterRegex.test(data.name)) {
        errData['name'] = 'Name with delimiters are not allowed';
      } else if (data.name.length < 2 || data.name.length > 64) {
        errData['name'] = 'Name size must be between 2 and 64';
      }
      setErrorDataTag(errData);

      return errData;
    }

    return {};
  };

  const createPrimaryTag = (data: Classification) => {
    const errData = onNewTagChange(data, true);
    if (!Object.values(errData).length) {
      createTag({
        name: trim(data.name),
        description: data.description,
        classification: currentClassification?.name ?? '',
      })
        .then((res) => {
          if (res) {
            fetchCurrentClassification(
              currentClassification?.name as string,
              true
            );
          } else {
            throw t('server.unexpected-response');
          }
        })
        .catch((err: AxiosError) => {
          showErrorToast(err, t('label.create-tag-error'));
        })
        .finally(() => {
          setIsAddingTag(false);
        });
    }
  };

  const updatePrimaryTag = async (updatedHTML: string) => {
    if (!isUndefined(editTag)) {
      const patchData = compare(editTag, {
        ...editTag,
        description: updatedHTML,
      });
      try {
        const response = await patchTag(editTag.id || '', patchData);
        if (response) {
          await fetchCurrentClassification(
            currentClassification?.name as string,
            true
          );
        } else {
          throw t('server.unexpected-response');
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsEditTag(false);
        setEditTag(undefined);
      }
    }
  };

  const getUsageCountLink = (tagFQN: string) => {
    const type = tagFQN.startsWith('Tier') ? 'tier' : 'tags';

    return getExplorePathWithInitFilters(
      '',
      undefined,
      `postFilter[${type}.tagFQN][0]=${tagFQN}`
    );
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
     */
    fetchClassifications(true);
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

  const handlePageChange = (after: string | number, activePage?: number) => {
    if (after) {
      setCurrentPage(activePage ?? INITIAL_PAGING_VALUE);
      fetchClassificationChildren(currentClassificationName, paging);
    }
  };

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
                    createClassificationPermission
                      ? t('label.add-entity', {
                          entity: t('label.classification'),
                        })
                      : t('message.no-permission-for-action')
                  }>
                  <Button
                    block
                    className=" text-primary"
                    data-testid="add-classification"
                    disabled={!createClassificationPermission}
                    icon={<PlusIcon className="anticon" />}
                    onClick={() => {
                      setIsAddingClassification((prevState) => !prevState);
                      setErrorDataClassification(undefined);
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

            {classifications &&
              classifications.map((category: Classification) => (
                <div
                  className={`tw-group tw-text-grey-body tw-cursor-pointer tw-my-1 tw-text-body tw-py-1 tw-px-3 tw-flex tw-justify-between ${getActiveCatClass(
                    category.name,
                    currentClassification?.name
                  )}`}
                  data-testid="side-panel-classification"
                  key={category.name}
                  onClick={() => onClickClassifications(category)}>
                  <Typography.Paragraph
                    className="ant-typography-ellipsis-custom tag-category label-category self-center w-32"
                    data-testid="tag-name"
                    ellipsis={{ rows: 1, tooltip: true }}>
                    {getEntityName(category as unknown as EntityReference)}
                  </Typography.Paragraph>
                  {getCountBadge(
                    category.termCount,
                    'tw-self-center',
                    currentClassification?.name === category.name
                  )}
                </div>
              ))}
          </div>
        </TagsLeftPanelSkeleton>
      </LeftPanelCard>
    );
  };

  const tableColumn: ColumnsType<Tag> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        render: (text: string, record: Tag) => (
          <div className="tw-group tableBody-cell">
            <div className="cursor-pointer d-flex">
              <div>
                {text ? (
                  <RichTextEditorPreviewer markdown={text} />
                ) : (
                  <span className="tw-no-description">
                    {t('label.no-entity', {
                      entity: t('label.description'),
                    })}
                  </span>
                )}
              </div>

              {(classificationPermissions.EditDescription ||
                classificationPermissions.EditAll) && (
                <button
                  className="tw-self-start tw-w-8 tw-h-auto tw-opacity-0 tw-ml-1 group-hover:tw-opacity-100 focus:tw-outline-none"
                  onClick={() => {
                    setIsEditTag(true);
                    setEditTag(record);
                  }}>
                  <SVGIcons
                    alt="edit"
                    data-testid="editTagDescription"
                    icon="icon-edit"
                    title="Edit"
                    width="16px"
                  />
                </button>
              )}
            </div>
            <div className="tw-mt-1" data-testid="usage">
              <span className="tw-text-grey-muted tw-mr-1">
                {`${t('label.usage')}:`}
              </span>
              {record.usageCount ? (
                <Link
                  className="link-text tw-align-middle"
                  data-testid="usage-count"
                  to={getUsageCountLink(record.fullyQualifiedName || '')}>
                  {record.usageCount}
                </Link>
              ) : (
                <span className="tw-no-description">{t('label.not-used')}</span>
              )}
            </div>
          </div>
        ),
      },
      {
        title: t('label.action-plural'),
        dataIndex: 'actions',
        key: 'actions',
        width: 120,
        align: 'center',
        render: (_, record: Tag) => (
          <button
            className="link-text"
            data-testid="delete-tag"
            disabled={
              record.provider === ProviderType.System ||
              !classificationPermissions.EditAll
            }
            onClick={() => handleActionDeleteTag(record)}>
            {getDeleteIcon(deleteTags, record.id)}
          </button>
        ),
      },
    ],
    [
      currentClassification,
      classificationPermissions,
      deleteTags,
      tags,
      deleteTags,
    ]
  );

  return (
    <PageContainerV1>
      <PageLayoutV1 leftPanel={fetchLeftPanel()}>
        {isLoading ? (
          <Loader />
        ) : error ? (
          <ErrorPlaceHolder>
            <p className="tw-text-center tw-m-auto">{error}</p>
          </ErrorPlaceHolder>
        ) : (
          <div className="full-height" data-testid="tags-container">
            {currentClassification && (
              <Space className="w-full justify-between" data-testid="header">
                <Space className="items-center">
                  {isNameEditing ? (
                    <Row align="middle" gutter={8}>
                      <Col>
                        <Input
                          className="input-width"
                          data-testid="current-classification-name"
                          name="ClassificationName"
                          value={currentClassificationName}
                          onChange={handleCategoryNameChange}
                        />
                      </Col>
                      <Col>
                        <Button
                          className="icon-buttons"
                          data-testid="cancelAssociatedTag"
                          icon={
                            <FontAwesomeIcon
                              className="w-3.5 h-3.5"
                              icon="times"
                            />
                          }
                          size="small"
                          type="primary"
                          onMouseDown={handleEditNameCancel}
                        />
                        <Button
                          className="icon-buttons m-l-xss"
                          data-testid="saveAssociatedTag"
                          icon={
                            <FontAwesomeIcon
                              className="w-3.5 h-3.5"
                              icon="check"
                            />
                          }
                          size="small"
                          type="primary"
                          onMouseDown={handleRenameSave}
                        />
                      </Col>
                    </Row>
                  ) : (
                    <Space>
                      <Typography.Text
                        className="m-b-0 font-bold text-lg"
                        data-testid="classification-name">
                        {getEntityName(currentClassification)}
                      </Typography.Text>
                      {currentClassification.provider === ProviderType.User && (
                        <Tooltip
                          title={
                            classificationPermissions.EditAll
                              ? t('label.edit-entity', {
                                  entity: t('label.name'),
                                })
                              : t('message.no-permission-for-action')
                          }>
                          <Button
                            className="p-0"
                            data-testid="name-edit-icon"
                            disabled={!classificationPermissions.EditAll}
                            size="small"
                            type="text"
                            onClick={() => setIsNameEditing(true)}>
                            <SVGIcons
                              alt="icon-tag"
                              className="tw-mx-1"
                              icon={Icons.EDIT}
                              width="16"
                            />
                          </Button>
                        </Tooltip>
                      )}
                    </Space>
                  )}
                </Space>
                <div className="flex-center">
                  <Tooltip
                    title={
                      createTagPermission || classificationPermissions.EditAll
                        ? t('label.add-new-entity', {
                            entity: t('label.tag-lowercase'),
                          })
                        : t('message.no-permission-for-action')
                    }>
                    <Button
                      className="add-new-tag-btn"
                      data-testid="add-new-tag-button"
                      disabled={
                        !(
                          createTagPermission ||
                          classificationPermissions.EditAll
                        )
                      }
                      size="small"
                      type="primary"
                      onClick={() => {
                        setIsAddingTag((prevState) => !prevState);
                        setErrorDataTag(undefined);
                      }}>
                      {t('label.add-new-entity', {
                        entity: t('label.tag-lowercase'),
                      })}
                    </Button>
                  </Tooltip>
                  <Tooltip
                    title={
                      !(
                        currentClassification.provider ===
                          ProviderType.System ||
                        !classificationPermissions.Delete
                      )
                        ? t('label.delete-entity', {
                            entity: t('label.classification'),
                          })
                        : t('message.no-permission-for-action')
                    }>
                    <Button
                      className="add-new-tag-btn tw-ml-2"
                      data-testid="delete-classification-or-tag"
                      disabled={
                        currentClassification.provider ===
                          ProviderType.System ||
                        !classificationPermissions.Delete
                      }
                      size="small"
                      onClick={() => deleteTagHandler()}>
                      {t('label.delete-entity', {
                        entity: t('label.classification'),
                      })}
                    </Button>
                  </Tooltip>
                </div>
              </Space>
            )}
            <div className="m-b-sm m-t-xs" data-testid="description-container">
              <Description
                description={currentClassification?.description || ''}
                entityName={
                  currentClassification?.displayName ??
                  currentClassification?.name
                }
                hasEditAccess={
                  classificationPermissions.EditDescription ||
                  classificationPermissions.EditAll
                }
                isEdit={isEditClassification}
                onCancel={() => setIsEditClassification(false)}
                onDescriptionEdit={() => setIsEditClassification(true)}
                onDescriptionUpdate={handleUpdateDescription}
              />
            </div>
            <Table
              bordered
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

            <ModalWithMarkdownEditor
              header={t('label.edit-description-for', {
                entityName: editTag?.name,
              })}
              placeholder={t('label.enter-entity', {
                entity: t('label.description'),
              })}
              value={editTag?.description as string}
              visible={isEditTag}
              onCancel={() => {
                setIsEditTag(false);
                setEditTag(undefined);
              }}
              onSave={updatePrimaryTag}
            />
            <FormModal
              showHiddenFields
              errorData={errorDataClassification}
              form={Form}
              header={t('label.adding-new-classification')}
              initialData={{
                name: '',
                description: '',
              }}
              isSaveButtonDisabled={!isEmpty(errorDataClassification)}
              visible={isAddingClassification}
              onCancel={() => setIsAddingClassification(false)}
              onChange={(data) => {
                setErrorDataClassification({});
                onNewCategoryChange(data as Classification);
              }}
              onSave={(data) => createCategory(data as Classification)}
            />
            <FormModal
              errorData={errorDataTag}
              form={Form}
              header={t('message.adding-new-tag', {
                categoryName:
                  currentClassification?.displayName ??
                  currentClassification?.name,
              })}
              initialData={{
                name: '',
                description: '',
              }}
              isSaveButtonDisabled={!isEmpty(errorDataTag)}
              visible={isAddingTag}
              onCancel={() => setIsAddingTag(false)}
              onChange={(data) => {
                setErrorDataTag({});
                onNewTagChange(data as Classification);
              }}
              onSave={(data) => createPrimaryTag(data as Classification)}
            />

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
    </PageContainerV1>
  );
};

export default TagsPage;
