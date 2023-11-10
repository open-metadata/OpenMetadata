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
import { Button, Form, Space, Typography } from 'antd';
import { FormProps, useForm } from 'antd/lib/form/Form';
import { toString } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ENTITY_NAME_REGEX } from '../../../constants/regex.constants';
import {
  CreateGlossary,
  EntityReference,
} from '../../../generated/api/data/createGlossary';
import {
  FieldProp,
  FieldTypes,
  FormItemLayout,
} from '../../../interface/FormUtils.interface';
import { getEntityName } from '../../../utils/EntityUtils';
import { generateFormFields, getField } from '../../../utils/formUtils';
import { useAuthContext } from '../../Auth/AuthProviders/AuthProvider';
import ResizablePanels from '../../common/ResizablePanels/ResizablePanels';
import TitleBreadcrumb from '../../common/TitleBreadcrumb/TitleBreadcrumb.component';
import { UserTag } from '../../common/UserTag/UserTag.component';
import { UserTagSize } from '../../common/UserTag/UserTag.interface';
import { AddGlossaryProps } from './AddGlossary.interface';

const AddGlossary = ({
  header,
  allowAccess = true,
  isLoading,
  slashedBreadcrumb,
  onCancel,
  onSave,
}: AddGlossaryProps) => {
  const { t } = useTranslation();
  const [form] = useForm();
  const { currentUser } = useAuthContext();

  const selectedOwner = Form.useWatch<EntityReference | undefined>(
    'owner',
    form
  );
  const reviewersList =
    Form.useWatch<EntityReference[]>('reviewers', form) ?? [];

  const handleSave: FormProps['onFinish'] = (formData) => {
    const {
      name,
      displayName,
      description,
      tags,
      mutuallyExclusive,
      reviewers = [],
      owner,
    } = formData;

    const selectedOwner = owner ?? {
      id: currentUser?.id,
      type: 'user',
    };
    const data: CreateGlossary = {
      name: name.trim(),
      displayName: displayName?.trim(),
      description: description,
      reviewers: reviewers
        .map((d: EntityReference) => toString(d.fullyQualifiedName))
        .filter(Boolean),
      owner: selectedOwner,
      tags: tags || [],
      mutuallyExclusive: Boolean(mutuallyExclusive),
    };
    onSave(data);
  };

  const rightPanel = (
    <div data-testid="right-panel">
      <Typography.Title level={5}>
        {t('label.configure-entity', {
          entity: t('label.glossary'),
        })}
      </Typography.Title>
      <Typography.Text className="mb-5">
        {t('message.create-new-glossary-guide')}
      </Typography.Text>
    </div>
  );

  const formFields: FieldProp[] = [
    {
      name: 'name',
      id: 'root/name',
      label: t('label.name'),
      required: true,
      placeholder: t('label.name'),
      type: FieldTypes.TEXT,
      props: {
        'data-testid': 'name',
      },
      rules: [
        {
          pattern: ENTITY_NAME_REGEX,
          message: t('message.entity-name-validation'),
        },
        {
          min: 1,
          max: 128,
          message: `${t('message.entity-maximum-size', {
            entity: `${t('label.name')}`,
            max: '128',
          })}`,
        },
      ],
    },
    {
      name: 'displayName',
      id: 'root/displayName',
      label: t('label.display-name'),
      required: false,
      placeholder: t('label.display-name'),
      type: FieldTypes.TEXT,
      props: {
        'data-testid': 'display-name',
      },
    },
    {
      name: 'description',
      required: true,
      label: t('label.description'),
      id: 'root/description',
      type: FieldTypes.DESCRIPTION,
      props: {
        'data-testid': 'description',
        className: 'glossary-richtext-editor',
        initialValue: '',
        height: 'auto',
        readonly: !allowAccess,
      },
    },
    {
      name: 'tags',
      required: false,
      label: t('label.tag-plural'),
      id: 'root/tags',
      type: FieldTypes.TAG_SUGGESTION,
      props: {
        'data-testid': 'tags-container',
      },
    },
    {
      name: 'mutuallyExclusive',
      label: t('label.mutually-exclusive'),
      type: FieldTypes.SWITCH,
      required: false,
      props: {
        'data-testid': 'mutually-exclusive-button',
      },
      id: 'root/mutuallyExclusive',
      formItemLayout: FormItemLayout.HORIZONATAL,
    },
  ];

  const ownerField: FieldProp = {
    name: 'owner',
    id: 'root/owner',
    required: false,
    label: t('label.owner'),
    type: FieldTypes.USER_TEAM_SELECT,
    props: {
      hasPermission: true,
      children: (
        <Button
          data-testid="add-owner"
          icon={<PlusOutlined style={{ color: 'white', fontSize: '12px' }} />}
          size="small"
          type="primary"
        />
      ),
    },
    formItemLayout: FormItemLayout.HORIZONATAL,
    formItemProps: {
      valuePropName: 'owner',
      trigger: 'onUpdate',
    },
  };

  const reviewersField: FieldProp = {
    name: 'reviewers',
    id: 'root/reviewers',
    required: false,
    label: t('label.reviewer-plural'),
    type: FieldTypes.USER_MULTI_SELECT,
    props: {
      hasPermission: true,
      popoverProps: { placement: 'topLeft' },
      children: (
        <Button
          data-testid="add-reviewers"
          icon={<PlusOutlined style={{ color: 'white', fontSize: '12px' }} />}
          size="small"
          type="primary"
        />
      ),
    },
    formItemLayout: FormItemLayout.HORIZONATAL,
    formItemProps: {
      valuePropName: 'selectedUsers',
      trigger: 'onUpdate',
      initialValue: [],
    },
  };

  return (
    <ResizablePanels
      firstPanel={{
        children: (
          <div className="max-width-md w-9/10 service-form-container">
            <TitleBreadcrumb titleLinks={slashedBreadcrumb} />
            <Typography.Title
              className="m-t-md"
              data-testid="form-heading"
              level={5}>
              {header}
            </Typography.Title>
            <div className="add-glossary" data-testid="add-glossary">
              <Form form={form} layout="vertical" onFinish={handleSave}>
                {generateFormFields(formFields)}
                <div className="m-t-xss">
                  {getField(ownerField)}
                  {selectedOwner && (
                    <div className="m-y-xs" data-testid="owner-container">
                      <UserTag
                        id={selectedOwner.id}
                        name={getEntityName(selectedOwner)}
                        size={UserTagSize.small}
                      />
                    </div>
                  )}
                </div>
                <div className="m-t-xss">
                  {getField(reviewersField)}
                  {Boolean(reviewersList.length) && (
                    <Space
                      wrap
                      className="m-y-xs"
                      data-testid="reviewers-container"
                      size={[8, 8]}>
                      {reviewersList.map((d, index) => (
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
              </Form>
            </div>
          </div>
        ),
        minWidth: 700,
        flex: 0.7,
      }}
      pageTitle={t('label.add-entity', {
        entity: t('label.glossary'),
      })}
      secondPanel={{
        children: rightPanel,
        className: 'p-md service-doc-panel',
        minWidth: 60,
        overlay: {
          displayThreshold: 200,
          header: t('label.setup-guide'),
          rotation: 'counter-clockwise',
        },
      }}
    />
  );
};

export default AddGlossary;
