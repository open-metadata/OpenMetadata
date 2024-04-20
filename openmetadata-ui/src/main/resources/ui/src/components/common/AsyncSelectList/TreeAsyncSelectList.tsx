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
import {
  Button,
  Form,
  Space,
  TagProps,
  TreeSelect,
  TreeSelectProps,
} from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import { Key } from 'antd/lib/table/interface';
import { AxiosError } from 'axios';
import { debounce, isEmpty, isUndefined, pick } from 'lodash';
import { CustomTagProps } from 'rc-select/lib/BaseSelect';
import React, { FC, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZE_LARGE } from '../../../constants/constants';
import { TAG_START_WITH } from '../../../constants/Tag.constants';
import { Glossary } from '../../../generated/entity/data/glossary';
import { LabelType } from '../../../generated/entity/data/table';
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
import { getTagDisplay, tagRender } from '../../../utils/TagsUtils';
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
  isSubmitLoading,
  onCancel,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const selectedTagsRef = useRef<SelectOption[]>(initialOptions ?? []);
  const { t } = useTranslation();
  const [glossaries, setGlossaries] = useState([] as Glossary[]);
  const expandableKeys = useRef<string[]>([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState<Key[]>([]);
  const [searchOptions, setSearchOptions] = useState<Glossary[]>([]);

  const form = Form.useFormInstance();

  const fetchGlossaryListInternal = async () => {
    try {
      const { data } = await getGlossariesList({
        limit: PAGE_SIZE_LARGE,
      });
      setGlossaries((prev) => [...prev, ...data]);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGlossaryListInternal();
  }, []);

  const dropdownRender = (menu: React.ReactElement) => (
    <>
      {menu}
      <Space className="p-sm p-b-xss p-l-xs custom-dropdown-render" size={8}>
        <Button
          className="update-btn"
          data-testid="saveAssociatedTag"
          htmlType="submit"
          loading={isSubmitLoading}
          size="small"
          type="default"
          onClick={() => form.submit()}>
          {t('label.update')}
        </Button>
        <Button
          data-testid="cancelAssociatedTag"
          size="small"
          type="link"
          onClick={onCancel}>
          {t('label.cancel')}
        </Button>
      </Space>
    </>
  );

  const customTagRender = (data: CustomTagProps) => {
    const selectedTag = selectedTagsRef.current.find(
      (tag) => tag.value === data.value
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
            data: initialData,
          }
        : {
            value,
            label: value,
          };
    });
    selectedTagsRef.current = selectedValues;
    onChange?.(selectedValues);
  };

  const fetchGlossaryTerm = async (params?: ListGlossaryTermsParams) => {
    if (!params?.glossary) {
      return;
    }
    setIsLoading(true);
    try {
      const { data } = await getGlossaryTerms({
        ...params,
        limit: PAGE_SIZE_LARGE,
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

  const onSearch = debounce(async (value: string) => {
    if (value) {
      const results: Glossary[] = await searchGlossaryTerms(value);

      setSearchOptions(results);
      setExpandedRowKeys(
        results.map((result) => result.fullyQualifiedName as string)
      );
    } else {
      setSearchOptions([]);
    }
  }, 300);

  const convertToTreeData = (
    options: ModifiedGlossaryTerm[] = [],
    level = 0
  ): Omit<DefaultOptionType, 'label'>[] => {
    const treeData = options.map((option) => {
      const hasChildren = 'children' in option && !isEmpty(option?.children);

      // for 0th level we don't want check option to available
      const isGlossaryTerm = level !== 0;

      // Only include keys with no children or keys that are not expanded
      return {
        id: option.id,
        value: option.fullyQualifiedName,
        title: getEntityName(option),
        checkable: isGlossaryTerm,
        isLeaf: isGlossaryTerm ? !hasChildren : false,
        selectable: isGlossaryTerm,
        children:
          hasChildren &&
          convertToTreeData(
            option.children as ModifiedGlossaryTerm[],
            level + 1
          ),
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
    () =>
      convertToTreeData(
        isEmpty(searchOptions)
          ? (glossaries as ModifiedGlossaryTerm[])
          : (searchOptions as unknown as ModifiedGlossaryTerm[])
      ),
    [glossaries, searchOptions, expandableKeys.current]
  );

  return (
    <TreeSelect
      autoFocus
      showSearch
      treeCheckable
      data-testid="tag-selector"
      dropdownRender={dropdownRender}
      dropdownStyle={{ width: 300 }}
      filterTreeNode={false}
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
      treeExpandedKeys={isEmpty(searchOptions) ? undefined : expandedRowKeys}
      onChange={handleChange}
      onSearch={onSearch}
      onTreeExpand={setExpandedRowKeys}
      {...props}
    />
  );
};

export default TreeAsyncSelectList;
