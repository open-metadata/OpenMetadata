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
import { Button, Modal } from 'antd';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { CreateDomain } from '../../../generated/api/domains/createDomain';
import AddDomainForm, {
  DOMAIN_FORM_DEFAULTS,
  transformDomainFormData,
} from '../AddDomainForm/AddDomainForm.component';
import { DomainFormValues } from '../AddDomainForm/AddDomainForm.interface';
import { DomainFormType } from '../DomainPage.interface';
import { AddSubDomainModalProps } from './AddSubDomainModal.interface';

const AddSubDomainModal = ({
  open,
  onSubmit,
  onCancel,
}: AddSubDomainModalProps) => {
  const { t } = useTranslation();
  const form = useForm<DomainFormValues>({
    defaultValues: DOMAIN_FORM_DEFAULTS,
  });

  const handleFormSubmit = useCallback(
    (data: DomainFormValues) => {
      const payload = transformDomainFormData(
        data,
        DomainFormType.SUBDOMAIN
      ) as CreateDomain;
      onSubmit(payload);
      form.reset();
    },
    [form, onSubmit]
  );

  const handleSave = form.handleSubmit(handleFormSubmit);

  return (
    <Modal
      centered
      cancelText={t('label.cancel')}
      className="add-subdomain-modal"
      closable={false}
      footer={[
        <Button key="cancel-btn" type="link" onClick={onCancel}>
          {t('label.cancel')}
        </Button>,
        <Button
          data-testid="save-sub-domain"
          key="save-btn"
          type="primary"
          onClick={handleSave}>
          {t('label.save')}
        </Button>,
      ]}
      maskClosable={false}
      okText={t('label.submit')}
      open={open}
      styles={{
        body: { padding: '48px' },
      }}
      title={t('label.add-entity', { entity: t('label.sub-domain') })}
      width={670}
      onCancel={onCancel}>
      <AddDomainForm
        isFormInDialog
        form={form}
        loading={false}
        type={DomainFormType.SUBDOMAIN}
        onCancel={onCancel}
        onSubmit={handleFormSubmit}
      />
    </Modal>
  );
};

export default AddSubDomainModal;
