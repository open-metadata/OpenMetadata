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
import { AxiosError, AxiosResponse } from 'axios';
import classNames from 'classnames';
import { isUndefined, toLower } from 'lodash';
import { EntityTags, FormErrorData } from 'Models';
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import {
  createTag,
  createTagCategory,
  getCategory,
  updateTag,
  updateTagCategory,
} from '../../axiosAPIs/tagAPI';
import { Button } from '../../components/buttons/Button/Button';
import Description from '../../components/common/description/Description';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import NonAdminAction from '../../components/common/non-admin-action/NonAdminAction';
import RichTextEditorPreviewer from '../../components/common/rich-text-editor/RichTextEditorPreviewer';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import PageLayout from '../../components/containers/PageLayout';
import Loader from '../../components/Loader/Loader';
import FormModal from '../../components/Modals/FormModal';
import { ModalWithMarkdownEditor } from '../../components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import TagsContainer from '../../components/tags-container/tags-container';
import Tags from '../../components/tags/tags';
import {
  getExplorePathWithSearch,
  TITLE_FOR_NON_ADMIN_ACTION,
} from '../../constants/constants';
import {
  CreateTagCategory,
  TagCategoryType,
} from '../../generated/api/tags/createTagCategory';
import { Operation } from '../../generated/entity/policies/accessControl/rule';
import { TagCategory, TagClass } from '../../generated/entity/tags/tagCategory';
import { useAuth } from '../../hooks/authHooks';
import jsonData from '../../jsons/en';
import {
  getActiveCatClass,
  getCountBadge,
  isEven,
  isUrlFriendlyName,
} from '../../utils/CommonUtils';
import { getErrorText } from '../../utils/StringsUtils';
import SVGIcons from '../../utils/SvgUtils';
import {
  getTagCategories,
  getTaglist,
  getTagOptionsFromFQN,
} from '../../utils/TagsUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import Form from './Form';

const TagsPage = () => {
  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();
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

  const getTags = useCallback(() => {
    const filteredTags = getTaglist(categories).filter(
      (tag) => editTag?.fullyQualifiedName !== tag
    );

    return getTagOptionsFromFQN(filteredTags);
  }, [currentCategory, editTag]);

  const fetchCategories = () => {
    setIsLoading(true);
    getTagCategories('usageCount')
      .then((res) => {
        if (res.data) {
          setCategoreis(res.data);
          setCurrentCategory(res.data[0]);
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
        if (currentCategory.data) {
          setCurrentCategory(currentCategory.data);
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
        setIsLoading(false);
      }
    }
  };

  const onNewCategoryChange = (data: CreateTagCategory, forceSet = false) => {
    if (errorDataCategory || forceSet) {
      const errData: { [key: string]: string } = {};
      if (!data.name.trim()) {
        errData['name'] = 'Name is required';
      } else if (/\s/g.test(data.name)) {
        errData['name'] = 'Name with space is not allowed';
      } else if (
        !isUndefined(
          categories.find((item) => toLower(item.name) === toLower(data.name))
        )
      ) {
        errData['name'] = 'Name already exists';
      } else if (data.name.length < 2 || data.name.length > 25) {
        errData['name'] = 'Name size must be between 2 and 25';
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
        .then((res: AxiosResponse) => {
          if (res.data) {
            fetchCategories();
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

  const UpdateCategory = (updatedHTML: string) => {
    updateTagCategory(currentCategory?.name, {
      name: currentCategory?.name,
      description: updatedHTML,
      categoryType: currentCategory?.categoryType,
    })
      .then((res: AxiosResponse) => {
        if (res.data) {
          fetchCurrentCategory(currentCategory?.name as string, true);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['update-tag-category-error']
        );
      })
      .finally(() => {
        setIsEditCategory(false);
      });
  };

  const onNewTagChange = (data: TagCategory, forceSet = false) => {
    if (errorDataTag || forceSet) {
      const errData: { [key: string]: string } = {};
      if (!data.name.trim()) {
        errData['name'] = 'Name is required';
      } else if (/\s/g.test(data.name)) {
        errData['name'] = 'Name with space is not allowed';
      } else if (
        !isUndefined(
          currentCategory?.children?.find(
            (item) => toLower((item as TagClass)?.name) === toLower(data.name)
          )
        )
      ) {
        errData['name'] = 'Name already exists';
      } else if (data.name.length < 2 || data.name.length > 25) {
        errData['name'] = 'Name size must be between 2 and 25';
      }
      setErrorDataTag(errData);

      return errData;
    }

    return {};
  };

  const createPrimaryTag = (data: TagCategory) => {
    const errData = onNewTagChange(data, true);
    if (!Object.values(errData).length) {
      createTag(currentCategory?.name, {
        name: data.name,
        description: data.description,
      })
        .then((res: AxiosResponse) => {
          if (res.data) {
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

  const updatePrimaryTag = (updatedHTML: string) => {
    updateTag(currentCategory?.name, editTag?.name, {
      name: editTag?.name,
      description: updatedHTML,
      associatedTags: editTag?.associatedTags,
    })
      .then((res: AxiosResponse) => {
        if (res.data) {
          fetchCurrentCategory(currentCategory?.name as string, true);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['update-tags-error']
        );
      })
      .finally(() => {
        setIsEditTag(false);
        setEditTag(undefined);
      });
  };

  const handleTagSelection = (tags?: Array<EntityTags>) => {
    const newTags = tags?.map((tag) => tag.tagFQN);
    if (newTags && editTag) {
      updateTag(currentCategory?.name, editTag?.name, {
        description: editTag?.description,
        name: editTag?.name,
        associatedTags: newTags,
      })
        .then((res: AxiosResponse) => {
          if (res.data) {
            fetchCurrentCategory(currentCategory?.name as string, true);
          } else {
            throw jsonData['api-error-messages']['unexpected-server-response'];
          }
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            jsonData['api-error-messages']['update-tags-error']
          );
        });
    }

    setEditTag(undefined);
  };

  const getUsageCountLink = (tagFQN: string) => {
    if (tagFQN.startsWith('Tier')) {
      return `${getExplorePathWithSearch()}?tier=${tagFQN}`;
    } else {
      return `${getExplorePathWithSearch()}?tags=${tagFQN}`;
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchLeftPanel = () => {
    return (
      <>
        <div className="tw-flex tw-justify-between tw-items-center tw-mb-3 tw-border-b">
          <h6 className="tw-heading tw-text-base">Tag Categories</h6>
          <NonAdminAction position="bottom" title={TITLE_FOR_NON_ADMIN_ACTION}>
            <Button
              className={classNames('tw-h-7 tw-px-2 tw-mb-4', {
                'tw-opacity-40': !isAdminUser && !isAuthDisabled,
              })}
              data-testid="add-category"
              size="small"
              theme="primary"
              variant="contained"
              onClick={() => {
                setIsAddingCategory((prevState) => !prevState);
                setErrorDataCategory(undefined);
              }}>
              <FontAwesomeIcon icon="plus" />
            </Button>
          </NonAdminAction>
        </div>
        {categories &&
          categories.map((category: TagCategory) => (
            <div
              className={`tw-group tw-text-grey-body tw-cursor-pointer tw-text-body tw-mb-3 tw-flex tw-justify-between ${getActiveCatClass(
                category.name,
                currentCategory?.name
              )}`}
              data-testid="side-panel-category"
              key={category.name}
              onClick={() => {
                fetchCurrentCategory(category.name);
              }}>
              <p className="tw-text-center tw-self-center tag-category label-category">
                {category.displayName ?? category.name}
              </p>

              {getCountBadge(
                currentCategory?.name === category.name
                  ? currentCategory.children?.length
                  : category.children?.length || 0,
                'tw-self-center',
                currentCategory?.name === category.name
              )}
            </div>
          ))}
      </>
    );
  };

  return (
    <>
      {error ? (
        <ErrorPlaceHolder>
          <p className="tw-text-center tw-m-auto">{error}</p>
        </ErrorPlaceHolder>
      ) : (
        <PageContainerV1 className="tw-py-4">
          <PageLayout leftPanel={fetchLeftPanel()}>
            {isLoading ? (
              <Loader />
            ) : (
              <div className="full-height" data-testid="tags-container">
                {currentCategory && (
                  <div
                    className="tw-flex tw-justify-between tw-items-center"
                    data-testid="header">
                    <div
                      className="tw-heading tw-text-link tw-text-base"
                      data-testid="category-name">
                      {currentCategory.displayName ?? currentCategory.name}
                    </div>
                    <NonAdminAction
                      position="bottom"
                      title={TITLE_FOR_NON_ADMIN_ACTION}>
                      <Button
                        className={classNames('tw-h-8 tw-rounded tw-mb-3', {
                          'tw-opacity-40': !isAdminUser && !isAuthDisabled,
                        })}
                        data-testid="add-new-tag-button"
                        size="small"
                        theme="primary"
                        variant="contained"
                        onClick={() => {
                          setIsAddingTag((prevState) => !prevState);
                          setErrorDataTag(undefined);
                        }}>
                        Add new tag
                      </Button>
                    </NonAdminAction>
                  </div>
                )}
                <div
                  className="tw-mb-3 tw--ml-5"
                  data-testid="description-container">
                  <Description
                    blurWithBodyBG
                    description={currentCategory?.description || ''}
                    entityName={
                      currentCategory?.displayName ?? currentCategory?.name
                    }
                    isEdit={isEditCategory}
                    onCancel={() => setIsEditCategory(false)}
                    onDescriptionEdit={() => setIsEditCategory(true)}
                    onDescriptionUpdate={UpdateCategory}
                  />
                </div>
                <div className="tw-bg-white">
                  <table className="tw-w-full" data-testid="table">
                    <thead>
                      <tr className="tableHead-row">
                        <th
                          className="tableHead-cell"
                          data-testid="heading-name">
                          Name
                        </th>
                        <th
                          className="tableHead-cell"
                          data-testid="heading-description">
                          Description
                        </th>
                        <th
                          className="tableHead-cell tw-w-60"
                          data-testid="heading-associated-tags">
                          Associated tags
                        </th>
                      </tr>
                    </thead>
                    <tbody className="tw-text-sm" data-testid="table-body">
                      {currentCategory?.children?.length ? (
                        (currentCategory.children as TagClass[])?.map(
                          (tag: TagClass, index: number) => {
                            return (
                              <tr
                                className={`tableBody-row ${
                                  !isEven(index + 1) && 'odd-row'
                                }`}
                                key={index}>
                                <td className="tableBody-cell">
                                  <p>{tag.name}</p>
                                </td>
                                <td className="tw-group tableBody-cell">
                                  <div className="tw-cursor-pointer tw-flex">
                                    <div>
                                      {tag.description ? (
                                        <RichTextEditorPreviewer
                                          markdown={tag.description}
                                        />
                                      ) : (
                                        <span className="tw-no-description">
                                          No description
                                        </span>
                                      )}
                                    </div>
                                    <NonAdminAction
                                      permission={Operation.UpdateDescription}
                                      position="left"
                                      title={TITLE_FOR_NON_ADMIN_ACTION}>
                                      <button
                                        className="tw-self-start tw-w-8 tw-h-auto tw-opacity-0 tw-ml-1 group-hover:tw-opacity-100 focus:tw-outline-none"
                                        onClick={() => {
                                          setIsEditTag(true);
                                          setEditTag(tag);
                                        }}>
                                        <SVGIcons
                                          alt="edit"
                                          data-testid="editTagDescription"
                                          icon="icon-edit"
                                          title="Edit"
                                          width="10px"
                                        />
                                      </button>
                                    </NonAdminAction>
                                  </div>
                                  <div className="tw-mt-1" data-testid="usage">
                                    <span className="tw-text-grey-muted tw-mr-1">
                                      Usage:
                                    </span>
                                    {tag.usageCount ? (
                                      <Link
                                        className="link-text tw-align-middle"
                                        data-testid="usage-count"
                                        to={getUsageCountLink(
                                          tag.fullyQualifiedName || ''
                                        )}>
                                        {tag.usageCount}
                                      </Link>
                                    ) : (
                                      <span
                                        className="tw-no-description"
                                        data-testid="usage-count">
                                        Not used
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td
                                  className="tw-group tableBody-cell"
                                  onClick={() => {
                                    setEditTag(tag);
                                  }}>
                                  <NonAdminAction
                                    permission={Operation.UpdateTags}
                                    position="left"
                                    title={TITLE_FOR_NON_ADMIN_ACTION}
                                    trigger="click">
                                    <TagsContainer
                                      editable={
                                        editTag?.name === tag.name && !isEditTag
                                      }
                                      selectedTags={
                                        tag.associatedTags?.map((tag) => ({
                                          tagFQN: tag,
                                        })) || []
                                      }
                                      tagList={getTags()}
                                      onCancel={() => {
                                        handleTagSelection();
                                      }}
                                      onSelectionChange={(tags) => {
                                        handleTagSelection(tags);
                                      }}>
                                      {tag.associatedTags?.length ? (
                                        <button className="tw-opacity-0 tw-ml-1 group-hover:tw-opacity-100 focus:tw-outline-none">
                                          <SVGIcons
                                            alt="edit"
                                            icon="icon-edit"
                                            title="Edit"
                                            width="10px"
                                          />
                                        </button>
                                      ) : (
                                        <span className="tw-opacity-60 group-hover:tw-opacity-100 tw-text-grey-muted group-hover:tw-text-primary">
                                          <Tags
                                            startWith="+ "
                                            tag="Add tag"
                                            type="outlined"
                                          />
                                        </span>
                                      )}
                                    </TagsContainer>
                                  </NonAdminAction>
                                </td>
                              </tr>
                            );
                          }
                        )
                      ) : (
                        <tr className="tableBody-row">
                          <td
                            className="tableBody-cell tw-text-center"
                            colSpan={4}>
                            No tags available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {isEditTag && (
                  <ModalWithMarkdownEditor
                    header={`Edit description for ${editTag?.name}`}
                    placeholder="Enter Description"
                    value={editTag?.description as string}
                    onCancel={() => {
                      setIsEditTag(false);
                      setEditTag(undefined);
                    }}
                    onSave={updatePrimaryTag}
                  />
                )}
                {isAddingCategory && (
                  <FormModal
                    errorData={errorDataCategory}
                    form={Form}
                    header="Adding new category"
                    initialData={{
                      name: '',
                      description: '',
                      categoryType: TagCategoryType.Descriptive,
                    }}
                    onCancel={() => setIsAddingCategory(false)}
                    onChange={(data) =>
                      onNewCategoryChange(data as TagCategory)
                    }
                    onSave={(data) => createCategory(data as TagCategory)}
                  />
                )}
                {isAddingTag && (
                  <FormModal
                    errorData={errorDataTag}
                    form={Form}
                    header={`Adding new tag on ${
                      currentCategory?.displayName ?? currentCategory?.name
                    }`}
                    initialData={{
                      name: '',
                      description: '',
                      categoryType: '',
                    }}
                    onCancel={() => setIsAddingTag(false)}
                    onChange={(data) => onNewTagChange(data as TagCategory)}
                    onSave={(data) => createPrimaryTag(data as TagCategory)}
                  />
                )}
              </div>
            )}
          </PageLayout>
        </PageContainerV1>
      )}
    </>
  );
};

export default TagsPage;
