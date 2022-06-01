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
import { isEmpty } from 'lodash';
import { EntityTags, TagOption } from 'Models';
import React, {
  Fragment,
  FunctionComponent,
  useEffect,
  useRef,
  useState,
} from 'react';
import AsyncSelect from 'react-select/async';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { Source } from '../../generated/type/tagLabel';
import { withLoader } from '../../hoc/withLoader';
import { Button } from '../buttons/Button/Button';
import Tags from '../tags/tags';
import { TagsContainerProps } from './tags-container.interface';

interface Option {
  label: string;
  value: string;
}

const TagsContainer: FunctionComponent<TagsContainerProps> = ({
  children,
  editable,
  selectedTags,
  tagList,
  onCancel,
  onSelectionChange,
  showTags = true,
  showAddTagButton = false,
}: TagsContainerProps) => {
  const [tags, setTags] = useState<Array<EntityTags>>(selectedTags);
  const [hasFocus, setFocus] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const node = useRef<HTMLDivElement>(null);

  const focusInputBox = () => {
    if (editable && inputRef.current) {
      inputRef.current.focus();
      setFocus(true);
    }
  };

  const getTagList = (inputValue: string) => {
    const newTags = (tagList as TagOption[])
      .filter((tag) => {
        return !tags.some((selectedTag) => selectedTag.tagFQN === tag.fqn);
      })
      .filter((tag) => !tag.fqn?.startsWith(`Tier${FQN_SEPARATOR_CHAR}Tier`)) // To filter out Tier tags
      .map((tag) => {
        return {
          label: tag.fqn,
          value: tag.fqn,
        };
      })
      .filter((i) => i.label.toLowerCase().includes(inputValue.toLowerCase()));

    return newTags;
  };

  const handleTagSelection = (selectedTag: unknown) => {
    if (!isEmpty(selectedTag)) {
      setTags(() => {
        const updatedTags = (selectedTag as Option[]).map((t) => {
          return {
            tagFQN: t.value,
            source: (tagList as TagOption[]).find((tag) => tag.fqn === t.value)
              ?.source,
          };
        });

        return updatedTags;
      });
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

  const loadOptions = (inputValue: string) =>
    new Promise<Option[]>((resolve) => {
      setTimeout(() => {
        resolve(getTagList(inputValue));
      }, 1000);
    });

  const getDefaultTags = () => {
    return tags.map((tag) => {
      return {
        label: tag.tagFQN,
        value: tag.tagFQN,
      };
    });
  };

  useEffect(() => {
    setTags(selectedTags);
  }, [selectedTags]);

  return (
    <div
      className={classNames(
        'tw-cursor-pointer',
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
      <div className="">
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
          <AsyncSelect
            cacheOptions
            defaultOptions
            isMulti
            className="tw-w-64"
            data-testid="tag-select"
            defaultValue={getDefaultTags}
            loadOptions={loadOptions}
            onChange={handleTagSelection}
          />
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
