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
import { Button, Space, Switch, Typography } from 'antd';
import Tags from 'components/Tag/Tags/tags';
import { LOADING_STATE } from 'enums/common.enum';
import { cloneDeep } from 'lodash';
import { EntityTags } from 'Models';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ADD_GLOSSARY_ERROR } from '../../constants/Glossary.constant';
import { allowedNameRegEx } from '../../constants/regex.constants';
import { PageLayoutType } from '../../enums/layout.enum';
import { CreateGlossary } from '../../generated/api/data/createGlossary';
import { EntityReference } from '../../generated/type/entityReference';
import { getCurrentUserId, requiredField } from '../../utils/CommonUtils';
import { AddTags } from '../AddTags/add-tags.component';
import RichTextEditor from '../common/rich-text-editor/RichTextEditor';
import { EditorContentRef } from '../common/rich-text-editor/RichTextEditor.interface';
import TitleBreadcrumb from '../common/title-breadcrumb/title-breadcrumb.component';
import PageLayout from '../containers/PageLayout';
import ReviewerModal from '../Modals/ReviewerModal/ReviewerModal.component';
import { AddGlossaryError, AddGlossaryProps } from './AddGlossary.interface';

const Field = ({ children }: { children: React.ReactNode }) => {
  return <div className="tw-mt-4">{children}</div>;
};

const AddGlossary = ({
  header,
  allowAccess = true,
  saveState = 'initial',
  slashedBreadcrumb,
  onCancel,
  onSave,
}: AddGlossaryProps) => {
  const markdownRef = useRef<EditorContentRef>();
  const { t } = useTranslation();

  const [showErrorMsg, setShowErrorMsg] = useState<{ [key: string]: boolean }>({
    name: false,
    invalidName: false,
    description: false,
  });

  const [name, setName] = useState('');
  const [description] = useState<string>('');
  const [showReviewerModal, setShowReviewerModal] = useState(false);
  const [tags, setTags] = useState<EntityTags[]>([]);
  const [mutuallyExclusive, setMutuallyExclusive] = useState(false);
  const [reviewer, setReviewer] = useState<Array<EntityReference>>([]);

  const getDescription = () => {
    return markdownRef.current?.getEditorContent() || '';
  };

  const onReviewerModalCancel = () => {
    setShowReviewerModal(false);
  };

  const handleReviewerSave = (reviewer: Array<EntityReference>) => {
    setReviewer(reviewer);
    onReviewerModalCancel();
  };

  const handleValidation = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    if (!allowAccess) {
      return;
    }
    const value = event.target.value;
    const eleName = event.target.name;
    let { name, invalidName } = cloneDeep(showErrorMsg);

    switch (eleName) {
      case 'name': {
        setName(value);
        name = false;
        invalidName = false;

        break;
      }
    }
    setShowErrorMsg((prev) => {
      return { ...prev, name, invalidName };
    });
  };

  const handleReviewerRemove = (
    _event: React.MouseEvent<HTMLElement, MouseEvent>,
    removedTag: string
  ) => {
    setReviewer((pre) => pre.filter((option) => option.name !== removedTag));
  };

  const validateForm = () => {
    const errMsg = {
      name: !name.trim(),
      invalidName: allowedNameRegEx.test(name),
      description: !getDescription()?.trim(),
    };
    setShowErrorMsg(errMsg);

    return !Object.values(errMsg).includes(true);
  };

  const handleSave = () => {
    if (validateForm()) {
      const data: CreateGlossary = {
        name: name.trim(),
        displayName: name.trim(),
        description: getDescription(),
        reviewers: reviewer.map((d) => ({ id: d.id, type: d.type })),
        owner: {
          id: getCurrentUserId(),
          type: 'user',
        },
        tags: tags,
        mutuallyExclusive,
      };

      onSave(data);
    }
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
      rightPanel={fetchRightPanel()}>
      <div className="tw-form-container">
        <Typography.Title data-testid="form-heading" level={5}>
          {header}
        </Typography.Title>
        <div className="tw-pb-3" data-testid="add-glossary">
          <Field>
            <label className="tw-block tw-form-label" htmlFor="name">
              {requiredField(`${t('label.name')}:`)}
            </label>

            <input
              className="tw-form-inputs tw-form-inputs-padding"
              data-testid="name"
              id="name"
              name="name"
              placeholder={t('label.name')}
              type="text"
              value={name}
              onChange={handleValidation}
            />

            {showErrorMsg.name
              ? ADD_GLOSSARY_ERROR[AddGlossaryError.NAME_REQUIRED]
              : showErrorMsg.invalidName
              ? ADD_GLOSSARY_ERROR[AddGlossaryError.NAME_INVALID]
              : null}
          </Field>
          <Field>
            <label
              className="tw-block tw-form-label tw-mb-0"
              htmlFor="description">
              {requiredField(`${t('label.description')}:`)}
            </label>
            <RichTextEditor
              data-testid="description"
              initialValue={description}
              readonly={!allowAccess}
              ref={markdownRef}
            />
            {showErrorMsg.description &&
              ADD_GLOSSARY_ERROR[AddGlossaryError.DESCRIPTION_REQUIRED]}
          </Field>

          <Field>
            <Space className="w-full" direction="vertical">
              <label htmlFor="tags">{t('label.tag-plural')}:</label>
              <AddTags
                data-testid="tags"
                setTags={(tag: EntityTags[]) => setTags(tag)}
              />
            </Space>
          </Field>

          <Field>
            <Space align="end">
              <label
                className="tw-form-label m-b-0 tw-mb-1"
                data-testid="mutually-exclusive-label"
                htmlFor="mutuallyExclusive">
                {t('label.mutually-exclusive')}
              </label>
              <Switch
                checked={mutuallyExclusive}
                data-testid="mutually-exclusive-button"
                id="mutuallyExclusive"
                onChange={(value) => setMutuallyExclusive(value)}
              />
            </Space>
          </Field>

          <div>
            <div className="tw-flex tw-items-center tw-mt-4">
              <span className="w-form-label tw-mr-3">
                {t('label.reviewer-plural')}:
              </span>
              <Button
                data-testid="add-reviewers"
                size="small"
                type="primary"
                onClick={() => setShowReviewerModal(true)}>
                <PlusOutlined style={{ color: 'white' }} />
              </Button>
            </div>
            <div className="tw-my-4" data-testid="reviewers-container">
              {Boolean(reviewer.length) &&
                reviewer.map((d, index) => {
                  return (
                    <Tags
                      editable
                      isRemovable
                      className="tw-bg-gray-200"
                      key={index}
                      removeTag={handleReviewerRemove}
                      tag={d.name ?? ''}
                      type="contained"
                    />
                  );
                })}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              data-testid="cancel-glossary"
              type="link"
              onClick={onCancel}>
              {t('label.cancel')}
            </Button>

            <Button
              data-testid="save-glossary"
              disabled={!allowAccess}
              loading={saveState === LOADING_STATE.WAITING}
              type="primary"
              onClick={handleSave}>
              {t('label.save')}
            </Button>
          </div>
        </div>
        <ReviewerModal
          header={t('label.add-entity', {
            entity: t('label.reviewer'),
          })}
          reviewer={reviewer}
          visible={showReviewerModal}
          onCancel={onReviewerModalCancel}
          onSave={handleReviewerSave}
        />
      </div>
    </PageLayout>
  );
};

export default AddGlossary;
