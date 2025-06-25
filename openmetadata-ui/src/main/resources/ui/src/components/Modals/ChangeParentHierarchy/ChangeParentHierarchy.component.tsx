/*
 *  Copyright 2024 Collate.
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

import { Checkbox, Form, Modal } from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import TreeAsyncSelectList from '../../../components/common/AsyncSelectList/TreeAsyncSelectList';
import { TagSource } from '../../../generated/entity/data/container';
import { Glossary } from '../../../generated/entity/data/glossary';
import {
  GlossaryTerm,
  Status,
} from '../../../generated/entity/data/glossaryTerm';
import { Transi18next } from '../../../utils/CommonUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { StatusClass } from '../../../utils/GlossaryUtils';
import StatusBadge from '../../common/StatusBadge/StatusBadge.component';
import { ChangeParentHierarchyProps } from './ChangeParentHierarchy.interface';

const ChangeParentHierarchy = ({
  selectedData,
  onCancel,
  onSubmit,
}: ChangeParentHierarchyProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loadingState, setLoadingState] = useState({
    isSaving: false,
  });
  const [confirmCheckboxChecked, setConfirmCheckboxChecked] = useState(false);
  const [selectedParent, setSelectedParent] =
    useState<DefaultOptionType | null>(null);

  const hasReviewers = Boolean(
    selectedData.reviewers && selectedData.reviewers.length > 0
  );

  const handleTagSelection = (
    option: DefaultOptionType | DefaultOptionType[]
  ) => {
    // Handle both single option and array of options
    const tags = Array.isArray(option) ? option : [option];

    if (tags.length > 0) {
      const selectedOption = tags[0];
      setSelectedParent(selectedOption);
      form.setFieldsValue({ parent: selectedOption.value as string });
    } else {
      setSelectedParent(null);
      form.setFieldsValue({ parent: undefined });
    }
  };

  const handleSubmit = async () => {
    setLoadingState((prev) => ({ ...prev, isSaving: true }));
    await onSubmit(selectedParent?.data as Glossary | GlossaryTerm);
    setLoadingState((prev) => ({ ...prev, isSaving: false }));
  };

  return (
    <Modal
      open
      cancelText={t('label.cancel')}
      okButtonProps={{
        form: 'change-parent-hierarchy-modal',
        htmlType: 'submit',
        loading: loadingState.isSaving,
        disabled: hasReviewers && !confirmCheckboxChecked,
      }}
      okText={t('label.submit')}
      title={t('label.change-entity', { entity: t('label.parent') })}
      onCancel={onCancel}>
      <Form
        form={form}
        id="change-parent-hierarchy-modal"
        layout="vertical"
        onFinish={handleSubmit}>
        <Form.Item
          label={t('label.select-field', {
            field: t('label.parent'),
          })}
          name="parent"
          rules={[
            {
              required: true,
              message: t('label.field-required', {
                field: t('label.parent'),
              }),
            },
          ]}>
          <TreeAsyncSelectList
            isParentSelectable
            data-testid="change-parent-select"
            filterOptions={[selectedData.fullyQualifiedName ?? '']}
            isMultiSelect={false}
            open={false}
            placeholder={t('label.select-field', {
              field: t('label.parent'),
            })}
            tagType={TagSource.Glossary}
            onChange={handleTagSelection}
          />
        </Form.Item>

        {hasReviewers && (
          <div className="m-t-md">
            <Checkbox
              checked={confirmCheckboxChecked}
              className="text-grey-700"
              data-testid="confirm-status-checkbox"
              onChange={(e) => setConfirmCheckboxChecked(e.target.checked)}>
              <span>
                <Transi18next
                  i18nKey="message.entity-transfer-confirmation-message"
                  renderElement={<strong />}
                  values={{
                    from: getEntityName(selectedData),
                  }}
                />
                <span className="d-inline-block m-l-xss">
                  <StatusBadge
                    className="p-x-xs p-y-xss"
                    dataTestId=""
                    label={Status.InReview}
                    status={StatusClass[Status.InReview]}
                  />
                </span>
              </span>
            </Checkbox>
          </div>
        )}
      </Form>
    </Modal>
  );
};

export default ChangeParentHierarchy;
