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

import { AxiosError, AxiosResponse } from 'axios';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import { EntityTags, FormErrorData } from 'Models';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createTag,
  createTagCategory,
  getCategory,
  updateTag,
  updateTagCategory,
} from '../../axiosAPIs/tagAPI';
import { Button } from '../../components/buttons/Button/Button';
import Description from '../../components/common/description/Description';
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
import { TagCategory, TagClass } from '../../generated/entity/tags/tagCategory';
import { useAuth } from '../../hooks/authHooks';
import {
  getActiveCatClass,
  getCountBadge,
  isEven,
} from '../../utils/CommonUtils';
import SVGIcons from '../../utils/SvgUtils';
import { getTagCategories, getTaglist } from '../../utils/TagsUtils';
import Form from './Form';
// import { Tag, TagsCategory } from './tagsTypes';
const TagsPage = () => {
  const { isAuthDisabled, isAdminUser } = useAuth();
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

  const fetchCategories = () => {
    setIsLoading(true);
    getTagCategories('usageCount')
      .then((res) => {
        setCategoreis(res.data);
        setCurrentCategory(res.data[0]);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.data.data.code === 404) {
          setError('No Data Found');
        }
        setIsLoading(false);
      });
  };

  const fetchCurrentCategory = async (name: string, update?: boolean) => {
    if (currentCategory?.name !== name || update) {
      setIsLoading(true);
      try {
        const currentCategory = await getCategory(name, 'usageCount');
        setCurrentCategory(currentCategory.data);
        setIsLoading(false);
      } catch (err) {
        if ((err as AxiosError).response?.data.code) {
          setError('No Data Found');
        }
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
        !isUndefined(categories.find((item) => item.name === data.name))
      ) {
        errData['name'] = 'Name already exists';
      }
      setErrorDataCategory(errData);

      return errData;
    }

    return {};
  };

  const createCategory = (data: CreateTagCategory) => {
    const errData = onNewCategoryChange(data, true);
    if (!Object.values(errData).length) {
      createTagCategory(data).then((res: AxiosResponse) => {
        if (res.data) {
          fetchCategories();
        }
      });
      setIsAddingCategory(false);
    }
  };

  const UpdateCategory = (updatedHTML: string) => {
    updateTagCategory(currentCategory?.name, {
      name: currentCategory?.name,
      description: updatedHTML,
      categoryType: currentCategory?.categoryType,
    }).then((res: AxiosResponse) => {
      if (res.data) {
        fetchCurrentCategory(currentCategory?.name as string, true);
      }
    });
    setIsEditCategory(false);
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
            (item) => (item as TagClass)?.name === data.name
          )
        )
      ) {
        errData['name'] = 'Name already exists';
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
      }).then((res: AxiosResponse) => {
        if (res.data) {
          fetchCurrentCategory(currentCategory?.name as string, true);
        }
      });
      setIsAddingTag(false);
    }
  };
  const updatePrimaryTag = (updatedHTML: string) => {
    updateTag(currentCategory?.name, editTag?.name, {
      name: editTag?.name,
      description: updatedHTML,
      associatedTags: editTag?.associatedTags,
    }).then((res: AxiosResponse) => {
      if (res.data) {
        fetchCurrentCategory(currentCategory?.name as string, true);
      }
    });
    setIsEditTag(false);
    setEditTag(undefined);
  };

  const handleTagSelection = (tags?: Array<EntityTags>) => {
    const newTags = tags?.map((tag) => tag.tagFQN);
    if (newTags && editTag) {
      updateTag(currentCategory?.name, editTag?.name, {
        description: editTag?.description,
        name: editTag?.name,
        associatedTags: newTags,
      }).then((res: AxiosResponse) => {
        if (res.data) {
          fetchCurrentCategory(currentCategory?.name as string, true);
        }
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
              <i aria-hidden="true" className="fa fa-plus" />
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
                {category.name}
              </p>

              {getCountBadge(
                category.children?.length || 0,
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
        <p className="tw-text-2xl tw-text-center tw-m-auto">{error}</p>
      ) : (
        <PageContainerV1 className="tw-py-4">
          <PageLayout leftPanel={fetchLeftPanel()}>
            {isLoading ? (
              <Loader />
            ) : (
              <div data-testid="tags-container">
                {currentCategory && (
                  <div
                    className="tw-flex tw-justify-between tw-items-center"
                    data-testid="header">
                    <div
                      className="tw-heading tw-text-link tw-text-base"
                      data-testid="category-name">
                      {currentCategory.name}
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
                    description={currentCategory?.description || ''}
                    entityName={currentCategory?.displayName}
                    isEdit={isEditCategory}
                    onCancel={() => setIsEditCategory(false)}
                    onDescriptionEdit={() => setIsEditCategory(true)}
                    onDescriptionUpdate={UpdateCategory}
                  />
                </div>
                <div className="tw-bg-white">
                  <table
                    className="tw-w-full tw-overflow-x-auto"
                    data-testid="table">
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
                      {(currentCategory?.children as TagClass[])?.map(
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
                              <td
                                className="tw-group tableBody-cell"
                                onClick={() => {
                                  setIsEditTag(true);
                                  setEditTag(tag);
                                }}>
                                <NonAdminAction
                                  position="left"
                                  title={TITLE_FOR_NON_ADMIN_ACTION}>
                                  <div className="tw-cursor-pointer hover:tw-underline tw-flex">
                                    <div>
                                      {tag.description ? (
                                        <RichTextEditorPreviewer
                                          markdown={tag.description}
                                        />
                                      ) : (
                                        <span className="tw-no-description">
                                          No description added
                                        </span>
                                      )}
                                    </div>
                                    <button className="tw-self-start tw-w-8 tw-h-auto tw-opacity-0 tw-ml-1 group-hover:tw-opacity-100 focus:tw-outline-none">
                                      <SVGIcons
                                        alt="edit"
                                        data-testid="editTagDescription"
                                        icon="icon-edit"
                                        title="Edit"
                                        width="10px"
                                      />
                                    </button>
                                  </div>
                                </NonAdminAction>
                                <div className="tw-mt-1">
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
                                    <span className="tw-no-description">
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
                                    tagList={
                                      getTaglist(categories) as Array<string>
                                    }
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
                    header={`Adding new tag on ${currentCategory?.name}`}
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
