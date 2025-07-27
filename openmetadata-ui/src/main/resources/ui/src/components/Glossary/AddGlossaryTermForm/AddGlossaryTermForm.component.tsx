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
import { PlusOutlined } from '@ant-design/icons';
import { Button, Col, Form, FormProps, Input, Row, Space } from 'antd';
import { DefaultOptionType } from 'antd/lib/select';

import { isEmpty, isString } from 'lodash';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DeleteIcon } from '../../../assets/svg/ic-delete.svg';
import { NAME_FIELD_RULES } from '../../../constants/Form.constants';
import { HEX_COLOR_CODE_REGEX } from '../../../constants/regex.constants';
import { EntityReference } from '../../../generated/entity/type';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  FieldProp,
  FieldTypes,
  FormItemLayout,
  HelperTextType,
} from '../../../interface/FormUtils.interface';
import { generateFormFields, getField } from '../../../utils/formUtils';
import { fetchGlossaryList } from '../../../utils/TagsUtils';
import { OwnerLabel } from '../../common/OwnerLabel/OwnerLabel.component';
import { AddGlossaryTermFormProps } from './AddGlossaryTermForm.interface';

const AddGlossaryTermForm = ({
  editMode,
  onSave,
  glossaryTerm,
  formRef: form,
}: AddGlossaryTermFormProps) => {
  const { currentUser } = useApplicationStore();
  const selectedOwners =
    Form.useWatch<EntityReference | EntityReference[]>('owners', form) ?? [];
  const { t } = useTranslation();

  const ownersList = Array.isArray(selectedOwners)
    ? selectedOwners
    : [selectedOwners];

  const reviewersData =
    Form.useWatch<EntityReference | EntityReference[]>('reviewers', form) ?? [];

  const reviewersList = Array.isArray(reviewersData)
    ? reviewersData
    : [reviewersData];

  const isMutuallyExclusive = Form.useWatch<boolean | undefined>(
    'mutuallyExclusive',
    form
  );

  const getRelatedTermFqnList = (relatedTerms: DefaultOptionType[]): string[] =>
    relatedTerms.map((tag: DefaultOptionType) => tag.value as string);

  const handleSave: FormProps['onFinish'] = async (formObj) => {
    const {
      name,
      displayName = '',
      description = '',
      synonyms = [],
      tags = [],
      mutuallyExclusive = false,
      references = [],
      relatedTerms = [],
      color,
      iconURL,
    } = formObj;

    const selectedOwners =
      ownersList.length > 0
        ? ownersList
        : [
            {
              id: currentUser?.id ?? '',
              type: 'user',
            },
          ];

    const style = {
      color,
      iconURL,
    };

    const data = {
      name: name.trim(),
      displayName: displayName?.trim(),
      description: description,
      reviewers: reviewersList,
      relatedTerms: editMode
        ? relatedTerms.map((term: DefaultOptionType) => {
            if (isString(term)) {
              return glossaryTerm?.relatedTerms?.find(
                (r) => r.fullyQualifiedName === term
              )?.id;
            }
            if (term.data) {
              return term.data.id;
            }

            return glossaryTerm?.relatedTerms?.find(
              (r) => r.fullyQualifiedName === term.value
            )?.id;
          })
        : getRelatedTermFqnList(relatedTerms),
      references: references.length > 0 ? references : undefined,
      synonyms: synonyms,
      mutuallyExclusive,
      tags: tags,
      owners: selectedOwners,
      style: isEmpty(style) ? undefined : style,
    };

    await onSave(data);
  };

  useEffect(() => {
    if (glossaryTerm?.reviewers && glossaryTerm.reviewers.length > 0) {
      form.setFieldValue('reviewers', glossaryTerm?.reviewers);
    }
    if (editMode && glossaryTerm) {
      const {
        name,
        displayName,
        description,
        synonyms,
        tags,
        references,
        mutuallyExclusive,
        reviewers,
        owners,
        relatedTerms,
        style,
      } = glossaryTerm;

      form.setFieldsValue({
        name,
        displayName,
        description,
        synonyms,
        tags,
        references,
        mutuallyExclusive,
        relatedTerms: relatedTerms?.map((r) => r.fullyQualifiedName ?? ''),
      });

      if (reviewers) {
        form.setFieldValue('reviewers', reviewers);
      }
      if (style?.color) {
        form.setFieldValue('style.color', style.color);
      }
      if (style?.iconURL) {
        form.setFieldValue('style.iconURL', style.iconURL);
      }

      if (owners) {
        form.setFieldValue('owners', owners);
      }
    }
  }, [editMode, glossaryTerm, glossaryTerm?.reviewers, form]);

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
        initialValue: glossaryTerm?.description,
        height: 'auto',
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
        initialOptions: glossaryTerm?.tags?.map((data) => ({
          label: data.tagFQN,
          value: data.tagFQN,
          data,
        })),
      },
    },
    {
      name: 'synonyms',
      required: false,
      label: t('label.synonym-plural'),
      id: 'root/synonyms',
      type: FieldTypes.SELECT,
      props: {
        className: 'glossary-select',
        'data-testid': 'synonyms',
        mode: 'tags',
        placeholder: t('message.synonym-placeholder'),
        open: false,
      },
    },
    {
      name: 'relatedTerms',
      required: false,
      label: t('label.related-term-plural'),
      id: 'root/relatedTerms',
      type: FieldTypes.TREE_ASYNC_SELECT_LIST,
      props: {
        className: 'glossary-select',
        'data-testid': 'related-terms',
        mode: 'multiple',
        placeholder: t('label.add-entity', {
          entity: t('label.related-term-plural'),
        }),
        open: false,
        hasNoActionButtons: true,
        fetchOptions: fetchGlossaryList,
        initialOptions: glossaryTerm?.relatedTerms?.map((data) => ({
          label: data.fullyQualifiedName,
          value: data.fullyQualifiedName,
          data,
        })),
        filterOptions: [glossaryTerm?.fullyQualifiedName ?? ''],
      },
    },
    {
      name: 'iconURL',
      id: 'root/iconURL',
      label: t('label.icon-url'),
      required: false,
      placeholder: t('label.icon-url'),
      type: FieldTypes.TEXT,
      helperText: t('message.govern-url-size-message'),
      props: {
        'data-testid': 'icon-url',
        tooltipPlacement: 'right',
      },
    },
    {
      name: 'color',
      id: 'root/color',
      label: t('label.color'),
      required: false,
      type: FieldTypes.COLOR_PICKER,
      rules: [
        {
          pattern: HEX_COLOR_CODE_REGEX,
          message: t('message.hex-color-validation'),
        },
      ],
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
      formItemLayout: FormItemLayout.HORIZONTAL,
      helperText: t('message.mutually-exclusive-alert', {
        entity: t('label.glossary-term'),
        'child-entity': t('label.glossary-term'),
      }),
      helperTextType: HelperTextType.ALERT,
      showHelperText: Boolean(isMutuallyExclusive),
    },
  ];

  const ownerField: FieldProp = {
    name: 'owners',
    id: 'root/owner',
    required: false,
    label: t('label.owner-plural'),
    type: FieldTypes.USER_TEAM_SELECT,
    props: {
      owner: ownersList,
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
      owner: reviewersList,
      hasPermission: true,
      filterCurrentUser: true,
      popoverProps: { placement: 'topLeft' },
      multiple: { user: true, team: false },
      previewSelected: true,
      label: t('label.reviewer-plural'),
      children: (
        <Button
          data-testid="add-reviewers"
          icon={<PlusOutlined style={{ color: 'white', fontSize: '12px' }} />}
          size="small"
          type="primary"
        />
      ),
    },
    formItemLayout: FormItemLayout.HORIZONTAL,
    formItemProps: {
      valuePropName: 'selectedUsers',
      trigger: 'onUpdate',
    },
  };

  return (
    <>
      <Form
        form={form}
        initialValues={{
          description: editMode && glossaryTerm ? glossaryTerm.description : '',
        }}
        layout="vertical"
        onFinish={handleSave}>
        {generateFormFields(formFields)}

        <Form.List name="references">
          {(fields, { add, remove }) => (
            <>
              <Form.Item
                className="form-item-horizontal"
                colon={false}
                label={t('label.reference-plural')}>
                <Button
                  data-testid="add-reference"
                  icon={
                    <PlusOutlined
                      style={{ color: 'white', fontSize: '12px' }}
                    />
                  }
                  size="small"
                  type="primary"
                  onClick={() => {
                    add();
                  }}
                />
              </Form.Item>

              {fields.map((field, index) => (
                <Row gutter={[8, 0]} key={field.key}>
                  <Col span={11}>
                    <Form.Item
                      name={[field.name, 'name']}
                      rules={[
                        {
                          required: true,
                          message: `${t('message.field-text-is-required', {
                            fieldText: t('label.name'),
                          })}`,
                        },
                      ]}>
                      <Input
                        id={`name-${index}`}
                        placeholder={t('label.name')}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={11}>
                    <Form.Item
                      name={[field.name, 'endpoint']}
                      rules={[
                        {
                          required: true,
                          message: t('message.valid-url-endpoint'),
                          type: 'url',
                        },
                      ]}>
                      <Input
                        id={`url-${index}`}
                        placeholder={t('label.endpoint')}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={2}>
                    <Button
                      icon={<DeleteIcon width={16} />}
                      size="small"
                      type="text"
                      onClick={() => {
                        remove(field.name);
                      }}
                    />
                  </Col>
                </Row>
              ))}
            </>
          )}
        </Form.List>

        <div className="m-t-xss">
          {getField(ownerField)}

          {Boolean(ownersList.length) && (
            <Space wrap data-testid="owner-container" size={[8, 8]}>
              <OwnerLabel owners={ownersList} />
            </Space>
          )}
        </div>
        <div className="m-t-xss">
          {getField(reviewersField)}
          {Boolean(reviewersList.length) && (
            <Space wrap data-testid="reviewers-container" size={[8, 8]}>
              <OwnerLabel owners={reviewersList} />
            </Space>
          )}
        </div>
      </Form>
    </>
  );
};

export default AddGlossaryTermForm;
