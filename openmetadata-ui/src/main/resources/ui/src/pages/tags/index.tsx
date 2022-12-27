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
  Table,
  Tooltip,
  Typography,
} from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { isEmpty, isUndefined, toLower, trim } from 'lodash';
import { FormErrorData, LoadingState } from 'Models';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory, useParams } from 'react-router-dom';
import {
  createClassification,
  createTag,
  deleteClassification,
  deleteTag,
  getClassification,
  updateClassification,
  updateTag,
} from '../../axiosAPIs/tagAPI';
import Description from '../../components/common/description/Description';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import LeftPanelCard from '../../components/common/LeftPanelCard/LeftPanelCard';
import RichTextEditorPreviewer from '../../components/common/rich-text-editor/RichTextEditorPreviewer';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import PageLayoutV1 from '../../components/containers/PageLayoutV1';
import Loader from '../../components/Loader/Loader';
import ConfirmationModal from '../../components/Modals/ConfirmationModal/ConfirmationModal';
import FormModal from '../../components/Modals/FormModal';
import { ModalWithMarkdownEditor } from '../../components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import { usePermissionProvider } from '../../components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../components/PermissionProvider/PermissionProvider.interface';
import { TIER_CATEGORY } from '../../constants/constants';
import { NO_PERMISSION_FOR_ACTION } from '../../constants/HelperTextUtil';
import { delimiterRegex } from '../../constants/regex.constants';
import { CreateClassification } from '../../generated/api/classification/createClassification';
import { ProviderType } from '../../generated/entity/bot';
import { Classification } from '../../generated/entity/classification/classification';
import { Tag } from '../../generated/entity/classification/tag';
import { Operation } from '../../generated/entity/policies/accessControl/rule';
import { EntityReference } from '../../generated/type/entityReference';
import jsonData from '../../jsons/en';
import {
  getActiveCatClass,
  getCountBadge,
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
import { getClassifications } from '../../utils/TagsUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import Form from './Form';
import './TagPage.style.less';

type DeleteTagDetailsType = {
  id: string;
  name: string;
  categoryName?: string;
  isCategory: boolean;
  status?: LoadingState;
};

type DeleteTagsType = {
  data: DeleteTagDetailsType | undefined;
  state: boolean;
};

const TagsPage = () => {
  const { getEntityPermission, permissions } = usePermissionProvider();
  const history = useHistory();
  const { ClassificationName } = useParams<Record<string, string>>();
  const [categories, setCategoreis] = useState<Array<Classification>>([]);
  const [currentClassification, setCurrentCategory] =
    useState<Classification>();
  const [isEditCategory, setIsEditCategory] = useState<boolean>(false);
  const [isAddingCategory, setIsAddingCategory] = useState<boolean>(false);
  const [isEditTag, setIsEditTag] = useState<boolean>(false);
  const [isAddingTag, setIsAddingTag] = useState<boolean>(false);
  const [editTag, setEditTag] = useState<Tag>();
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorDataCategory, setErrorDataCategory] = useState<FormErrorData>();
  const [errorDataTag, setErrorDataTag] = useState<FormErrorData>();
  const [deleteTags, setDeleteTags] = useState<DeleteTagsType>({
    data: undefined,
    state: false,
  });
  const [categoryPermissions, setCategoryPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [isNameEditing, setIsNameEditing] = useState<boolean>(false);
  const [currentCategoryName, setCurrentCategoryName] = useState<string>('');

  const { t } = useTranslation();
  const createCategoryPermission = useMemo(
    () =>
      checkPermission(
        Operation.Create,
        ResourceEntity.CLASSIFICATION,
        permissions
      ),
    [permissions]
  );

  const createTagPermission = useMemo(
    () => checkPermission(Operation.Create, ResourceEntity.TAG, permissions),
    [permissions]
  );

  const fetchCurrentCategoryPermission = async () => {
    try {
      const response = await getEntityPermission(
        ResourceEntity.CLASSIFICATION,
        currentClassification?.id as string
      );
      setCategoryPermissions(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleEditNameCancel = () => {
    setIsNameEditing(false);
    setCurrentCategoryName(currentClassification?.name || '');
  };

  const fetchCategories = async (setCurrent?: boolean) => {
    setIsLoading(true);

    try {
      const response = await getClassifications('usageCount');
      setCategoreis(response.data);
      if (setCurrent && response.data.length) {
        setCurrentCategory(response.data[0]);
        setCurrentCategoryName(response.data[0].name);
      }
    } catch (error) {
      const errMsg = getErrorText(
        error as AxiosError,
        jsonData['api-error-messages']['fetch-tags-category-error']
      );
      showErrorToast(errMsg);
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCurrentCategory = async (name: string, update?: boolean) => {
    if (currentClassification?.name !== name || update) {
      setIsLoading(true);
      try {
        const currentClassification = await getClassification(
          name,
          'usageCount'
        );
        if (currentClassification) {
          setCurrentCategory(currentClassification);
          setCurrentCategoryName(currentClassification.name);
          setIsLoading(false);
        } else {
          showErrorToast(
            jsonData['api-error-messages']['unexpected-server-response']
          );
        }
      } catch (err) {
        const errMsg = getErrorText(
          err as AxiosError,
          jsonData['api-error-messages']['fetch-tags-category-error']
        );
        showErrorToast(errMsg);
        setError(errMsg);
        setCurrentCategory({ name } as Classification);
        setIsLoading(false);
      }
    }
  };

  const onNewCategoryChange = (
    data: CreateClassification,
    forceSet = false
  ) => {
    if (errorDataCategory || forceSet) {
      const errData: { [key: string]: string } = {};
      if (!data.name.trim()) {
        errData['name'] = 'Name is required';
      } else if (delimiterRegex.test(data.name)) {
        errData['name'] = 'Name with delimiters are not allowed';
      } else if (
        !isUndefined(
          categories.find((item) => toLower(item.name) === toLower(data.name))
        )
      ) {
        errData['name'] = 'Name already exists';
      } else if (data.name.length < 2 || data.name.length > 64) {
        errData['name'] = 'Name size must be between 2 and 64';
      } else if (!isUrlFriendlyName(data.name.trim())) {
        errData['name'] = 'Special characters are not allowed';
      }
      setErrorDataCategory(errData);

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
            history.push(getTagPath(res.name));
          } else {
            throw jsonData['api-error-messages']['unexpected-server-response'];
          }
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            jsonData['api-error-messages']['create-tag-category-error']
          );
        })
        .finally(() => {
          setIsAddingCategory(false);
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
          const updatedClassification = categories.filter(
            (data) => data.id !== classificationId
          );
          const currentClassification = updatedClassification[0];
          history.push(
            getTagPath(
              currentClassification?.fullyQualifiedName ||
                currentClassification?.name
            )
          );
        } else {
          showErrorToast(
            jsonData['api-error-messages']['delete-tag-category-error']
          );
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['delete-tag-category-error']
        );
      })
      .finally(() => {
        setDeleteTags({ data: undefined, state: false });
        setIsLoading(false);
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
            setCurrentCategory({
              ...currentClassification,
            });
          }
        } else {
          showErrorToast(jsonData['api-error-messages']['delete-tag-error']);
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(err, jsonData['api-error-messages']['delete-tag-error']);
      })
      .finally(() => setDeleteTags({ data: undefined, state: false }));
  };

  /**
   * It redirects to respective function call based on tag/Classification
   */
  const handleConfirmClick = () => {
    if (deleteTags.data?.isCategory) {
      deleteClassificationById(deleteTags.data.id as string);
    } else {
      handleDeleteTag(deleteTags.data?.id as string);
    }
  };

  const handleUpdateCategory = async (
    updatedClassification: Classification
  ) => {
    try {
      const response = await updateClassification(updatedClassification);
      if (response) {
        if (currentClassification?.name !== updatedClassification.name) {
          history.push(getTagPath(response.name));
          setIsNameEditing(false);
        } else {
          await fetchCurrentCategory(
            currentClassification?.name as string,
            true
          );
        }
      } else {
        throw jsonData['api-error-messages']['unexpected-server-response'];
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsEditCategory(false);
    }
  };

  const handleRenameSave = () => {
    handleUpdateCategory({
      name: (currentCategoryName || currentClassification?.name) ?? '',
      description: currentClassification?.description ?? '',
    });
  };

  const handleUpdateDescription = async (updatedHTML: string) => {
    handleUpdateCategory({
      name: currentClassification?.name ?? '',
      description: updatedHTML,
    });
  };

  const handleCategoryNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentCategoryName(e.target.value);
  };

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
            fetchCurrentCategory(currentClassification?.name as string, true);
          } else {
            throw jsonData['api-error-messages']['unexpected-server-response'];
          }
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            jsonData['api-error-messages']['create-tag-error']
          );
        })
        .finally(() => {
          setIsAddingTag(false);
        });
    }
  };

  const updatePrimaryTag = async (updatedHTML: string) => {
    try {
      const response = await updateTag({
        name: editTag?.name ?? '',
        description: updatedHTML,
      });
      if (response) {
        await fetchCurrentCategory(currentClassification?.name as string, true);
      } else {
        throw jsonData['api-error-messages']['unexpected-server-response'];
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsEditTag(false);
      setEditTag(undefined);
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
  };

  useEffect(() => {
    if (currentClassification) {
      fetchCurrentCategoryPermission();
    }
  }, [currentClassification]);

  useEffect(() => {
    /**
     * If ClassificationName is present then fetch that category
     */
    if (ClassificationName) {
      const isTier = ClassificationName.startsWith(TIER_CATEGORY);
      fetchCurrentCategory(isTier ? TIER_CATEGORY : ClassificationName);
    }
    /**
     * Fetch all categories and set current category only if there is no categoryName
     */
    fetchCategories(!ClassificationName);
  }, [ClassificationName]);

  const fetchLeftPanel = () => {
    return (
      <LeftPanelCard id="tags">
        <div className="tw-py-2" data-testid="data-summary-container">
          <div className="tw-px-3">
            <h6 className="tw-heading tw-text-sm tw-font-semibold">
              Tag Categories
            </h6>
            <div className="tw-mb-3">
              <Tooltip
                title={
                  createCategoryPermission
                    ? t('label.add-category')
                    : t('message.no-permission-for-action')
                }>
                <button
                  className="tw--mt-1 tw-w-full tw-flex-center tw-gap-2 tw-py-1 tw-text-primary tw-border tw-rounded-md tw-text-center"
                  data-testid="add-category"
                  disabled={!createCategoryPermission}
                  onClick={() => {
                    setIsAddingCategory((prevState) => !prevState);
                    setErrorDataCategory(undefined);
                  }}>
                  <SVGIcons alt="plus" icon={Icons.ICON_PLUS_PRIMERY} />{' '}
                  <span>{t('label.add-tag-category')}</span>
                </button>
              </Tooltip>
            </div>
          </div>

          {categories &&
            categories.map((category: Classification) => (
              <div
                className={`tw-group tw-text-grey-body tw-cursor-pointer tw-my-1 tw-text-body tw-py-1 tw-px-3 tw-flex tw-justify-between ${getActiveCatClass(
                  category.name,
                  currentClassification?.name
                )}`}
                data-testid="side-panel-category"
                key={category.name}
                onClick={() => {
                  history.push(getTagPath(category.name));
                }}>
                <Typography.Paragraph
                  className="ant-typography-ellipsis-custom tag-category label-category self-center w-32"
                  data-testid="tag-name"
                  ellipsis={{ rows: 1, tooltip: true }}>
                  {getEntityName(category as unknown as EntityReference)}
                </Typography.Paragraph>
                {getCountBadge(
                  0,
                  'tw-self-center',
                  currentClassification?.name === category.name
                )}
              </div>
            ))}
        </div>
      </LeftPanelCard>
    );
  };

  const tableColumn: ColumnsType<Tag> = useMemo(
    () => [
      {
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
      },
      {
        title: 'Description',
        dataIndex: 'description',
        key: 'description',
        render: (text: string, record: Tag) => (
          <div className="tw-group tableBody-cell">
            <div className="cursor-pointer flex">
              <div>
                {text ? (
                  <RichTextEditorPreviewer markdown={text} />
                ) : (
                  <span className="tw-no-description">No description</span>
                )}
              </div>

              {(categoryPermissions.EditDescription ||
                categoryPermissions.EditAll) && (
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
              <span className="tw-text-grey-muted tw-mr-1">Usage:</span>
              {record.usageCount ? (
                <Link
                  className="link-text tw-align-middle"
                  data-testid="usage-count"
                  to={getUsageCountLink(record.fullyQualifiedName || '')}>
                  {record.usageCount}
                </Link>
              ) : (
                <span className="tw-no-description" data-testid="usage-count">
                  Not used
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        title: 'Actions',
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
              !categoryPermissions.EditAll
            }
            onClick={() => handleActionDeleteTag(record)}>
            {deleteTags.data?.id === record.id ? (
              deleteTags.data?.status === 'success' ? (
                <FontAwesomeIcon icon="check" />
              ) : (
                <Loader size="small" type="default" />
              )
            ) : (
              <SVGIcons
                alt="delete"
                icon="icon-delete"
                title="Delete"
                width="16px"
              />
            )}
          </button>
        ),
      },
    ],
    [categoryPermissions, deleteTags]
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
                          data-testid="tag-category-name"
                          name="ClassificationName"
                          value={currentCategoryName}
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
                      <Typography.Title
                        className="m-b-0"
                        data-testid="category-name"
                        level={5}>
                        {getEntityName(currentClassification)}
                      </Typography.Title>
                      {currentClassification.provider === ProviderType.User && (
                        <Tooltip
                          title={
                            categoryPermissions.EditAll
                              ? t('label.edit-entity', {
                                  entity: t('label.name'),
                                })
                              : NO_PERMISSION_FOR_ACTION
                          }>
                          <Button
                            className="p-0"
                            data-testid="name-edit-icon"
                            disabled={!categoryPermissions.EditAll}
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
                      createTagPermission || categoryPermissions.EditAll
                        ? 'Add Tag'
                        : NO_PERMISSION_FOR_ACTION
                    }>
                    <Button
                      className="add-new-tag-btn"
                      data-testid="add-new-tag-button"
                      disabled={
                        !(createTagPermission || categoryPermissions.EditAll)
                      }
                      size="small"
                      type="primary"
                      onClick={() => {
                        setIsAddingTag((prevState) => !prevState);
                        setErrorDataTag(undefined);
                      }}>
                      Add new tag
                    </Button>
                  </Tooltip>

                  <Button
                    className="tw-h-8 tw-rounded tw-ml-2"
                    data-testid="delete-tag-category-button"
                    disabled={
                      currentClassification.provider === ProviderType.System ||
                      !categoryPermissions.Delete
                    }
                    size="small"
                    onClick={() => {
                      deleteTagHandler();
                    }}>
                    Delete category
                  </Button>
                </div>
              </Space>
            )}
            <div className="m-b-sm" data-testid="description-container">
              <Description
                description={currentClassification?.description || ''}
                entityName={
                  currentClassification?.displayName ??
                  currentClassification?.name
                }
                hasEditAccess={
                  categoryPermissions.EditDescription ||
                  categoryPermissions.EditAll
                }
                isEdit={isEditCategory}
                onCancel={() => setIsEditCategory(false)}
                onDescriptionEdit={() => setIsEditCategory(true)}
                onDescriptionUpdate={handleUpdateDescription}
              />
            </div>
            <Table
              bordered
              columns={tableColumn}
              data-testid="table"
              dataSource={[]}
              pagination={false}
              rowKey="id"
              size="small"
            />
            <ModalWithMarkdownEditor
              header={t('label.edit-description-for', {
                entityName: editTag?.name,
              })}
              placeholder={t('label.enter-description')}
              value={editTag?.description as string}
              visible={isEditTag}
              onCancel={() => {
                setIsEditTag(false);
                setEditTag(undefined);
              }}
              onSave={updatePrimaryTag}
            />
            <FormModal
              errorData={errorDataCategory}
              form={Form}
              header={t('label.adding-new-category')}
              initialData={{
                name: '',
                description: '',
              }}
              isSaveButtonDisabled={!isEmpty(errorDataCategory)}
              visible={isAddingCategory}
              onCancel={() => setIsAddingCategory(false)}
              onChange={(data) => {
                setErrorDataCategory({});
                onNewCategoryChange(data as Classification);
              }}
              onSave={(data) => createCategory(data as Classification)}
            />
            <FormModal
              errorData={errorDataTag}
              form={Form}
              header={t('label.adding-new-tag', {
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
            <ConfirmationModal
              bodyText={t('message.are-you-sure-delete-tag', {
                isCategory: deleteTags.data?.isCategory ? 'category' : '',
                tagName: deleteTags.data?.name,
              })}
              cancelText={t('label.cancel')}
              confirmText={t('label.confirm')}
              header={t('label.delete-tag-category', {
                isCategory: deleteTags.data?.isCategory ? 'Category' : '',
              })}
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
