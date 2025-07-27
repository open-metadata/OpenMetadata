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
import { useTranslation } from 'react-i18next';
import {
  CreateGlossary,
  EntityReference,
} from '../../../generated/api/data/createGlossary';
import {
  FieldProp,
  FieldTypes,
  FormItemLayout,
  HelperTextType,
} from '../../../interface/FormUtils.interface';
import { generateFormFields, getField } from '../../../utils/formUtils';

import { NAME_FIELD_RULES } from '../../../constants/Form.constants';
import { EntityType } from '../../../enums/entity.enum';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useDomainStore } from '../../../hooks/useDomainStore';
import { DomainLabel } from '../../common/DomainLabel/DomainLabel.component';
import { OwnerLabel } from '../../common/OwnerLabel/OwnerLabel.component';
import ResizablePanels from '../../common/ResizablePanels/ResizablePanels';
import TitleBreadcrumb from '../../common/TitleBreadcrumb/TitleBreadcrumb.component';
import './add-glossary.less';
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
  const { currentUser } = useApplicationStore();
  const { activeDomainEntityRef } = useDomainStore();

  const selectedOwners =
    Form.useWatch<EntityReference | EntityReference[]>('owners', form) ?? [];

  const ownersList = Array.isArray(selectedOwners)
    ? selectedOwners
    : [selectedOwners];

  const reviewersData =
    Form.useWatch<EntityReference | EntityReference[]>('reviewers', form) ?? [];

  const selectedDomain = Form.useWatch<EntityReference[] | undefined>(
    'domains',
    form
  );

  const reviewersList = Array.isArray(reviewersData)
    ? reviewersData
    : [reviewersData];

  const isMutuallyExclusive = Form.useWatch<boolean | undefined>(
    'mutuallyExclusive',
    form
  );

  const handleSave: FormProps['onFinish'] = (formData) => {
    const { name, displayName, description, tags, mutuallyExclusive } =
      formData;

    const selectedOwners =
      ownersList.length > 0
        ? ownersList
        : [
            {
              id: currentUser?.id ?? '',
              type: 'user',
            },
          ];

    const data: CreateGlossary = {
      name: name.trim(),
      displayName: displayName?.trim(),
      description: description,
      reviewers: reviewersList.filter(Boolean),
      owners: selectedOwners,
      tags: tags || [],
      mutuallyExclusive: Boolean(mutuallyExclusive),
      domains:
        (selectedDomain
          ?.map((d) => d.fullyQualifiedName)
          .filter(Boolean) as string[]) ?? [],
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
      rules: NAME_FIELD_RULES,
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
      rules: [
        {
          required: true,
          whitespace: true,
          message: t('label.field-required', {
            field: t('label.description'),
          }),
        },
      ],
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
      helperText: t('message.mutually-exclusive-alert', {
        entity: t('label.glossary'),
        'child-entity': t('label.glossary-term'),
      }),
      helperTextType: HelperTextType.ALERT,
      showHelperText: Boolean(isMutuallyExclusive),
      props: {
        'data-testid': 'mutually-exclusive-button',
      },
      id: 'root/mutuallyExclusive',
      formItemLayout: FormItemLayout.HORIZONTAL,
    },
  ];

  const ownerField: FieldProp = {
    name: 'owners',
    id: 'root/owner',
    required: false,
    label: t('label.owner-plural'),
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
      multiple: { user: true, team: false },
    },
    formItemLayout: FormItemLayout.HORIZONTAL,
    formItemProps: {
      valuePropName: 'owners',
      trigger: 'onUpdate',
    },
  };

  const reviewersField: FieldProp = {
    name: 'reviewers',
    id: 'root/reviewers',
    required: false,
    label: t('label.reviewer-plural'),
    type: FieldTypes.USER_TEAM_SELECT,
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
      multiple: { user: true, team: false },
      previewSelected: true,
      label: t('label.reviewer-plural'),
    },
    formItemLayout: FormItemLayout.HORIZONTAL,
    formItemProps: {
      valuePropName: 'selectedUsers',
      trigger: 'onUpdate',
    },
  };

  const domainsField: FieldProp = {
    name: 'domains',
    id: 'root/domains',
    required: false,
    label: t('label.domain-plural'),
    type: FieldTypes.DOMAIN_SELECT,
    props: {
      selectedDomain: activeDomainEntityRef,
      children: (
        <Button
          data-testid="add-domain"
          icon={<PlusOutlined style={{ color: 'white', fontSize: '12px' }} />}
          size="small"
          type="primary"
        />
      ),
      multiple: true,
    },
    formItemLayout: FormItemLayout.HORIZONTAL,
    formItemProps: {
      valuePropName: 'selectedDomain',
      trigger: 'onUpdate',
      initialValue: activeDomainEntityRef,
    },
  };

  return (
    <ResizablePanels
      className="content-height-with-resizable-panel"
      firstPanel={{
        className: 'content-resizable-panel-container',
        cardClassName: 'm-x-auto max-w-md',
        allowScroll: true,
        children: (
          <>
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
                <div className="m-y-xs">
                  {getField(ownerField)}
                  {Boolean(ownersList.length) && (
                    <Space wrap data-testid="owner-container" size={[8, 8]}>
                      <OwnerLabel owners={ownersList} />
                    </Space>
                  )}
                </div>
                <div className="m-y-xs">
                  {getField(reviewersField)}
                  {Boolean(reviewersList.length) && (
                    <Space wrap data-testid="reviewers-container" size={[8, 8]}>
                      <OwnerLabel owners={reviewersList} />
                    </Space>
                  )}
                </div>
                <div className="m-t-xss">
                  {getField(domainsField)}
                  {selectedDomain && (
                    <DomainLabel
                      domains={selectedDomain}
                      entityFqn=""
                      entityId=""
                      entityType={EntityType.GLOSSARY}
                      hasPermission={false}
                    />
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
          </>
        ),
        minWidth: 700,
        flex: 0.7,
      }}
      pageTitle={t('label.add-entity', {
        entity: t('label.glossary'),
      })}
      secondPanel={{
        children: rightPanel,
        className: 'content-resizable-panel-container',
        minWidth: 400,
        flex: 0.3,
      }}
    />
  );
};

export default AddGlossary;
