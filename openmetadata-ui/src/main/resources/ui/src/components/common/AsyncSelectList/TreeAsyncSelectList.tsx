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
import { DefaultOptionType } from 'antd/lib/select';
import { AxiosError } from 'axios';
import { isEmpty, isNil, isUndefined, pick } from 'lodash';
import { CustomTagProps } from 'rc-select/lib/BaseSelect';
import React, { FC, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZE_LARGE } from '../../../constants/constants';
import { TAG_START_WITH } from '../../../constants/Tag.constants';
import { Glossary } from '../../../generated/entity/data/glossary';
import { LabelType } from '../../../generated/entity/data/table';
import { Paging } from '../../../generated/type/paging';
import { TagLabel } from '../../../generated/type/tagLabel';
import {
  getGlossariesList,
  getGlossaryTerms,
  ListGlossaryTermsParams,
  searchGlossaryTerms,
} from '../../../rest/glossaryAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import {
  buildTree,
  findGlossaryTermFromID,
} from '../../../utils/GlossaryUtils';
import {
  fetchGlossaryList,
  getTagDisplay,
  tagRender,
} from '../../../utils/TagsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { ModifiedGlossaryTerm } from '../../Glossary/GlossaryTermTab/GlossaryTermTab.interface';
import TagsV1 from '../../Tag/TagsV1/TagsV1.component';
import Loader from '../Loader/Loader';
import {
  AsyncSelectListProps,
  SelectOption,
} from './AsyncSelectList.interface';

const TreeAsyncSelectList: FC<Omit<AsyncSelectListProps, 'fetchOptions'>> = ({
  onChange,
  initialOptions,
  tagType,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [hasContentLoading, setHasContentLoading] = useState(false);

  const [searchValue, setSearchValue] = useState<string>('');
  const [paging, setPaging] = useState<Paging>({} as Paging);
  const [currentPage, setCurrentPage] = useState(1);
  const selectedTagsRef = useRef<SelectOption[]>(initialOptions ?? []);
  const { t } = useTranslation();
  const [glossaries, setGlossaries] = useState([] as Glossary[]);
  const expandableKeys = useRef<string[]>([]);

  const onScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const { currentTarget } = e;
    if (
      currentTarget.scrollTop + currentTarget.offsetHeight ===
      currentTarget.scrollHeight
    ) {
      // optionFilteredCount added to equalize the options received from the server
      if (glossaries.length < paging.total) {
        try {
          setHasContentLoading(true);
          const res = await fetchGlossaryList(searchValue, currentPage + 1);
          //   setOptions((prev) => [...prev, ...getFilteredOptions(res.data)]);
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

  const handleChange: TreeSelectProps['onChange'] = (values: string[]) => {
    const selectedValues = values.map((value) => {
      const initialData = findGlossaryTermFromID(
        glossaries as ModifiedGlossaryTerm[],
        value
      );

      return initialData
        ? {
            value: initialData.fullyQualifiedName ?? '',
            label: getEntityName(initialData),
          }
        : {
            value,
            label: value,
          };
    });
    selectedTagsRef.current = selectedValues;
    onChange?.(selectedValues);
  };

  const fetchGlossaryListInternal = async () => {
    try {
      const { data, paging } = await getGlossariesList({
        limit: PAGE_SIZE_LARGE,
      });
      setGlossaries(data);
      setPaging(paging);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGlossaryListInternal();
  }, []);

  const fetchGlossaryTerm = async (params?: ListGlossaryTermsParams) => {
    if (!params?.glossary) {
      return;
    }
    setIsLoading(true);
    try {
      const { data } = await getGlossaryTerms({
        ...params,
        limit: 500,
        fields: 'children',
      });

      setGlossaries((prev) =>
        prev.map((glossary) => ({
          ...glossary,
          children:
            glossary.id === params?.glossary
              ? buildTree(data)
              : (glossary as ModifiedGlossaryTerm)['children'],
        }))
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const onSearch = async (value: string) => {
    await searchGlossaryTerms(value, 1);
  };

  const convertToTreeData = (
    options: ModifiedGlossaryTerm[] = []
  ): Omit<DefaultOptionType, 'label'>[] => {
    const treeData = options.map((option) => {
      const hasChildren = !isEmpty(option?.children);

      // Only include keys with no children or keys that are not expanded
      return {
        id: option.id,
        value: option.fullyQualifiedName,
        title: getEntityName(option),
        isLeaf: isNil(option.glossary) ? false : !hasChildren,
        children: convertToTreeData(option.children as ModifiedGlossaryTerm[]),
      };
    });

    return treeData;
  };

  useEffect(() => {
    if (glossaries.length) {
      expandableKeys.current = glossaries.map((glossary) => glossary.id);
    }
  }, [glossaries]);

  const treeData = useMemo(
    () => convertToTreeData(glossaries as ModifiedGlossaryTerm[]),
    [glossaries, expandableKeys.current]
  );

  return (
    <TreeSelect
      autoFocus
      showSearch
      treeCheckable
      data-testid="tag-selector"
      dropdownRender={dropdownRender}
      dropdownStyle={{ width: 300 }}
      loadData={({ id }) => {
        if (expandableKeys.current.includes(id)) {
          return fetchGlossaryTerm({ glossary: id });
        }

        return Promise.resolve();
      }}
      notFoundContent={isLoading ? <Loader size="small" /> : null}
      style={{ width: '100%' }}
      tagRender={customTagRender}
      treeData={treeData}
      onBlur={() => {
        setCurrentPage(1);
        setSearchValue('');
      }}
      onChange={handleChange}
      onInputKeyDown={(event) => {
        if (event.key === 'Backspace') {
          return event.stopPropagation();
        }
      }}
      onPopupScroll={onScroll}
      onSearch={onSearch}
      {...props}
    />
  );
};

export default TreeAsyncSelectList;
