import { Select } from 'antd';
import { AxiosError } from 'axios';
import { EntityTags, TagOption } from 'Models';
import React, { useEffect, useMemo, useState } from 'react';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import jsonData from '../../jsons/en';
import {
  getTagCategories,
  getTaglist,
  getTagOptions,
} from '../../utils/TagsUtils';
import { showErrorToast } from '../../utils/ToastUtils';

export const AddTags = ({
  setTags,
}: {
  selectedTags?: Array<EntityTags>;
  setTags?: (tags: EntityTags[]) => void;
}) => {
  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);
  const [tagList, setTagList] = useState<Array<string | TagOption>>([]);
  const [selectedTags, setSelectedTags] = useState<Array<EntityTags>>([]);

  const options: React.ReactNode[] = [];

  const fetchTags = () => {
    setIsTagLoading(true);
    getTagCategories()
      .then((res) => {
        setTagList(getTaglist(res.data));
      })
      .catch((err: AxiosError) => {
        showErrorToast(err, jsonData['api-error-messages']['fetch-tags-error']);
      })
      .finally(() => {
        setIsTagLoading(false);
      });
  };

  const tagsList = useMemo(() => {
    const newTags = (tagList as string[])
      .filter((tag) => !tag.startsWith(`Tier${FQN_SEPARATOR_CHAR}Tier`)) // To filter out Tier tags
      .map((tag) => {
        return {
          label: tag,
          value: tag,
        };
      });

    return newTags;
  }, [tagList]);

  const onClickSelect = () => {
    fetchTags();
  };

  const handleChange = (value: string[]) => {
    setSelectedTags && setSelectedTags(value);
  };

  tagsList.forEach((tag) =>
    options.push(<Select.Option key={tag.label}>{tag.value}</Select.Option>)
  );

  useEffect(() => {
    const tags = getTagOptions(selectedTags);

    setTags?.(tags);
  }, [selectedTags]);

  return (
    <Select
      loading={isTagLoading}
      mode="multiple"
      placeholder="Add Tags"
      style={{ width: '100%' }}
      value={selectedTags}
      onChange={handleChange}
      onClick={onClickSelect}>
      {options}
    </Select>
  );
};
