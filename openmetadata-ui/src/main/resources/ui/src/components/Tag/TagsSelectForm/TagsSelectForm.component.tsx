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
import { Form } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { DefaultOptionType } from 'antd/lib/select';
import { useState } from 'react';
import { TagSource } from '../../../generated/type/tagLabel';
import AsyncSelectList from '../../common/AsyncSelectList/AsyncSelectList';
import TreeAsyncSelectList from '../../common/AsyncSelectList/TreeAsyncSelectList';
import './tag-select-fom.style.less';
import { TagsSelectFormProps } from './TagsSelectForm.interface';

const TagSelectForm = ({
  fetchApi,
  defaultValue,
  placeholder,
  onSubmit,
  onCancel,
  tagData,
  tagType,
  filterOptions,
}: TagsSelectFormProps) => {
  const [form] = useForm();
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);

  const handleSave = async (data: {
    tags: DefaultOptionType | DefaultOptionType[];
  }) => {
    setIsSubmitLoading(true);
    await onSubmit(data.tags);
    setIsSubmitLoading(false);
  };

  return (
    <Form
      data-testid="tag-form"
      form={form}
      initialValues={{ tags: defaultValue }}
      name="tagsForm"
      onFinish={handleSave}>
      <Form.Item noStyle name="tags">
        {tagType === TagSource.Classification && fetchApi ? (
          <AsyncSelectList
            open
            fetchOptions={fetchApi}
            filterOptions={filterOptions}
            initialOptions={tagData}
            isSubmitLoading={isSubmitLoading}
            mode="multiple"
            optionClassName="tag-select-box"
            placeholder={placeholder}
            tagType={tagType}
            onCancel={onCancel}
          />
        ) : (
          <TreeAsyncSelectList
            filterOptions={filterOptions}
            initialOptions={tagData}
            isSubmitLoading={isSubmitLoading}
            optionClassName="tag-select-box"
            placeholder={placeholder}
            tagType={tagType}
            onCancel={onCancel}
          />
        )}
      </Form.Item>
    </Form>
  );
};

export default TagSelectForm;
