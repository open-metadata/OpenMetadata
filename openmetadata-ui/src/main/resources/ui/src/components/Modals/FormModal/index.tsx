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

import { Button, Modal, Space, Typography } from 'antd';
import { t } from 'i18next';
import React, { useRef, useState } from 'react';
import { Classification } from '../../../generated/entity/classification/classification';
import { Team } from '../../../generated/entity/teams/team';
import { FormData, FormModalProp, FormRef } from './FormModal.interface';

const FormModal = ({
  onCancel,
  onChange,
  onSave,
  form: Form,
  header,
  initialData,
  errorData,
  isSaveButtonDisabled,
  visible,
  showHiddenFields = false,
}: FormModalProp) => {
  const formRef = useRef<FormRef>();
  const [data, setData] = useState<FormData>(initialData);

  const onSubmitHandler = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSave({
      ...data,
      description: formRef?.current?.fetchMarkDownData() || '',
    });
  };

  return (
    <Modal
      centered
      destroyOnClose
      closable={false}
      data-testid="modal-container"
      footer={
        <Space
          align="end"
          className="justify-end p-r-lg p-t-sm"
          data-testid="cta-container">
          <Button type="link" onClick={onCancel}>
            {t('label.cancel')}
          </Button>
          <Button
            data-testid="saveButton"
            disabled={isSaveButtonDisabled}
            form="form-modal"
            htmlType="submit"
            type="primary">
            {t('label.save')}
          </Button>
        </Space>
      }
      maskClosable={false}
      open={visible}
      title={
        <Typography.Text strong data-testid="header">
          {header}
        </Typography.Text>
      }
      width={1300}
      onCancel={onCancel}>
      <form id="form-modal" onSubmit={onSubmitHandler}>
        <Form
          errorData={errorData}
          initialData={initialData}
          ref={formRef}
          saveData={(data: Classification | Team) => {
            setData(data);
            onChange && onChange(data);
          }}
          showHiddenFields={showHiddenFields}
        />
      </form>
    </Modal>
  );
};

export default FormModal;
