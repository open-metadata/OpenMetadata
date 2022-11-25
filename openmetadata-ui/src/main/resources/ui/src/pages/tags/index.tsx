/*
 *  Copyright 2021 Collate
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
import { Button, Table, Tooltip, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { t } from 'i18next';
import { isEmpty, isUndefined, toLower } from 'lodash';
import { FormErrorData } from 'Models';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useHistory, useParams } from 'react-router-dom';
import {
  createTag,
  createTagCategory,
  deleteTag,
  deleteTagCategory,
  getCategory,
  updateTag,
  updateTagCategory,
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
import { CreateTagCategory } from '../../generated/api/tags/createTagCategory';
import { Operation } from '../../generated/entity/policies/accessControl/rule';
import { TagCategory, TagClass } from '../../generated/entity/tags/tagCategory';
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
import { getTagCategories, isSystemTierTags } from '../../utils/TagsUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import Form from './Form';
import './TagPage.style.less';
import { DeleteTagsType } from './TagsPage.interface';

const TagsPage = () => {
  const { getEntityPermission, permissions } = usePermissionProvider();
  const history = useHistory();
  const { tagCategoryName } = useParams<Record<string, string>>();
  const [categories, setCategoreis] = useState<Array<TagCategory>>([]);
  const [currentCategory, setCurrentCategory] = useState<TagCategory>();
  const [isEditCategory, setIsEditCategory] = useState<boolean>(false);
  const [isAddingCategory, setIsAddingCategory] = useState<boolean>(false);
  const [isEditTag, setIsEditTag] = useState<boolean>(false);
  const [isAddingTag, setIsAddingTag] = useState<boolean>(false);
  const [editTag, setEditTag] = useState<TagClass>();
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

  const createCategoryPermission = useMemo(
    () =>
      checkPermission(
        Operation.Create,
        ResourceEntity.TAG_CATEGORY,
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
        ResourceEntity.TAG_CATEGORY,
        currentCategory?.id as string
      );
      setCategoryPermissions(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchCategories = (setCurrent?: boolean) => {
    setIsLoading(true);
    getTagCategories('usageCount')
      .then((res) => {
        if (res.data) {
          setCategoreis(res.data);
          if (setCurrent) {
            setCurrentCategory(res.data[0]);
          }
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err) => {
        const errMsg = getErrorText(
          err,
          jsonData['api-error-messages']['fetch-tags-category-error']
        );
        showErrorToast(errMsg);
        setError(errMsg);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const fetchCurrentCategory = async (name: string, update?: boolean) => {
    if (currentCategory?.name !== name || update) {
      setIsLoading(true);
      try {
        const currentCategory = await getCategory(name, 'usageCount');
        if (currentCategory) {
          setCurrentCategory(currentCategory as TagCategory);
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
        setCurrentCategory({ name } as TagCategory);
        setIsLoading(false);
      }
    }
  };

  const onNewCategoryChange = (data: CreateTagCategory, forceSet = false) => {
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

  const createCategory = (data: CreateTagCategory) => {
    const errData = onNewCategoryChange(data, true);
    if (!Object.values(errData).length) {
      createTagCategory(data)
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
    if (currentCategory) {
      setDeleteTags({
        data: {
          id: currentCategory.id as string,
          name: currentCategory.displayName || currentCategory.name,
          isCategory: true,
        },
        state: true,
      });
    }
  };

  /**
   * Take tag category id and delete.
   * @param categoryId - tag category id
   */
  const deleteTagCategoryById = (categoryId: string) => {
    deleteTagCategory(categoryId)
      .then((res) => {
        if (res) {
          setIsLoading(true);
          const updatedCategory = categories.filter(
            (data) => data.id !== categoryId
          );
          const currentCategory = updatedCategory[0];
          history.push(
            getTagPath(
              currentCategory?.fullyQualifiedName || currentCategory?.name
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
  const handleDeleteTag = (categoryName: string, tagId: string) => {
    deleteTag(categoryName, tagId)
      .then((res) => {
        if (res.data) {
          if (currentCategory) {
            const updatedTags = (currentCategory.children as TagClass[]).filter(
              (data) => data.id !== tagId
            );
            setCurrentCategory({ ...currentCategory, children: updatedTags });
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
   * It redirects to respective function call based on tag/tagCategory
   */
  const handleConfirmClick = () => {
    if (deleteTags.data?.isCategory) {
      deleteTagCategoryById(deleteTags.data.id as string);
    } else {
      handleDeleteTag(
        deleteTags.data?.categoryName as string,
        deleteTags.data?.id as string
      );
    }
  };

  const UpdateCategory = async (updatedHTML: string) => {
    try {
      const response = await updateTagCategory(currentCategory?.name ?? '', {
        name: currentCategory?.name ?? '',
        description: updatedHTML,
      });
      if (response) {
        await fetchCurrentCategory(currentCategory?.name as string, true);
      } else {
        throw jsonData['api-error-messages']['unexpected-server-response'];
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsEditCategory(false);
    }
  };

  const onNewTagChange = (data: TagCategory, forceSet = false) => {
    if (errorDataTag || forceSet) {
      const errData: { [key: string]: string } = {};
      if (!data.name.trim()) {
        errData['name'] = 'Name is required';
      } else if (delimiterRegex.test(data.name)) {
        errData['name'] = 'Name with delimiters are not allowed';
      } else if (
        !isUndefined(
          currentCategory?.children?.find(
            (item) => toLower((item as TagClass)?.name) === toLower(data.name)
          )
        )
      ) {
        errData['name'] = 'Name already exists';
      } else if (data.name.length < 2 || data.name.length > 64) {
        errData['name'] = 'Name size must be between 2 and 64';
      }
      setErrorDataTag(errData);

      return errData;
    }

    return {};
  };

  const createPrimaryTag = (data: TagCategory) => {
    const errData = onNewTagChange(data, true);
    if (!Object.values(errData).length) {
      createTag(currentCategory?.name ?? '', {
        name: data.name,
        description: data.description,
      })
        .then((res) => {
          if (res) {
            fetchCurrentCategory(currentCategory?.name as string, true);
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
      const response = await updateTag(
        currentCategory?.name ?? '',
        editTag?.name ?? '',
        {
          name: editTag?.name ?? '',
          description: updatedHTML,
        }
      );
      if (response) {
        await fetchCurrentCategory(currentCategory?.name as string, true);
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

  const handleActionDeleteTag = (record: TagClass) => {
    setDeleteTags({
      data: {
        id: record.id as string,
        name: record.name,
        categoryName: currentCategory?.name,
        isCategory: false,
        status: 'waiting',
      },
      state: true,
    });
  };

  useEffect(() => {
    if (currentCategory) {
      fetchCurrentCategoryPermission();
    }
  }, [currentCategory]);

  useEffect(() => {
    /**
     * If tagCategoryName is present then fetch that category
     */
    if (tagCategoryName) {
      const isTier = tagCategoryName.startsWith(TIER_CATEGORY);
      fetchCurrentCategory(isTier ? TIER_CATEGORY : tagCategoryName);
    }
    /**
     * Fetch all categories and set current category only if there is no categoryName
     */
    fetchCategories(!tagCategoryName);
  }, [tagCategoryName]);

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
                    ? 'Add Category'
                    : NO_PERMISSION_FOR_ACTION
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
                  <span>Add Tag</span>
                </button>
              </Tooltip>
            </div>
          </div>

          {categories &&
            categories.map((category: TagCategory) => (
              <div
                className={`tw-group tw-text-grey-body tw-cursor-pointer tw-my-1 tw-text-body tw-py-1 tw-px-3 tw-flex tw-justify-between ${getActiveCatClass(
                  category.name,
                  currentCategory?.name
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
                  currentCategory?.name === category.name
                    ? currentCategory.children?.length
                    : category.children?.length || 0,
                  'tw-self-center',
                  currentCategory?.name === category.name
                )}
              </div>
            ))}
        </div>
      </LeftPanelCard>
    );
  };

  const tableColumn: ColumnsType<TagClass> = useMemo(
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
        render: (text: string, record: TagClass) => (
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
        render: (_, record: TagClass) => (
          <button
            className="link-text"
            data-testid="delete-tag"
            disabled={
              isSystemTierTags(record.fullyQualifiedName || '') ||
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
            {currentCategory && (
              <div
                className="tw-flex tw-justify-between tw-items-center"
                data-testid="header">
                <div
                  className="tw-text-link tw-text-base tw-py-2"
                  data-testid="category-name">
                  {currentCategory.displayName ?? currentCategory.name}
                </div>
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
                      isSystemTierTags(currentCategory.name || '') ||
                      !categoryPermissions.Delete
                    }
                    size="small"
                    onClick={() => {
                      deleteTagHandler();
                    }}>
                    Delete category
                  </Button>
                </div>
              </div>
            )}
            <div
              className="tw-mb-3 tw--ml-5"
              data-testid="description-container">
              <Description
                description={currentCategory?.description || ''}
                entityName={
                  currentCategory?.displayName ?? currentCategory?.name
                }
                hasEditAccess={
                  categoryPermissions.EditDescription ||
                  categoryPermissions.EditAll
                }
                isEdit={isEditCategory}
                onCancel={() => setIsEditCategory(false)}
                onDescriptionEdit={() => setIsEditCategory(true)}
                onDescriptionUpdate={UpdateCategory}
              />
            </div>
            <Table
              bordered
              columns={tableColumn}
              data-testid="table"
              dataSource={currentCategory?.children as TagClass[]}
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
                onNewCategoryChange(data as TagCategory);
              }}
              onSave={(data) => createCategory(data as TagCategory)}
            />
            <FormModal
              errorData={errorDataTag}
              form={Form}
              header={t('label.adding-new-tag', {
                categoryName:
                  currentCategory?.displayName ?? currentCategory?.name,
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
                onNewTagChange(data as TagCategory);
              }}
              onSave={(data) => createPrimaryTag(data as TagCategory)}
            />
            <ConfirmationModal
              bodyText={t('message.are-you-sure-delete-tag', {
                isCategory: deleteTags.data?.isCategory ? 'category' : '',
                tagName: deleteTags.data?.name,
              })}
              cancelText={t('label.cancel')}
              confirmText={t('label.confirm')}
              header={t('label.delete-tag', {
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
