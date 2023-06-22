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
import { TreeSelect } from 'antd';
import classNames from 'classnames';
import React from 'react';
import { TagsTreeComponentProps } from './TagsContainerV1.interface';

const TagTree = ({
  defaultValue,
  placeholder,
  treeData,
  onChange,
}: TagsTreeComponentProps) => {
  return (
    <TreeSelect
      autoFocus
      multiple
      showSearch
      treeDefaultExpandAll
      treeLine
      className={classNames('w-full')}
      data-testid="tag-selector"
      defaultValue={defaultValue}
      placeholder={placeholder}
      removeIcon={
        <CloseOutlined data-testid="remove-tags" height={8} width={8} />
      }
      showCheckedStrategy={TreeSelect.SHOW_ALL}
      treeData={treeData}
      treeNodeFilterProp="title"
      onChange={onChange}
    />
  );
};

export default TagTree;
