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
import classNames from 'classnames';
import { isNull } from 'lodash';
import { EntityTags, TagOption } from 'Models';
import React, { FunctionComponent, useEffect, useRef, useState } from 'react';
import { Source } from '../../generated/type/tagLabel';
import { withLoader } from '../../hoc/withLoader';
import { Button } from '../buttons/Button/Button';
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
  type,
  dropDownHorzPosRight = true,
}: TagsContainerProps) => {
  const [tags, setTags] = useState<Array<EntityTags>>(selectedTags);
  const [newTag, setNewTag] = useState<string>('');
  const [hasFocus, setFocus] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const node = useRef<HTMLDivElement>(null);
  const [inputDomRect, setInputDomRect] = useState<DOMRect>();
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

  useEffect(() => {
    if (!isNull(inputRef.current)) {
      setInputDomRect(inputRef.current.getBoundingClientRect());
    }
  }, [newTag]);

  const getTagList = () => {
    const newTags = (tagList as TagOption[])
      .filter((tag) => {
        return !tags.some((selectedTag) => selectedTag.tagFQN === tag.fqn);
      })
      .filter((tag) => !tag.fqn?.startsWith('Tier.Tier')) // To filter out Tier tags
      .map((tag) => {
        return {
          name: tag.fqn,
          value: tag.fqn,
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
        const source = (tagList as TagOption[]).find(
          (tag) => tag.fqn === selectedTag
        )?.source;

        return [...arrTags, { tagFQN: selectedTag, source }];
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

  const getTagsElement = (tag: EntityTags, index: number) => {
    return (
      <Tags
        className={classNames({
          'tw-bg-gray-200': editable || type === 'contained',
        })}
        editable={editable}
        isRemovable={tag.isRemovable}
        key={index}
        removeTag={(_e, removedTag: string) => {
          handleTagRemoval(removedTag, index);
        }}
        showOnlyName={tag.source === Source.Glossary}
        startWith="#"
        tag={tag}
        type={editable ? 'contained' : type}
      />
    );
  };

  const handleChange = (e: React.ChangeEvent<{ value: string }>): void => {
    const searchText = e.target.value;
    setNewTag(searchText);
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
      data-testid="tag-container"
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
                handleChange(event);
              }}
              // onFocus={() => {
              //   if (inputRef.current) {
              //     expandInput();
              //   }
              // }}
            />
            {newTag ? (
              <DropDownList
                domPosition={inputDomRect}
                dropDownList={getTagList()}
                horzPosRight={dropDownHorzPosRight}
                searchString={newTag}
                widthClass="tw-w-80"
                onSelect={handleTagSelection}
              />
            ) : null}
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
