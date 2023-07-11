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
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Button, Col, Form, Row, Space, TreeSelect } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import classNames from 'classnames';
import React from 'react';
import { TagsTreeComponentProps } from '../TagsContainerV1/TagsContainerV1.interface';

const TagTree = ({
  defaultValue,
  placeholder,
  treeData,
  onSubmit,
  onCancel,
}: TagsTreeComponentProps) => {
  const [form] = useForm();

  return (
    <Form form={form} name="tagsForm" onFinish={(data) => onSubmit(data.tags)}>
      <Row gutter={[0, 8]}>
        <Col className="gutter-row d-flex justify-end" span={24}>
          <Space align="center">
            <Button
              className="p-x-05"
              data-testid="cancelAssociatedTag"
              icon={<CloseOutlined size={12} />}
              size="small"
              onClick={onCancel}
            />
            <Button
              className="p-x-05"
              data-testid="saveAssociatedTag"
              htmlType="submit"
              icon={<CheckOutlined size={12} />}
              size="small"
              type="primary"
            />
          </Space>
        </Col>

        <Col className="gutter-row" span={24}>
          <Form.Item noStyle name="tags">
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
            />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  );
};

export default TagTree;
