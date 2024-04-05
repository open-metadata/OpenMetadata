/*
 *  Copyright 2023 Collate.
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
import { CloseOutlined } from '@ant-design/icons';
import { TagProps, TreeSelect, TreeSelectProps } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, isUndefined, pick } from 'lodash';
import { CustomTagProps } from 'rc-select/lib/BaseSelect';
import React, { FC, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  API_RES_MAX_SIZE,
  PAGE_SIZE_LARGE,
} from '../../../constants/constants';
import { TAG_START_WITH } from '../../../constants/Tag.constants';
import { Glossary } from '../../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { LabelType } from '../../../generated/entity/data/table';
import { Paging } from '../../../generated/type/paging';
import { TagLabel } from '../../../generated/type/tagLabel';
import {
  getGlossariesList,
  getGlossaryTerms,
  ListGlossaryTermsParams,
} from '../../../rest/glossaryAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { buildTree } from '../../../utils/GlossaryUtils';
import { getTagDisplay, tagRender } from '../../../utils/TagsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import TagsV1 from '../../Tag/TagsV1/TagsV1.component';
import Loader from '../Loader/Loader';
import {
  AsyncSelectListProps,
  SelectOption,
} from './AsyncSelectList.interface';

const TreeAsyncSelectList: FC<AsyncSelectListProps> = ({
  onChange,
  fetchOptions,
  initialOptions,
  filterOptions = [],
  tagType,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [hasContentLoading, setHasContentLoading] = useState(false);
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [searchValue, setSearchValue] = useState<string>('');
  const [paging, setPaging] = useState<Paging>({} as Paging);
  const [currentPage, setCurrentPage] = useState(1);
  const selectedTagsRef = useRef<SelectOption[]>(initialOptions ?? []);
  const { t } = useTranslation();
  const [optionFilteredCount, setOptionFilteredCount] = useState(0);
  const [glossaries, setGlossaries] = useState([] as Glossary[]);
  const [isTermsLoading, setIsTermsLoading] = useState(false);
  const [glossaryTerms, setGlossaryTerms] = useState<GlossaryTerm[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const getFilteredOptions = (data: SelectOption[]) => {
    if (isEmpty(filterOptions)) {
      return data;
    }

    let count = optionFilteredCount;

    const filteredData = data.filter((item) => {
      const isFiltered = filterOptions.includes(
        item.data?.fullyQualifiedName ?? ''
      );
      if (isFiltered) {
        count = optionFilteredCount + 1;
      }

      return !isFiltered;
    });

    setOptionFilteredCount(count);

    return filteredData;
  };

  const onScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const { currentTarget } = e;
    if (
      currentTarget.scrollTop + currentTarget.offsetHeight ===
      currentTarget.scrollHeight
    ) {
      // optionFilteredCount added to equalize the options received from the server
      if (options.length + optionFilteredCount < paging.total) {
        try {
          setHasContentLoading(true);
          const res = await fetchOptions(searchValue, currentPage + 1);
          setOptions((prev) => [...prev, ...getFilteredOptions(res.data)]);
          setPaging(res.paging);
          setCurrentPage((prev) => prev + 1);
        } catch (error) {
          showErrorToast(error as AxiosError);
        } finally {
          setHasContentLoading(false);
        }
      }
    }
  };

  const dropdownRender = (menu: React.ReactElement) => (
    <>
      {menu}
      {hasContentLoading ? <Loader size="small" /> : null}
    </>
  );

  const customTagRender = (data: CustomTagProps) => {
    const selectedTag = selectedTagsRef.current.find(
      (tag) => tag.value === data.label
    );

    if (isUndefined(selectedTag?.data)) {
      return tagRender(data);
    }

    const { label, onClose } = data;
    const tagLabel = getTagDisplay(label as string);
    const tag = {
      tagFQN: selectedTag?.data.fullyQualifiedName,
      ...pick(
        selectedTag?.data,
        'description',
        'displayName',
        'name',
        'style',
        'tagFQN'
      ),
    } as TagLabel;

    const onPreventMouseDown = (event: React.MouseEvent<HTMLSpanElement>) => {
      event.preventDefault();
      event.stopPropagation();
    };

    const isDerived =
      (selectedTag?.data as TagLabel).labelType === LabelType.Derived;

    const tagProps = {
      closable: !isDerived,
      closeIcon: !isDerived && (
        <CloseOutlined
          className="p-r-xs"
          data-testid="remove-tags"
          height={8}
          width={8}
        />
      ),
      'data-testid': `selected-tag-${tagLabel}`,
      onClose: !isDerived ? onClose : null,
      onMouseDown: onPreventMouseDown,
    } as TagProps;

    return (
      <TagsV1
        startWith={TAG_START_WITH.SOURCE_ICON}
        tag={tag}
        tagProps={tagProps}
        tagType={tagType}
        tooltipOverride={
          isDerived ? t('message.derived-tag-warning') : undefined
        }
      />
    );
  };

  const handleChange: TreeSelectProps['onChange'] = (
    values: string[],
    options
  ) => {
    const selectedValues = values.map((value) => {
      const initialData = initialOptions?.find(
        (item) => item.value === value
      )?.data;
      const data = (options as SelectOption[]).find(
        (option) => option.value === value
      );

      return (
        (initialData
          ? {
              value,
              label: value,
              data: initialData,
            }
          : data) ?? {
          value,
          label: value,
        }
      );
    });
    selectedTagsRef.current = selectedValues;
    onChange?.(selectedValues);
  };
  const fetchGlossaryList = async () => {
    //   setIsRightPanelLoading(true);
    //   setIsLoading(true);
    try {
      const { data } = await getGlossariesList({
        fields: 'owner,tags,reviewers,votes,domain',
        limit: PAGE_SIZE_LARGE,
      });
      setGlossaries(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
      // setIsRightPanelLoading(false);
    }
  };

  const fetchGlossaryTerm = async (
    params?: ListGlossaryTermsParams,
    refresh?: boolean
  ) => {
    refresh ? setIsTermsLoading(true) : setIsLoading(true);
    try {
      const { data } = await getGlossaryTerms({
        ...params,
        limit: API_RES_MAX_SIZE,
        fields: 'children,owner,parent',
      });

      setGlossaries((prev) =>
        prev.map((glossary) => ({
          ...glossary,
          children:
            glossary.id === params?.glossary
              ? buildTree(data)
              : glossary['children'],
        }))
      );
      setGlossaryTerms(data);
    } catch (error) {
      //   showErrorToast(error as AxiosError);
    } finally {
      refresh ? setIsTermsLoading(false) : setIsLoading(false);
    }
  };

  //   const loadGlossaryTerms = useCallback(
  //     (refresh = false) => {
  //       fetchGlossaryTerm(
  //         isGlossaryActive ? { glossary: id } : { parent: id },
  //         refresh
  //       );
  //     },
  //     [id, isGlossaryActive]
  //   );
  useEffect(() => {
    fetchGlossaryList();
    // loadGlossaryTerms();
    // fetchGlossaryTerm();
  }, []);
  const convertToTreeData = (
    options: GlossaryTerm[] = [],
    expandedKeys: string[]
  ) => {
    const treeData = options.map((option) => {
      const hasChildren = !isEmpty(option?.children);
      const isExpanded = expandedKeys.includes(option.id); // Check if the current key is expanded
      if (!hasChildren || !isExpanded) {
        // Only include keys with no children or keys that are not expanded
        return {
          key: option.id,
          value: option.id,
          title: getEntityName(option),
          isLeaf: false,
        };
      } else {
        return {
          key: option.id,
          value: option.id,
          title: getEntityName(option),
          children: convertToTreeData(
            option.children as unknown as GlossaryTerm[],
            expandedKeys
          ),
          isLeaf: false,
        };
      }
    });

    return treeData;
  };

  const treeData = useMemo(
    () => convertToTreeData(glossaries, expandedKeys),
    [glossaries, expandedKeys]
  );

  return (
    <TreeSelect
      autoFocus
      showSearch
      treeCheckable
      data-testid="tag-selector"
      dropdownMatchSelectWidth={false}
      dropdownRender={dropdownRender}
      dropdownStyle={{ width: 300 }}
      notFoundContent={isLoading ? <Loader size="small" /> : null}
      popupClassName="bg-red"
      style={{ width: '100%' }}
      tagRender={customTagRender}
      treeData={treeData}
      onBlur={() => {
        setCurrentPage(1);
        setSearchValue('');
        setOptions([]);
      }}
      onChange={handleChange}
      //   onFocus={() => loadOptions('')}
      onInputKeyDown={(event) => {
        if (event.key === 'Backspace') {
          return event.stopPropagation();
        }
      }}
      onPopupScroll={onScroll}
      //   onSearch={debounceFetcher}

      onTreeExpand={(keys) => {
        setExpandedKeys(keys as string[]);
        keys.forEach((key: string) => {
          if (!expandedKeys.includes(key)) {
            fetchGlossaryTerm({ glossary: key, refresh: true });
          }
        });
      }}
      {...props}
    />
  );
};

export default TreeAsyncSelectList;
