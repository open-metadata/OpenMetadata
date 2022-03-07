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

import { AxiosResponse } from 'axios';
import classNames from 'classnames';
import { debounce, isEmpty, isNull } from 'lodash';
import { EntityTags, FormatedGlossaryTermData, SearchResponse } from 'Models';
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { getSuggestions, searchData } from '../../axiosAPIs/miscAPI';
import { WILD_CARD_CHAR } from '../../constants/char.constants';
import { SearchIndex } from '../../enums/search.enum';
import { withLoader } from '../../hoc/withLoader';
import { formatSearchGlossaryTermResponse } from '../../utils/APIUtils';
import { Button } from '../buttons/Button/Button';
import DropDownList from '../dropdown/DropDownList';
import Tags from '../tags/tags';
import { TagsContainerProps } from './tags-container.interface';

// const INPUT_COLLAPED = '1px';
// const INPUT_EXPANDED = '150px';
// const INPUT_AUTO = 'auto';

const TagsContainer: FunctionComponent<TagsContainerProps> = ({
  allowGlossary,
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
  const [glossaryList, setGlossaryList] = useState<FormatedGlossaryTermData[]>(
    []
  );
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

  const fetchGlossaryResults = useCallback((): Promise<
    FormatedGlossaryTermData[]
  > => {
    return new Promise<FormatedGlossaryTermData[]>((resolve, reject) => {
      if (isEmpty(newTag)) {
        searchData(WILD_CARD_CHAR, 1, 1, '', '', '', SearchIndex.GLOSSARY)
          .then((res: SearchResponse) => {
            const data = formatSearchGlossaryTermResponse(res.data.hits.hits);
            resolve(data);
          })
          .catch(() => reject());
      } else {
        getSuggestions(newTag, SearchIndex.GLOSSARY)
          .then((res: AxiosResponse) => {
            const data = formatSearchGlossaryTermResponse(
              res.data.suggest['table-suggest'][0].options
            );
            resolve(data);
          })
          .catch(() => reject());
      }
    });
  }, [newTag]);

  const getGlossaryResults = useCallback(() => {
    if (allowGlossary) {
      fetchGlossaryResults().then((res) => setGlossaryList(res));
    }
  }, [allowGlossary, fetchGlossaryResults]);

  const getTagList = () => {
    const newTags = tagList
      .filter((tag) => {
        return !tags.some((selectedTag) => selectedTag.tagFQN === tag);
      })
      .filter((tag) => !tag.includes('Tier'))
      .map((tag) => {
        return {
          name: tag,
          value: tag,
        };
      });

    const newGlossaries = glossaryList
      .filter((glossary) => {
        return !tags.some(
          (selectedTag) => selectedTag.tagFQN === glossary.fqdn
        );
      })
      .map((glossary) => {
        return {
          name: glossary.name,
          value: glossary.fqdn,
        };
      });

    return allowGlossary ? [...newTags, ...newGlossaries] : newTags;
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
        startWith="#"
        tag={tag}
        type={editable ? 'contained' : type}
      />
    );
  };

  const debouncedOnSearch = useCallback((): void => {
    getGlossaryResults();
  }, [getGlossaryResults]);

  const debounceOnSearch = useCallback(debounce(debouncedOnSearch, 1500), [
    debouncedOnSearch,
  ]);

  const handleChange = (e: React.ChangeEvent<{ value: string }>): void => {
    const searchText = e.target.value;
    setNewTag(searchText);
    // clearTimeout(typingTimer.current);
    // typingTimer.current = setTimeout(() => {
    debounceOnSearch();
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

  useEffect(() => {
    getGlossaryResults();
  }, []);

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
                handleChange(event);
              }}
              // onFocus={() => {
              //   if (inputRef.current) {
              //     expandInput();
              //   }
              // }}
            />
            {newTag && (
              <DropDownList
                domPosition={inputDomRect}
                dropDownList={getTagList()}
                horzPosRight={dropDownHorzPosRight}
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

export default withLoader<TagsContainerProps>(TagsContainer);
