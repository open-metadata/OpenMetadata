/*
 *  Copyright 2022 Collate.
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
import {
  Button,
  Col,
  Form,
  FormProps,
  Row,
  Space,
  TreeSelect,
  Typography,
} from 'antd';
import { ReactComponent as EditIcon } from 'assets/svg/edit-new.svg';
import classNames from 'classnames';
import Loader from 'components/Loader/Loader';
import Tags from 'components/Tag/Tags/tags';
import { DE_ACTIVE_COLOR, NO_DATA_PLACEHOLDER } from 'constants/constants';
import { TAG_CONSTANT, TAG_START_WITH } from 'constants/Tag.constants';
import { TagSource } from 'generated/type/tagLabel';
import { isEmpty } from 'lodash';
import { EntityTags } from 'Models';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAllTagsForOptions, getHierarchyTags } from 'utils/TagsUtils';
import TagsV1 from '../TagsV1/TagsV1.component';
import TagsViewer from '../TagsViewer/tags-viewer';
import {
  TagDetailsProps,
  TagsContainerV1Props,
} from './TagsContainerV1.interface';

const TagsContainerV1 = ({
  editable,
  selectedTags,
  onSelectionChange,
  placeholder,
  showLimited,
}: TagsContainerV1Props) => {
  const [form] = Form.useForm();
  const { t } = useTranslation();

  const [isEditTags, setIsEditTags] = useState(false);
  const [tagDetails, setTagDetails] = useState<TagDetailsProps>({
    isLoading: false,
    isError: false,
    options: [],
  });

  const showAddTagButton = useMemo(
    () => editable && isEmpty(selectedTags),
    [editable, selectedTags]
  );

  const fetchTags = async () => {
    setTagDetails((pre) => ({ ...pre, isLoading: true }));

    try {
      const tags = await getAllTagsForOptions();
      setTagDetails((pre) => ({
        ...pre,
        options: tags.map((tag) => {
          return {
            name: tag.name,
            fqn: tag.fullyQualifiedName ?? '',
            classification: tag.classification,
            source: TagSource.Classification,
          };
        }),
      }));
      setIsEditTags(true);
    } catch (_error) {
      setTagDetails((pre) => ({ ...pre, isError: true, options: [] }));
    } finally {
      setTagDetails((pre) => ({ ...pre, isLoading: false }));
    }
  };

  const showNoDataPlaceholder = useMemo(
    () => !showAddTagButton && selectedTags.length === 0,
    [showAddTagButton, selectedTags]
  );

  const getUpdatedTags = (selectedTag: string[]): EntityTags[] => {
    const updatedTags = selectedTag.map((t) => ({
      tagFQN: t,
      source: tagDetails.options.find((tag) => tag.fqn === t)?.source,
    }));

    return updatedTags;
  };

  const handleSave: FormProps['onFinish'] = (data) => {
    const tags = getUpdatedTags(data.tags);
    onSelectionChange(tags);
    form.resetFields();
    setIsEditTags(false);
  };

  const handleCancel = useCallback(() => {
    setIsEditTags(false);
    form.resetFields();
  }, [form]);

  const getTagsElement = (tag: EntityTags, index: number) => (
    <TagsV1 key={index} tag={tag} />
  );

  const addTagButton = useMemo(
    () =>
      showAddTagButton ? (
        <span onClick={() => fetchTags()}>
          <Tags
            className="tw-font-semibold tw-text-primary"
            startWith={TAG_START_WITH.PLUS}
            tag={TAG_CONSTANT}
            type="border"
          />
        </span>
      ) : null,
    [showAddTagButton, fetchTags]
  );

  const renderTags = useMemo(
    () =>
      showLimited ? (
        <TagsViewer
          isTextPlaceholder
          showNoDataPlaceholder={showNoDataPlaceholder}
          tags={selectedTags}
          type="border"
        />
      ) : (
        <>
          {!showAddTagButton && isEmpty(selectedTags) ? (
            <Typography.Text data-testid="no-tags">
              {NO_DATA_PLACEHOLDER}
            </Typography.Text>
          ) : null}
          {selectedTags.map(getTagsElement)}
        </>
      ),
    [
      showLimited,
      showNoDataPlaceholder,
      selectedTags,
      getTagsElement,
      showAddTagButton,
      selectedTags,
    ]
  );

  const selectedTagsInternal = useMemo(
    () => selectedTags.map(({ tagFQN }) => tagFQN as string),
    [selectedTags]
  );

  const tagsSelectContainer = useMemo(() => {
    return tagDetails.isLoading ? (
      <Loader size="small" />
    ) : (
      <Form form={form} name="tagsForm" onFinish={handleSave}>
        <Row gutter={[0, 8]}>
          <Col className="gutter-row d-flex justify-end" span={24}>
            <Space align="center">
              <Button
                className="p-x-05"
                data-testid="cancelAssociatedTag"
                icon={<CloseOutlined size={12} />}
                size="small"
                onClick={handleCancel}
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
                defaultValue={selectedTagsInternal}
                placeholder={
                  placeholder
                    ? placeholder
                    : t('label.select-field', {
                        field: t('label.tag-plural'),
                      })
                }
                showCheckedStrategy={TreeSelect.SHOW_CHILD}
                treeData={getHierarchyTags(tagDetails.options)}
                treeNodeFilterProp="title"
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    );
  }, [selectedTagsInternal, handleCancel, handleSave, placeholder]);

  return (
    <div data-testid="tag-container">
      <div className="m-b-xs d-flex items-center">
        <Typography.Text className="right-panel-label">
          {t('label.tag-plural')}
        </Typography.Text>
        {editable && selectedTags.length > 0 && (
          <Button
            className="cursor-pointer flex-center m-l-xss"
            data-testid="edit-button"
            disabled={!editable}
            icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
            size="small"
            type="text"
            onClick={() => {
              if (isEmpty(tagDetails.options)) {
                fetchTags();
              }
              setIsEditTags(true);
            }}
          />
        )}
      </div>
      {!isEditTags && (
        <Space wrap align="center" size={4}>
          {addTagButton}
          {renderTags}
        </Space>
      )}
      {isEditTags && tagsSelectContainer}
    </div>
  );
};

export default TagsContainerV1;
