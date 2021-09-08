/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import { AxiosResponse } from 'axios';
import { ColumnTags } from 'Models';
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
import NonAdminAction from '../../components/common/non-admin-action/NonAdminAction';
import RichTextEditorPreviewer from '../../components/common/rich-text-editor/RichTextEditorPreviewer';
import PageContainer from '../../components/containers/PageContainer';
import Loader from '../../components/Loader/Loader';
import FormModal from '../../components/Modals/FormModal';
import { ModalWithMarkdownEditor } from '../../components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import TagsContainer from '../../components/tags-container/tags-container';
import Tags from '../../components/tags/tags';
import { getExplorePathWithSearch } from '../../constants/constants';
import { isEven } from '../../utils/CommonUtils';
import SVGIcons from '../../utils/SvgUtils';
import { getTagCategories, getTaglist } from '../../utils/TagsUtils';
import Form from './Form';
import { Tag, TagsCategory } from './tagsTypes';
const TagsPage = () => {
  const [categories, setCategoreis] = useState<Array<TagsCategory>>([]);
  const [currentCategory, setCurrentCategory] = useState<TagsCategory>();
  const [isEditCategory, setIsEditCategory] = useState<boolean>(false);
  const [isAddingCategory, setIsAddingCategory] = useState<boolean>(false);
  const [isEditTag, setIsEditTag] = useState<boolean>(false);
  const [isAddingTag, setIsAddingTag] = useState<boolean>(false);
  const [editTag, setEditTag] = useState<Tag>();
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

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
        if (err.response.data.code) {
          setError('No Data Found');
        }
        setIsLoading(false);
      }
    }
  };

  const currentCategoryTab = (name: string) => {
    if (currentCategory?.name === name) {
      return 'activeCategory';
    } else {
      return '';
    }
  };

  const createCategory = (data: TagsCategory) => {
    createTagCategory(data).then((res: AxiosResponse) => {
      if (res.data) {
        fetchCategories();
      }
    });
    setIsAddingCategory(false);
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

  const createPrimaryTag = (data: TagsCategory) => {
    createTag(currentCategory?.name, {
      name: data.name,
      description: data.description,
    }).then((res: AxiosResponse) => {
      if (res.data) {
        fetchCurrentCategory(currentCategory?.name as string, true);
      }
    });
    setIsAddingTag(false);
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

  const handleTagSelection = (tags?: Array<ColumnTags>) => {
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
        <div className="tw-flex tw-justify-between tw-items-baseline tw-mb-3 tw-border-b">
          <h6 className="tw-heading">Tag Categories</h6>
          <NonAdminAction
            position="bottom"
            title="Only Admin is allowed for the action">
            <Button
              className="tw-h-7 tw-px-2"
              size="small"
              theme="primary"
              variant="contained"
              onClick={() => setIsAddingCategory((prevState) => !prevState)}>
              <i aria-hidden="true" className="fa fa-plus" />
            </Button>
          </NonAdminAction>
        </div>
        {categories &&
          categories.map((category: TagsCategory) => (
            <div
              className={`tw-group tw-text-grey-body tw-cursor-pointer tw-text-body tw-mb-3 tw-flex tw-justify-between ${currentCategoryTab(
                category.name
              )}`}
              key={category.name}
              onClick={() => {
                fetchCurrentCategory(category.name);
              }}>
              <p className="tw-text-center tw-self-center tag-category">
                {category.name}
              </p>

              <p className="tw-bg-gray-200 tw-px-2 tw-py-1 tw-rounded tw-text-xs">
                {category.usageCount}
              </p>
            </div>
          ))}
      </>
    );
  };

  return (
    <>
      {isLoading ? (
        <Loader />
      ) : (
        <PageContainer className="py-0" leftPanelContent={fetchLeftPanel()}>
          {error ? (
            <p className="tw-text-2xl tw-text-center tw-m-auto">{error}</p>
          ) : (
            <div className="container-fluid py-3">
              {currentCategory && (
                <div className="tw-flex tw-justify-between tw-pl-1">
                  <div className="tw-heading tw-text-link tw-text-base">
                    {currentCategory.name}
                  </div>
                  <NonAdminAction
                    position="bottom"
                    title="Only Admin is allowed for the action">
                    <Button
                      className="tw-h-8 tw-rounded tw-mb-2"
                      size="small"
                      theme="primary"
                      variant="contained"
                      onClick={() => setIsAddingTag((prevState) => !prevState)}>
                      Add new tag
                    </Button>
                  </NonAdminAction>
                </div>
              )}
              <div className="tw-flex tw-flex-col tw-border tw-border-main tw-rounded-md tw-mb-3 tw-min-h-32 tw-bg-white">
                <div className="tw-flex tw-items-center tw-px-3 tw-py-1 tw-border-b tw-border-main">
                  <span className="tw-flex-1 tw-leading-8 tw-m-0 tw-font-normal">
                    Description
                  </span>
                  <div className="tw-flex-initial">
                    <NonAdminAction
                      position="bottom"
                      title="Only Admin is allowed for the action">
                      <button
                        className="focus:tw-outline-none"
                        onClick={() => setIsEditCategory(true)}>
                        <SVGIcons
                          alt="edit"
                          icon="icon-edit"
                          title="Edit"
                          width="12px"
                        />
                      </button>
                    </NonAdminAction>
                  </div>
                </div>
                <div className="tw-px-3 tw-pl-5 tw-py-2 tw-overflow-y-auto">
                  {currentCategory && (
                    <div data-testid="description" id="description">
                      {currentCategory.description ? (
                        <RichTextEditorPreviewer
                          markdown={currentCategory.description}
                        />
                      ) : (
                        <span className="tw-no-description">
                          No description added
                        </span>
                      )}
                      {isEditCategory && (
                        <ModalWithMarkdownEditor
                          header={`Edit description for ${currentCategory.name}`}
                          placeholder="Enter Description"
                          value={currentCategory.description}
                          onCancel={() => setIsEditCategory(false)}
                          onSave={UpdateCategory}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="tw-bg-white">
                <table className="tw-w-full tw-overflow-x-auto">
                  <thead>
                    <tr className="tableHead-row">
                      <th className="tableHead-cell">Name</th>
                      <th className="tableHead-cell">Description</th>
                      <th className="tableHead-cell tw-w-60">
                        Associated tags
                      </th>
                    </tr>
                  </thead>
                  <tbody className="tw-text-sm">
                    {currentCategory?.children?.map(
                      (tag: Tag, index: number) => {
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
                                    icon="icon-edit"
                                    title="Edit"
                                    width="10px"
                                  />
                                </button>
                              </div>
                              <div className="tw-mt-1">
                                <span className="tw-text-grey-muted tw-mr-1">
                                  Usage:
                                </span>
                                {tag.usageCount ? (
                                  <Link
                                    className="link-text tw-align-middle"
                                    to={getUsageCountLink(
                                      tag.fullyQualifiedName
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
                              <TagsContainer
                                editable={
                                  editTag?.name === tag.name && !isEditTag
                                }
                                selectedTags={tag.associatedTags.map((tag) => ({
                                  tagFQN: tag,
                                }))}
                                tagList={
                                  getTaglist(categories) as Array<string>
                                }
                                onCancel={() => {
                                  handleTagSelection();
                                }}
                                onSelectionChange={(tags) => {
                                  handleTagSelection(tags);
                                }}>
                                {tag.associatedTags.length ? (
                                  <button className="tw-opacity-0 tw-ml-1 group-hover:tw-opacity-100 focus:tw-outline-none">
                                    <SVGIcons
                                      alt="edit"
                                      icon="icon-edit"
                                      title="Edit"
                                      width="10px"
                                    />
                                  </button>
                                ) : (
                                  <span className="tw-opacity-0 group-hover:tw-opacity-100">
                                    <Tags
                                      className="tw-border-main"
                                      tag="+ Add tag"
                                      type="outlined"
                                    />
                                  </span>
                                )}
                              </TagsContainer>
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
                  form={Form}
                  header="Adding new category"
                  initialData={{
                    name: '',
                    description: '',
                    categoryType: 'Descriptive',
                  }}
                  onCancel={() => setIsAddingCategory(false)}
                  onSave={(data) => createCategory(data)}
                />
              )}
              {isAddingTag && (
                <FormModal
                  form={Form}
                  header={`Adding new tag on ${currentCategory?.name}`}
                  initialData={{
                    name: '',
                    description: '',
                    categoryType: '',
                  }}
                  onCancel={() => setIsAddingTag(false)}
                  onSave={(data) => createPrimaryTag(data)}
                />
              )}
            </div>
          )}
        </PageContainer>
      )}
    </>
  );
};

export default TagsPage;
