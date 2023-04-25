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
import {
  Button,
  Form,
  FormProps,
  Input,
  Select,
  Space,
  Spin,
  Switch,
  Typography,
} from 'antd';
import { UserSelectableList } from 'components/common/UserSelectableList/UserSelectableList.component';
import { UserTag } from 'components/common/UserTag/UserTag.component';
import { UserTagSize } from 'components/common/UserTag/UserTag.interface';
import { UserTeamSelectableList } from 'components/common/UserTeamSelectableList/UserTeamSelectableList.component';
import { PAGE_SIZE } from 'constants/constants';
import { ENTITY_NAME_REGEX } from 'constants/regex.constants';
import { SearchIndex } from 'enums/search.enum';
import { t } from 'i18next';
import { debounce } from 'lodash';
import TagSuggestion from 'pages/TasksPage/shared/TagSuggestion';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { searchData } from 'rest/miscAPI';
import { formatSearchGlossaryTermResponse } from 'utils/APIUtils';
import { getEntityName } from 'utils/EntityUtils';
import {
  formatRelatedTermOptions,
  getEntityReferenceFromGlossaryTerm,
} from 'utils/GlossaryUtils';
import { EntityReference } from '../../generated/type/entityReference';
import { getCurrentUserId } from '../../utils/CommonUtils';
import SVGIcons from '../../utils/SvgUtils';
import RichTextEditor from '../common/rich-text-editor/RichTextEditor';
import { EditorContentRef } from '../common/rich-text-editor/RichTextEditor.interface';
import { AddGlossaryTermFormProps } from './AddGlossaryTermForm.interface';

const AddGlossaryTermForm = ({
  editMode,
  onSave,
  onCancel,
  isLoading,
  glossaryReviewers = [],
  glossaryTerm,
  isFormInModal = false,
  formRef: form,
}: AddGlossaryTermFormProps) => {
  const markdownRef = useRef<EditorContentRef>();
  const [reviewer, setReviewer] = useState<Array<EntityReference>>([]);
  const [relatedTerms, setRelatedTerms] = useState<EntityReference[]>([]);
  const [owner, setOwner] = useState<EntityReference | undefined>();
  const [isSuggestionLoading, setIsSuggestionLoading] =
    useState<boolean>(false);
  const [relatedTermsOptions, setRelatedTermsOptions] =
    useState<EntityReference[]>();

  const suggestionSearch = useCallback(
    (searchText = '') => {
      setIsSuggestionLoading(true);
      searchData(searchText, 1, PAGE_SIZE, '', '', '', SearchIndex.GLOSSARY)
        .then((res) => {
          let termResult = formatSearchGlossaryTermResponse(res.data.hits.hits);
          if (editMode && glossaryTerm) {
            termResult = termResult.filter((item) => {
              return (
                item.fullyQualifiedName !== glossaryTerm.fullyQualifiedName
              );
            });
          }
          const results = termResult.map(getEntityReferenceFromGlossaryTerm);
          setRelatedTermsOptions(results);
        })
        .catch(() => {
          setRelatedTermsOptions([]);
        })
        .finally(() => setIsSuggestionLoading(false));
    },
    [glossaryTerm]
  );

  const debounceOnSearch = useCallback(debounce(suggestionSearch, 250), []);

  const handleReviewerSave = (reviewer: Array<EntityReference>) => {
    setReviewer(reviewer);
  };

  const handleUpdatedOwner = async (owner: EntityReference | undefined) => {
    setOwner(owner);
  };

  const handleSave: FormProps['onFinish'] = (formObj) => {
    const {
      name,
      displayName = '',
      description = '',
      synonyms = [],
      tags = [],
      mutuallyExclusive = false,
      references = [],
    } = formObj;

    const selectedOwner = owner || {
      id: getCurrentUserId(),
      type: 'user',
    };

    const updatedTerms = editMode
      ? relatedTerms.map((term) => term.id || '')
      : relatedTerms.map((term) => term.fullyQualifiedName || '');

    const data = {
      name: name.trim(),
      displayName: (displayName || name).trim(),
      description: description,
      reviewers: reviewer,
      relatedTerms: updatedTerms.length > 0 ? updatedTerms : undefined,
      references: references.length > 0 ? references : undefined,
      synonyms: synonyms,
      mutuallyExclusive,
      tags: tags,
      owner: selectedOwner,
    };
    onSave(data);
  };

  useEffect(() => {
    if (glossaryReviewers.length > 0) {
      setReviewer(glossaryReviewers);
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
        owner,
        relatedTerms,
      } = glossaryTerm;

      form.setFieldsValue({
        name,
        displayName,
        description,
        synonyms,
        tags,
        references,
        mutuallyExclusive,
        relatedTerms: relatedTerms?.map((r) => r.id || ''),
      });

      if (reviewers) {
        setReviewer(reviewers);
      }

      if (owner) {
        setOwner(owner);
      }

      if (relatedTerms && relatedTerms.length > 0) {
        setRelatedTerms(relatedTerms);
        setRelatedTermsOptions(relatedTerms);
      }
    }
  }, [editMode, glossaryTerm, glossaryReviewers, form]);

  return (
    <>
      <Form
        form={form}
        initialValues={{
          description: editMode && glossaryTerm ? glossaryTerm.description : '',
        }}
        layout="vertical"
        onFinish={handleSave}>
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
            initialValue={glossaryTerm ? glossaryTerm.description : ''}
            ref={markdownRef}
          />
        </Form.Item>
        <Form.Item data-testid="tags" label={t('label.tag-plural')} name="tags">
          <TagSuggestion />
        </Form.Item>
        <Form.Item
          id="synonyms"
          label={t('label.synonym-plural')}
          name="synonyms">
          <Select
            className="glossary-select"
            data-testid="synonyms"
            id="synonyms-select"
            mode="tags"
            open={false}
            placeholder={t('message.synonym-placeholder')}
          />
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

        <Form.Item
          data-testid="relatedTerms"
          id="relatedTerms"
          label={t('label.related-term-plural')}
          name="relatedTerms">
          <Select
            className="glossary-select"
            filterOption={false}
            mode="multiple"
            notFoundContent={isSuggestionLoading ? <Spin size="small" /> : null}
            options={formatRelatedTermOptions(relatedTermsOptions)}
            placeholder={t('label.add-entity', {
              entity: t('label.related-term-plural'),
            })}
            onChange={(_, data) => {
              setRelatedTerms(data as EntityReference[]);
            }}
            onFocus={() => suggestionSearch()}
            onSearch={debounceOnSearch}
          />
        </Form.Item>

        <Form.List name="references">
          {(fields, { add, remove }) => (
            <>
              <Space align="center" size={63}>
                <Typography.Text>{t('label.reference-plural')}</Typography.Text>
                <Form.Item
                  className="m-b-0 glossary-form-antd-label"
                  colon={false}>
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
              </Space>

              {fields.map((field, index) => (
                <div className="d-flex item-start" key={field.key}>
                  <div className="tw-grid tw-grid-cols-2 tw-gap-x-2 tw-w-11/12 m-t-xs">
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
                        className="tw-form-inputs tw-form-inputs-padding"
                        id={`name-${index}`}
                        placeholder={t('label.name')}
                      />
                    </Form.Item>
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
                        className="tw-form-inputs tw-form-inputs-padding"
                        id={`url-${index}`}
                        placeholder={t('label.endpoint')}
                      />
                    </Form.Item>
                  </div>
                  <button
                    className="focus:tw-outline-none tw-w-1/12 m-t-xs"
                    onClick={() => {
                      remove(field.name);
                    }}>
                    <SVGIcons
                      alt={t('message.valid-url-endpoint')}
                      icon="icon-delete"
                      title="Delete"
                      width="16px"
                    />
                  </button>
                </div>
              ))}
            </>
          )}
        </Form.List>

        <div>
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
                  <PlusOutlined style={{ color: 'white', fontSize: '12px' }} />
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
        <div>
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
                  <PlusOutlined style={{ color: 'white', fontSize: '12px' }} />
                }
                size="small"
                type="primary"
              />
            </UserSelectableList>
          </div>
          {Boolean(reviewer.length) && (
            <Space wrap className="tw-my-2" size={[8, 8]}>
              {reviewer.map((d) => (
                <UserTag
                  id={d.id}
                  key={d.id}
                  name={getEntityName(d)}
                  size={UserTagSize.small}
                />
              ))}
            </Space>
          )}
        </div>

        {!isFormInModal && (
          <Form.Item>
            <Space
              className="w-full justify-end"
              data-testid="cta-buttons"
              size={16}>
              <Button
                data-testid="cancel-glossary-term"
                type="link"
                onClick={onCancel}>
                {t('label.cancel')}
              </Button>
              <Button
                data-testid="save-glossary-term"
                htmlType="submit"
                loading={isLoading}
                type="primary">
                {t('label.save')}
              </Button>
            </Space>
          </Form.Item>
        )}
      </Form>
    </>
  );
};

export default AddGlossaryTermForm;
