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
  Empty,
  Form,
  Select,
  SelectProps,
  Space,
  TagProps,
  Tooltip,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { debounce, isEmpty, isUndefined, pick } from 'lodash';
import { CustomTagProps } from 'rc-select/lib/BaseSelect';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { TAG_START_WITH } from '../../../constants/Tag.constants';
import { Tag } from '../../../generated/entity/classification/tag';
import { LabelType } from '../../../generated/entity/data/table';
import { Paging } from '../../../generated/type/paging';
import { TagLabel } from '../../../generated/type/tagLabel';
import Fqn from '../../../utils/Fqn';
import { getTagDisplay, tagRender } from '../../../utils/TagsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import TagsV1 from '../../Tag/TagsV1/TagsV1.component';
import Loader from '../Loader/Loader';
import './async-select-list.less';
import {
  AsyncSelectListProps,
  SelectOption,
} from './AsyncSelectList.interface';

const AsyncSelectList: FC<AsyncSelectListProps & SelectProps> = ({
  mode,
  onChange,
  fetchOptions,
  debounceTimeout = 800,
  initialOptions,
  filterOptions = [],
  optionClassName,
  tagType,
  onCancel,
  isSubmitLoading,
  newLook = false,
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
  const form = Form.useFormInstance();

  const getFilteredOptions = (data: SelectOption[]) => {
    if (isEmpty(filterOptions)) {
      return data;
    }

    let count = optionFilteredCount;

    const filteredData = data.filter((item) => {
      const isFiltered = filterOptions.includes(
        (item.data as Tag)?.fullyQualifiedName ?? ''
      );
      if (isFiltered) {
        count = optionFilteredCount + 1;
      }

      return !isFiltered;
    });

    setOptionFilteredCount(count);

    return filteredData;
  };

  const loadOptions = useCallback(
    async (value: string) => {
      setOptions([]);
      setIsLoading(true);
      try {
        const res = await fetchOptions(value, 1);
        setOptions(getFilteredOptions(res.data));
        setPaging(res.paging);
        setSearchValue(value);
        setCurrentPage(1);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
    },
    [fetchOptions]
  );

  const debounceFetcher = useMemo(
    () => debounce(loadOptions, debounceTimeout),
    [loadOptions, debounceTimeout]
  );

  const tagOptions = useMemo(() => {
    const newTags = options.map((tag) => {
      const displayName = tag.data?.displayName;
      const parts = Fqn.split(tag.label);
      const lastPartOfTag = isEmpty(displayName)
        ? parts.slice(-1).join(FQN_SEPARATOR_CHAR)
        : displayName;
      parts.pop();

      return {
        label: tag.label,
        displayName: (
          <Space className="w-full" direction="vertical" size={0}>
            <Typography.Paragraph ellipsis className="text-grey-muted m-0 p-0">
              {parts.join(FQN_SEPARATOR_CHAR)}
            </Typography.Paragraph>
            <Typography.Text ellipsis style={{ color: tag.data?.style?.color }}>
              {lastPartOfTag}
            </Typography.Text>
          </Space>
        ),
        value: tag.value,
        data: tag.data,
      };
    });

    return newTags;
  }, [options]);

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
      {onCancel && (
        <Space className="p-sm p-b-xss p-l-xs custom-dropdown-render" size={8}>
          <Button
            className="update-btn"
            data-testid="saveAssociatedTag"
            disabled={isEmpty(tagOptions)}
            htmlType="submit"
            loading={isSubmitLoading}
            size="small"
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
      )}
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
        newLook={newLook}
        size={props.size}
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

  const handleChange: SelectProps['onChange'] = (values: string[], options) => {
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

  useEffect(() => {
    loadOptions('');
  }, []);

  return (
    <Select
      showSearch
      className={classNames('async-select-list', {
        'new-chip-style': newLook,
      })}
      data-testid="tag-selector"
      dropdownRender={dropdownRender}
      filterOption={false}
      mode={mode}
      notFoundContent={
        isLoading ? (
          <Loader size="small" />
        ) : (
          <Empty
            description={t('label.no-entity-available', {
              entity: t('label.tag-plural'),
            })}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )
      }
      optionLabelProp="label"
      // this popupClassName class is used to identify the dropdown in the playwright tests
      popupClassName="async-select-list-dropdown"
      style={{ width: '100%' }}
      tagRender={customTagRender}
      onChange={handleChange}
      onInputKeyDown={(event) => {
        if (event.key === 'Backspace') {
          return event.stopPropagation();
        }
      }}
      onPopupScroll={onScroll}
      onSearch={debounceFetcher}
      {...props}>
      {tagOptions.map(({ label, value, displayName, data }) => (
        <Select.Option
          className={`${optionClassName} w-full`}
          data={data}
          data-testid={`tag-${value}`}
          key={label}
          value={value}>
          <Tooltip
            destroyTooltipOnHide
            mouseEnterDelay={1.5}
            placement="leftTop"
            title={label}
            trigger="hover">
            {displayName}
          </Tooltip>
        </Select.Option>
      ))}
    </Select>
  );
};

export default AsyncSelectList;
