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

import { Form, Modal, Select } from 'antd';
import { AxiosError } from 'axios';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  API_RES_MAX_SIZE,
  VALIDATION_MESSAGES,
} from '../../../constants/constants';
import { getGlossaryTerms } from '../../../rest/glossaryAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { ChangeParentProps } from './ChangeParent.interface';

const ChangeParent = ({
  selectedData,
  open,
  onCancel,
  onSubmit,
}: ChangeParentProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isFetching, setIsFetching] = useState<boolean>(true);
  const [options, setOptions] = useState<
    {
      label: string;
      value: string;
    }[]
  >([]);

  const fetchGlossaryTerm = async () => {
    setIsFetching(true);
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
      setIsFetching(false);
    }
  };

  const handleSubmit = async (value: { parent: string }) => {
    setIsSaving(true);
    await onSubmit(value.parent);
    setIsSaving(false);
  };

  useEffect(() => {
    fetchGlossaryTerm();
  }, []);

  return (
    <Modal
      cancelText={t('label.cancel')}
      okButtonProps={{
        form: 'change-parent-modal',
        htmlType: 'submit',
        loading: isSaving,
      }}
      okText={t('label.submit')}
      open={open}
      title={t('label.change-entity', { entity: t('label.parent') })}
      onCancel={onCancel}>
      <Form
        form={form}
        id="change-parent-modal"
        layout="vertical"
        validateMessages={VALIDATION_MESSAGES}
        onFinish={handleSubmit}>
        <Form.Item
          label={t('label.select-field', {
            field: t('label.parent'),
          })}
          name="parent"
          rules={[
            {
              required: true,
            },
          ]}>
          <Select
            data-testid="change-parent-select"
            loading={isFetching}
            options={options}
            placeholder={t('label.select-field', {
              field: t('label.parent'),
            })}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ChangeParent;
