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
import { Select } from 'antd';
import { AxiosError, AxiosResponse } from 'axios';
import classNames from 'classnames';
import { isEmpty, isEqual } from 'lodash';
import { EntityTags } from 'Models';
import React, { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { getTagSuggestions } from '../../axiosAPIs/miscAPI';
import { SearchIndex } from '../../enums/search.enum';
import { Source } from '../../generated/type/tagLabel';
import { withLoader } from '../../hoc/withLoader';
import { showErrorToast } from '../../utils/ToastUtils';
import { Button } from '../buttons/Button/Button';
import Tags from '../tags/tags';
import { TagsContainerProps } from './tags-container.interface';

const TagsContainer: FunctionComponent<TagsContainerProps> = ({
  children,
  editable,
  selectedTags,
  onCancel,
  onSelectionChange,
  className,
  containerClass,
  buttonContainerClass,
  showTags = true,
  showAddTagButton = false,
  isGlossaryTermAllowed = true,
}: TagsContainerProps) => {
  const { Option } = Select;
  const [tags, setTags] = useState<Array<EntityTags>>(selectedTags);
  const [options, setOptions] = useState<Array<EntityTags>>([]);

  const handleTagSelection = (selectedTag: unknown) => {
    if (!isEmpty(selectedTag)) {
      setTags((prevTags) => {
        const isTagSelected = prevTags.find((tag) =>
          isEqual(tag.tagFQN, selectedTag)
        );

        if (!isTagSelected) {
          const selectedTagEntity = options.find((tag) =>
            isEqual(tag._source.fullyQualifiedName, selectedTag)
          )._source;

          const source = isEqual(selectedTagEntity.entityType, 'tag')
            ? 'Tag'
            : 'Glossary';

          return [...prevTags, { tagFQN: selectedTag, source: source }];
        } else {
          return prevTags.filter((tag) => !isEqual(tag.tagFQN, selectedTag));
        }
      });
    } else {
      setTags([]);
    }
  };

  const handleTagRemoval = (removedTag: string, tagIdx: number) => {
    const updatedTags = tags.filter(
      (tag, index) => !(tag.tagFQN === removedTag && index === tagIdx)
    );
    onSelectionChange(updatedTags);
    setTags(updatedTags);
  };

  const handleSave = (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
    event.preventDefault();
    event.stopPropagation();
    onSelectionChange(tags);
  };

  const handleCancel = (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
    event.preventDefault();
    event.stopPropagation();
    setTags(selectedTags);
    onCancel(event);
  };

  const getTagsElement = (tag: EntityTags, index: number) => {
    return (
      <Tags
        editable
        isRemovable={tag.isRemovable}
        key={index}
        removeTag={(_e, removedTag: string) => {
          handleTagRemoval(removedTag, index);
        }}
        showOnlyName={tag.source === Source.Glossary}
        tag={tag}
        type="border"
      />
    );
  };

  const fetchOptions = (query: string) => {
    const index = !isGlossaryTermAllowed ? SearchIndex.TAG : undefined;
    getTagSuggestions(query, index)
      .then((res: AxiosResponse) => {
        const suggestOptions =
          res.data.suggest['metadata-suggest'][0].options ?? [];

        setOptions(suggestOptions);
      })
      .catch((err: AxiosError) => showErrorToast(err));
  };

  const handleSearch = (newValue: string) => {
    if (newValue) {
      fetchOptions(newValue);
    } else {
      setOptions([]);
    }
  };

  useEffect(() => {
    setTags(selectedTags);
  }, [selectedTags]);

  return (
    <div
      className={classNames('tw-cursor-pointer', containerClass)}
      data-testid="tag-container">
      <div>
        {showTags && !editable && (
          <Fragment>
            {showAddTagButton && (
              <span className="tw-text-primary">
                <Tags
                  className="tw-font-semibold"
                  startWith="+ "
                  tag="Tags"
                  type="border"
                />
              </span>
            )}
            {tags.map(getTagsElement)}
          </Fragment>
        )}
        {editable ? (
          <>
            <Select
              allowClear
              autoFocus
              showSearch
              bordered={false}
              className={classNames(
                'tw-bg-white tw-border tw-border-gray-400 tw-rounded tw-w-64',
                className
              )}
              data-testid="tag-select"
              defaultActiveFirstOption={false}
              dropdownClassName="ant-suggestion-dropdown"
              filterOption={false}
              mode="multiple"
              notFoundContent={null}
              placeholder="Search to Select"
              showArrow={false}
              value={tags.map((t) => t.tagFQN)}
              onDeselect={handleTagSelection}
              onSearch={handleSearch}
              onSelect={handleTagSelection}>
              {options.map((option) => (
                <Option
                  data-testid="tag-option"
                  key={option._source.fullyQualifiedName}>
                  {option._source.fullyQualifiedName}
                </Option>
              ))}
            </Select>
          </>
        ) : (
          children
        )}
      </div>
      {editable && (
        <div
          className={classNames(
            'tw-flex tw-justify-end tw-mt-2',
            buttonContainerClass
          )}
          data-testid="buttons">
          <Button
            className="tw-px-1 tw-py-1 tw-rounded tw-text-sm tw-mr-1"
            data-testid="cancelAssociatedTag"
            size="custom"
            theme="primary"
            variant="contained"
            onMouseDown={handleCancel}>
            <FontAwesomeIcon className="tw-w-3.5 tw-h-3.5" icon="times" />
          </Button>
          <Button
            className="tw-px-1 tw-py-1 tw-rounded tw-text-sm"
            data-testid="saveAssociatedTag"
            size="custom"
            theme="primary"
            variant="contained"
            onMouseDown={handleSave}>
            <FontAwesomeIcon className="tw-w-3.5 tw-h-3.5" icon="check" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default withLoader<TagsContainerProps>(TagsContainer);
