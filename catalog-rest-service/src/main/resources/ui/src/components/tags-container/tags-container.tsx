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

import classNames from 'classnames';
import { capitalize, isEmpty } from 'lodash';
import { ColumnTags } from 'Models';
import React, { FunctionComponent, useEffect, useRef, useState } from 'react';
import { Button } from '../buttons/Button/Button';
import PopOver from '../common/popover/PopOver';
import DropDownList from '../dropdown/DropDownList';
import Tags from '../tags/tags';
import { TagsContainerProps } from './tags-container.interface';

// const INPUT_COLLAPED = '1px';
// const INPUT_EXPANDED = '150px';
// const INPUT_AUTO = 'auto';

const TagsContainer: FunctionComponent<TagsContainerProps> = ({
  children,
  editable,
  selectedTags,
  tagList,
  onCancel,
  onSelectionChange,
  showTags = true,
}: TagsContainerProps) => {
  const [tags, setTags] = useState<Array<ColumnTags>>(selectedTags);
  const [newTag, setNewTag] = useState<string>('');
  const [hasFocus, setFocus] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const node = useRef<HTMLDivElement>(null);
  // const [inputWidth, setInputWidth] = useState(INPUT_COLLAPED);
  // const [inputMinWidth, setInputMinWidth] = useState(INPUT_AUTO);

  // const expandInput = () => {
  //   setInputWidth(INPUT_AUTO);
  //   setInputMinWidth(INPUT_EXPANDED);
  // };

  const collapseInput = () => {
    // setInputWidth(INPUT_COLLAPED);
    // setInputMinWidth(INPUT_AUTO);
    setNewTag('');
  };

  const focusInputBox = () => {
    if (editable && inputRef.current) {
      inputRef.current.focus();
      setFocus(true);
    }
  };

  const getTagList = () => {
    const newTags = tagList
      .filter((tag) => {
        return !tags.some((selectedTag) => selectedTag.tagFQN === tag);
      })
      .map((tag) => {
        return {
          name: tag,
          value: tag,
        };
      });

    return newTags;
  };

  const handleTagSelection = (
    event: React.MouseEvent<HTMLElement, MouseEvent>,
    selectedTag?: string
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (selectedTag) {
      setTags((arrTags) => {
        const tag =
          arrTags.filter((tag) => tag.tagFQN === selectedTag)[0] || {};
        if (!isEmpty(tag)) {
          return [...arrTags, { ...tag, tagFQN: selectedTag }];
        } else {
          return [...arrTags, { tagFQN: selectedTag }];
        }
      });
    }
    setNewTag('');
    focusInputBox();
  };

  const handleTagRemoval = (removedTag: string, tagIdx: number) => {
    setTags((arrTags) => {
      return arrTags.filter(
        (tag, index) => !(tag.tagFQN === removedTag && index === tagIdx)
      );
    });
  };

  const handleSave = (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
    event.preventDefault();
    event.stopPropagation();
    collapseInput();
    onSelectionChange(tags);
  };

  const handleCancel = (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
    event.preventDefault();
    event.stopPropagation();
    collapseInput();
    setTags(selectedTags);
    onCancel(event);
  };

  const getTagsContainer = (tag: ColumnTags, index: number) => {
    return tag.tagFQN ? (
      <Tags
        className="tw-bg-gray-200"
        editable={editable}
        isRemovable={tag.isRemovable}
        key={index}
        removeTag={(_e, removedTag: string) => {
          handleTagRemoval(removedTag, index);
        }}
        tag={`#${tag.tagFQN}`}
      />
    ) : null;
  };

  const getTagsElement = (tag: ColumnTags, index: number) => {
    if (tag.labelType) {
      return (
        <PopOver
          key={index}
          position="top"
          size="small"
          title={capitalize(tag.labelType)}
          trigger="mouseenter">
          {getTagsContainer(tag, index)}
        </PopOver>
      );
    } else {
      return getTagsContainer(tag, index);
    }
  };
  const handleClick = (e: MouseEvent) => {
    if (node?.current?.contains(e.target as Node)) {
      return;
    } else {
      e.stopPropagation();
      handleCancel(e as unknown as React.MouseEvent<HTMLElement, MouseEvent>);
    }
  };

  useEffect(() => {
    setTags(selectedTags);
  }, [selectedTags]);

  useEffect(() => {
    if (editable) {
      document.addEventListener('mousedown', handleClick);
    } else {
      document.removeEventListener('mousedown', handleClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [editable]);

  return (
    <div
      className={classNames(
        editable
          ? 'tw-bg-white tw-p-1 tw-border-2 tw-rounded tw-cursor-text'
          : 'tw-cursor-pointer',
        { 'tw-border-primary': hasFocus },
        { 'hover:tw-border-main': !hasFocus }
      )}
      data-testid="tag-conatiner"
      ref={node}
      onClick={(event) => {
        if (editable) {
          event.preventDefault();
          event.stopPropagation();
          focusInputBox();
        }
      }}>
      <div className="tw-flex tw-flex-wrap">
        {(showTags || editable) && (
          <>{tags.map((tag, index) => getTagsElement(tag, index))}</>
        )}
        {editable ? (
          <span className="tw-relative">
            <input
              className="tw-flex-1 tw-border-0 tw-px-1 focus:tw-outline-none"
              data-testid="associatedTagName"
              placeholder="Enter tag name..."
              ref={inputRef}
              // style={{ width: inputWidth, minWidth: inputMinWidth }}
              value={newTag}
              onBlur={() => {
                if (inputRef.current && !newTag) {
                  collapseInput();
                }
              }}
              onChange={(event) => {
                setNewTag(event.target.value);
              }}
              // onFocus={() => {
              //   if (inputRef.current) {
              //     expandInput();
              //   }
              // }}
            />
            {newTag && (
              <DropDownList
                horzPosRight
                dropDownList={getTagList()}
                searchString={newTag}
                onSelect={handleTagSelection}
              />
            )}
          </span>
        ) : (
          children
        )}
      </div>
      {editable && (
        <div className="tw-flex tw-justify-end tw-mt-2" data-testid="buttons">
          <Button
            className="tw-px-1 tw-py-1 tw-rounded tw-text-sm tw-mr-1"
            data-testid="cancelAssociatedTag"
            size="custom"
            theme="primary"
            variant="contained"
            onMouseDown={handleCancel}>
            <i aria-hidden="true" className="fa fa-times tw-w-3.5 tw-h-3.5" />
          </Button>
          <Button
            className="tw-px-1 tw-py-1 tw-rounded tw-text-sm"
            data-testid="saveAssociatedTag"
            size="custom"
            theme="primary"
            variant="contained"
            onMouseDown={handleSave}>
            <i aria-hidden="true" className="fa fa-check tw-w-3.5 tw-h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default TagsContainer;
