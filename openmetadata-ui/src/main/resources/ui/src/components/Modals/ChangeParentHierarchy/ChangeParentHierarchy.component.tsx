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

import { Checkbox, Form, Modal, Select } from 'antd';
import { AxiosError } from 'axios';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API_RES_MAX_SIZE } from '../../../constants/constants';
import { Status } from '../../../generated/entity/data/glossaryTerm';
import { getGlossaryTerms } from '../../../rest/glossaryAPI';
import { Transi18next } from '../../../utils/CommonUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { StatusClass } from '../../../utils/GlossaryUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import StatusBadge from '../../common/StatusBadge/StatusBadge.component';
import {
  ChangeParentHierarchyProps,
  SelectOptions,
} from './ChangeParentHierarchy.interface';

const ChangeParentHierarchy = ({
  selectedData,
  onCancel,
  onSubmit,
}: ChangeParentHierarchyProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loadingState, setLoadingState] = useState({
    isSaving: false,
    isFetching: true,
  });
  const [confirmCheckboxChecked, setConfirmCheckboxChecked] = useState(false);

  const [options, setOptions] = useState<SelectOptions[]>([]);

  const hasReviewers = Boolean(
    selectedData.reviewers && selectedData.reviewers.length > 0
  );

  const fetchGlossaryTerm = async () => {
    setLoadingState((prev) => ({ ...prev, isFetching: true }));
    try {
      const { data } = await getGlossaryTerms({
        glossary: selectedData.glossary.id,
        limit: API_RES_MAX_SIZE,
      });

      setOptions(
        data
          .filter((item) => item.id !== selectedData.id)
          .map((item) => ({
            label: getEntityName(item),
            value: item.fullyQualifiedName ?? '',
          }))
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoadingState((prev) => ({ ...prev, isFetching: false }));
    }
  };

  const handleSubmit = async (value: { parent: string }) => {
    setLoadingState((prev) => ({ ...prev, isSaving: true }));
    await onSubmit(value.parent);
    setLoadingState((prev) => ({ ...prev, isSaving: false }));
  };

  useEffect(() => {
    fetchGlossaryTerm();
  }, []);

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
      okText={t('label.save')}
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
          <Select
            showSearch
            data-testid="change-parent-select"
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            loading={loadingState.isFetching}
            options={options}
            placeholder={t('label.select-field', {
              field: t('label.parent'),
            })}
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
