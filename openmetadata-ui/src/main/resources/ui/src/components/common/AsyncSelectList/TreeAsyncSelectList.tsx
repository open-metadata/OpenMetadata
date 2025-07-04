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
import Icon from '@ant-design/icons/lib/components/Icon';
import {
  Button,
  Empty,
  Form,
  Space,
  TagProps,
  TreeSelect,
  TreeSelectProps,
} from 'antd';
import { AxiosError } from 'axios';
import { debounce, get, isEmpty, isNull, isUndefined, pick } from 'lodash';
import { CustomTagProps } from 'rc-select/lib/BaseSelect';
import {
  FC,
  Key,
  ReactElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ArrowIcon } from '../../../assets/svg/ic-arrow-down.svg';
import { PAGE_SIZE_LARGE, TEXT_BODY_COLOR } from '../../../constants/constants';
import { TAG_START_WITH } from '../../../constants/Tag.constants';
import { Tag } from '../../../generated/entity/classification/tag';
import { Glossary } from '../../../generated/entity/data/glossary';
import { LabelType } from '../../../generated/entity/data/table';
import { TagLabel } from '../../../generated/type/tagLabel';
import {
  getGlossariesList,
  ListGlossaryTermsParams,
  queryGlossaryTerms,
  searchGlossaryTerms,
} from '../../../rest/glossaryAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import {
  convertGlossaryTermsToTreeOptions,
  filterTreeNodeOptions,
  findItemByFqn,
} from '../../../utils/GlossaryUtils';
import {
  escapeESReservedCharacters,
  getEncodedFqn,
} from '../../../utils/StringsUtils';
import { getTagDisplay, tagRender } from '../../../utils/TagsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { ModifiedGlossaryTerm } from '../../Glossary/GlossaryTermTab/GlossaryTermTab.interface';
import TagsV1 from '../../Tag/TagsV1/TagsV1.component';
import Loader from '../Loader/Loader';
import './async-select-list.less';
import {
  AsyncSelectListProps,
  SelectOption,
} from './AsyncSelectList.interface';

interface TreeAsyncSelectListProps
  extends Omit<AsyncSelectListProps, 'fetchOptions'> {
  isMultiSelect?: boolean;
  isParentSelectable?: boolean;
}

const TreeAsyncSelectList: FC<TreeAsyncSelectListProps> = ({
  onChange,
  initialOptions,
  tagType,
  isSubmitLoading,
  filterOptions = [],
  onCancel,
  open: openProp = true,
  hasNoActionButtons,
  isMultiSelect = true, // default to true for backward compatibility
  isParentSelectable = false, // by default, only leaf nodes can be selected

  ...props
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const selectedTagsRef = useRef<SelectOption[]>(initialOptions ?? []);
  const { t } = useTranslation();
  const [glossaries, setGlossaries] = useState<Glossary[]>([]);
  const expandableKeys = useRef<string[]>([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState<Key[]>([]);
  const [searchOptions, setSearchOptions] = useState<Glossary[] | null>(null);
  const [open, setOpen] = useState(openProp); // state for controlling dropdown visibility

  const form = Form.useFormInstance();

  const handleDropdownVisibleChange = (visible: boolean) => {
    setOpen(visible);
  };

  const fetchGlossaryListInternal = async () => {
    setIsLoading(true);

    try {
      const { data } = await getGlossariesList({
        limit: PAGE_SIZE_LARGE,
      });
      setGlossaries((prev) =>
        filterTreeNodeOptions([...prev, ...data], filterOptions)
      );
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
      {isLoading ? <Loader size="small" /> : menu}
      <Space className="p-sm p-b-xss p-l-xs custom-dropdown-render" size={8}>
        <Button
          className="update-btn"
          data-testid="saveAssociatedTag"
          disabled={isEmpty(glossaries)}
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

    const { value, onClose } = data;
    const tagLabel = getTagDisplay(value as string);
    const tag = {
      tagFQN: (selectedTag?.data as Tag)?.fullyQualifiedName,
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
        isEditTags
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
    values:
      | string
      | string[]
      | {
          disabled: boolean;
          halfChecked: boolean;
          label: React.ReactNode;
          value: string;
        }[]
  ) => {
    if (isMultiSelect) {
      // Handle multi-select mode (existing behavior)
      const selectedValues = (
        values as {
          disabled: boolean;
          halfChecked: boolean;
          label: React.ReactNode;
          value: string;
        }[]
      ).map(({ value }) => {
        const lastSelectedMap = new Map(
          selectedTagsRef.current.map((tag) => [tag.value, tag])
        );
        if (lastSelectedMap.has(value)) {
          return lastSelectedMap.get(value) as SelectOption;
        }
        const initialData = findItemByFqn(
          [
            ...glossaries,
            ...(isNull(searchOptions) ? [] : searchOptions),
            ...(initialOptions ?? []),
          ] as ModifiedGlossaryTerm[],
          value,
          false
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
      selectedTagsRef.current = selectedValues as SelectOption[];
      onChange?.(selectedValues);
    } else {
      // Handle single-select mode
      if (values) {
        const value = values as string;

        const initialData = findItemByFqn(
          [
            ...glossaries,
            ...(isNull(searchOptions) ? [] : searchOptions),
            ...(initialOptions ?? []),
          ] as ModifiedGlossaryTerm[],
          value,
          false
        );

        const selectedValue = initialData
          ? {
              value: initialData.fullyQualifiedName ?? '',
              label: getEntityName(initialData),
              data: initialData,
            }
          : {
              value,
              label: value,
            };

        selectedTagsRef.current = [selectedValue as SelectOption];
        onChange?.(selectedValue as any);
      } else {
        // Nothing selected
        selectedTagsRef.current = [];
        onChange?.([]);
      }
    }
  };

  const fetchGlossaryTerm = async (params?: ListGlossaryTermsParams) => {
    if (!params?.glossary) {
      return;
    }
    try {
      const results = await queryGlossaryTerms(params.glossary);

      const activeGlossary = results[0];

      setGlossaries((prev) =>
        filterTreeNodeOptions(
          prev.map((glossary) => ({
            ...glossary,
            children: get(
              glossary.id === activeGlossary?.id ? activeGlossary : glossary,
              'children',
              []
            ),
          })),
          filterOptions
        )
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const onSearch = debounce(async (value: string) => {
    if (value) {
      setIsLoading(true);
      const encodedValue = getEncodedFqn(escapeESReservedCharacters(value));
      const results: Glossary[] = await searchGlossaryTerms(encodedValue);

      setSearchOptions(filterTreeNodeOptions(results, filterOptions));
      setExpandedRowKeys(
        results.map((result) => result.fullyQualifiedName as string)
      );
      setIsLoading(false);
    } else {
      setSearchOptions(null);
    }
  }, 300);

  useEffect(() => {
    if (glossaries.length) {
      expandableKeys.current = glossaries.map((glossary) => glossary.id);
    }
  }, [glossaries]);

  const treeData = useMemo(() => {
    return convertGlossaryTermsToTreeOptions(
      isNull(searchOptions)
        ? (glossaries as ModifiedGlossaryTerm[])
        : (searchOptions as unknown as ModifiedGlossaryTerm[]),
      0,
      isParentSelectable
    );
  }, [glossaries, searchOptions, expandableKeys.current, isParentSelectable]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        onCancel?.();

        break;
      case 'Tab':
        e.preventDefault();
        e.stopPropagation();
        form.submit();

        break;
      case 'Enter': {
        e.preventDefault();
        e.stopPropagation();
        const active = document.querySelector(
          '.ant-select-tree .ant-select-tree-treenode-active .ant-select-tree-checkbox'
        );
        if (active) {
          (active as HTMLElement).click();
        } else {
          form.submit();
        }

        break;
      }
      default:
        break;
    }
  };

  return (
    <TreeSelect
      showSearch
      {...(isMultiSelect
        ? { treeCheckable: true, treeCheckStrictly: true }
        : {})}
      autoFocus={open}
      className="async-select-list"
      data-testid="tag-selector"
      dropdownRender={
        hasNoActionButtons ? (menu: ReactElement) => menu : dropdownRender
      }
      dropdownStyle={{ width: 300 }}
      filterTreeNode={false}
      loadData={({ id, name }) => {
        if (expandableKeys.current.includes(id)) {
          return fetchGlossaryTerm({ glossary: name as string });
        }

        return Promise.resolve();
      }}
      notFoundContent={
        isLoading ? (
          <Loader size="small" />
        ) : (
          <Empty
            description={t('label.no-entity-available', {
              entity: t('label.glossary-term'),
            })}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )
      }
      open={open}
      // this popupClassName class is used to identify the dropdown in the playwright tests
      popupClassName="async-tree-select-list-dropdown"
      showCheckedStrategy={TreeSelect.SHOW_ALL}
      style={{ width: '100%' }}
      switcherIcon={
        <Icon
          component={ArrowIcon}
          data-testid="expand-icon"
          style={{ fontSize: '10px', color: TEXT_BODY_COLOR }}
        />
      }
      tagRender={customTagRender}
      treeData={treeData}
      treeDefaultExpandAll={false}
      treeExpandedKeys={isEmpty(searchOptions) ? undefined : expandedRowKeys}
      onChange={handleChange}
      onDropdownVisibleChange={handleDropdownVisibleChange}
      onSearch={onSearch}
      onTreeExpand={setExpandedRowKeys}
      {...props}
      onKeyDown={handleKeyDown}
    />
  );
};

export default TreeAsyncSelectList;
