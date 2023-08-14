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
import { Button, Modal } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { Domain } from 'generated/entity/domains/domain';
import React from 'react';
import { useTranslation } from 'react-i18next';
import AddDomainForm from '../AddDomainForm/AddDomainForm.component';

interface props {
  open: boolean;
  data?: Domain;
  onCancel: () => void;
  onSubmit: (data: Domain) => Promise<void>;
}

const AddSubDomainModal = ({ open, onSubmit, onCancel }: props) => {
  const { t } = useTranslation();
  const [form] = useForm();

  const handleFormSubmit = async (formData: Domain) => {
    onSubmit(formData);
  };

  return (
    <Modal
      cancelText={t('label.cancel')}
      closable={false}
      footer={[
        <Button key="cancel-btn" type="link" onClick={onCancel}>
          {t('label.cancel')}
        </Button>,
        <Button
          data-testid="save-glossary-term"
          key="save-btn"
          type="primary"
          onClick={() => form.submit()}>
          {t('label.save')}
        </Button>,
      ]}
      maskClosable={false}
      okText={t('label.submit')}
      open={open}
      title={t('label.add-entity', { entity: t('label.sub-domain') })}
      width={750}
      onCancel={onCancel}>
      <AddDomainForm
        isFormInDialog
        formRef={form}
        onCancel={onCancel}
        onSubmit={handleFormSubmit}
      />
    </Modal>
  );
};

export default AddSubDomainModal;
