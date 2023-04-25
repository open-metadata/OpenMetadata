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

import { PlusOutlined } from '@ant-design/icons';
import { Button, Form, Input, Space, Switch, Typography } from 'antd';
import { FormProps, useForm } from 'antd/lib/form/Form';
import { UserSelectableList } from 'components/common/UserSelectableList/UserSelectableList.component';
import { UserTag } from 'components/common/UserTag/UserTag.component';
import { UserTagSize } from 'components/common/UserTag/UserTag.interface';
import { UserTeamSelectableList } from 'components/common/UserTeamSelectableList/UserTeamSelectableList.component';
import { ENTITY_NAME_REGEX } from 'constants/regex.constants';
import { toString } from 'lodash';
import TagSuggestion from 'pages/TasksPage/shared/TagSuggestion';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getEntityName } from 'utils/EntityUtils';
import { PageLayoutType } from '../../enums/layout.enum';
import { CreateGlossary } from '../../generated/api/data/createGlossary';
import { EntityReference } from '../../generated/type/entityReference';
import { getCurrentUserId } from '../../utils/CommonUtils';
import RichTextEditor from '../common/rich-text-editor/RichTextEditor';
import { EditorContentRef } from '../common/rich-text-editor/RichTextEditor.interface';
import TitleBreadcrumb from '../common/title-breadcrumb/title-breadcrumb.component';
import PageLayout from '../containers/PageLayout';
import { AddGlossaryProps } from './AddGlossary.interface';

const AddGlossary = ({
  header,
  allowAccess = true,
  isLoading,
  slashedBreadcrumb,
  onCancel,
  onSave,
}: AddGlossaryProps) => {
  const markdownRef = useRef<EditorContentRef>();
  const { t } = useTranslation();
  const [form] = useForm();

  const [reviewer, setReviewer] = useState<Array<EntityReference>>([]);
  const [owner, setOwner] = useState<EntityReference | undefined>();

  const handleReviewerSave = (reviewer: EntityReference[]) => {
    setReviewer(reviewer);
  };
  const handleUpdatedOwner = async (owner: EntityReference | undefined) => {
    setOwner(owner);
  };

  const handleSave: FormProps['onFinish'] = (formData) => {
    const { name, displayName, description, tags, mutuallyExclusive } =
      formData;

    const selectedOwner = owner || {
      id: getCurrentUserId(),
      type: 'user',
    };
    const data: CreateGlossary = {
      name: name.trim(),
      displayName: (displayName || name).trim(),
      description: description,
      reviewers:
        reviewer.map((d) => toString(d.fullyQualifiedName)).filter(Boolean) ??
        [],
      owner: selectedOwner,
      tags: tags || [],
      mutuallyExclusive: Boolean(mutuallyExclusive),
    };
    onSave(data);
  };

  const fetchRightPanel = () => {
    return (
      <>
        <Typography.Title level={5}>
          {t('label.configure-entity', {
            entity: t('label.glossary'),
          })}
        </Typography.Title>
        <div className="mb-5">{t('message.create-new-glossary-guide')}</div>
      </>
    );
  };

  return (
    <PageLayout
      classes="tw-max-w-full-hd tw-h-full tw-pt-4"
      header={<TitleBreadcrumb titleLinks={slashedBreadcrumb} />}
      layout={PageLayoutType['2ColRTL']}
      pageTitle={t('label.add-entity', { entity: t('label.glossary') })}
      rightPanel={fetchRightPanel()}>
      <div className="tw-form-container glossary-form">
        <Typography.Title data-testid="form-heading" level={5}>
          {header}
        </Typography.Title>
        <div className="tw-pb-3" data-testid="add-glossary">
          <Form form={form} layout="vertical" onFinish={handleSave}>
            <Form.Item
              label={t('label.name')}
              name="name"
              rules={[
                {
                  required: true,
                  message: `${t('message.field-text-is-required', {
                    fieldText: t('label.name'),
                  })}`,
                },
                {
                  pattern: ENTITY_NAME_REGEX,
                  message: `${t('message.entity-pattern-validation', {
                    entity: `${t('label.name')}`,
                    pattern: `- _ & . '`,
                  })}`,
                },
                {
                  min: 1,
                  max: 128,
                  message: `${t('message.entity-maximum-size', {
                    entity: `${t('label.name')}`,
                    max: '128',
                  })}`,
                },
              ]}>
              <Input data-testid="name" placeholder={t('label.name')} />
            </Form.Item>
            <Form.Item
              data-testid="display-name"
              id="display-name"
              label={t('label.display-name')}
              name="displayName">
              <Input placeholder={t('label.display-name')} />
            </Form.Item>
            <Form.Item
              label={`${t('label.description')}:`}
              name="description"
              rules={[
                {
                  required: true,
                  message: `${t('message.field-text-is-required', {
                    fieldText: t('label.description'),
                  })}`,
                },
              ]}
              trigger="onTextChange"
              valuePropName="initialValue">
              <RichTextEditor
                data-testid="description"
                height="170px"
                initialValue=""
                readonly={!allowAccess}
                ref={markdownRef}
              />
            </Form.Item>
            <Form.Item
              data-testid="tags-container"
              label={t('label.tag-plural')}
              name="tags">
              <TagSuggestion />
            </Form.Item>
            <Space align="center" className="switch-field" size={16}>
              <Typography.Text>{t('label.mutually-exclusive')}</Typography.Text>
              <Form.Item
                className="m-b-0 glossary-form-antd-label d-flex items-center"
                colon={false}
                data-testid="mutually-exclusive-label"
                name="mutuallyExclusive"
                valuePropName="checked">
                <Switch
                  data-testid="mutually-exclusive-button"
                  id="mutuallyExclusive"
                />
              </Form.Item>
            </Space>

            <div className="m-t-xss">
              <div className="d-flex items-center">
                <p className="glossary-form-label w-form-label tw-mr-3">{`${t(
                  'label.owner'
                )}`}</p>
                <UserTeamSelectableList
                  hasPermission
                  owner={owner}
                  onUpdate={handleUpdatedOwner}>
                  <Button
                    data-testid="add-owner"
                    icon={
                      <PlusOutlined
                        style={{ color: 'white', fontSize: '12px' }}
                      />
                    }
                    size="small"
                    type="primary"
                  />
                </UserTeamSelectableList>
              </div>
              {owner && (
                <div className="tw-my-2" data-testid="owner-container">
                  <UserTag
                    id={owner.id}
                    name={getEntityName(owner)}
                    size={UserTagSize.small}
                  />
                </div>
              )}
            </div>
            <div className="m-t-xss">
              <div className="d-flex items-center">
                <p className="glossary-form-label w-form-label tw-mr-3">
                  {t('label.reviewer-plural')}
                </p>
                <UserSelectableList
                  hasPermission
                  popoverProps={{ placement: 'topLeft' }}
                  selectedUsers={reviewer ?? []}
                  onUpdate={handleReviewerSave}>
                  <Button
                    data-testid="add-reviewers"
                    icon={
                      <PlusOutlined
                        style={{ color: 'white', fontSize: '12px' }}
                      />
                    }
                    size="small"
                    type="primary"
                  />
                </UserSelectableList>
              </div>
              {Boolean(reviewer.length) && (
                <Space
                  wrap
                  className="tw-my-2"
                  data-testid="reviewers-container"
                  size={[8, 8]}>
                  {reviewer.map((d, index) => (
                    <UserTag
                      id={d.id}
                      key={index}
                      name={getEntityName(d)}
                      size={UserTagSize.small}
                    />
                  ))}
                </Space>
              )}
            </div>
            <Form.Item>
              <Space
                className="w-full justify-end"
                data-testid="cta-buttons"
                size={16}>
                <Button
                  data-testid="cancel-glossary"
                  type="link"
                  onClick={onCancel}>
                  {t('label.cancel')}
                </Button>
                <Button
                  data-testid="save-glossary"
                  disabled={!allowAccess}
                  htmlType="submit"
                  loading={isLoading}
                  type="primary">
                  {t('label.save')}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </div>
      </div>
    </PageLayout>
  );
};

export default AddGlossary;
