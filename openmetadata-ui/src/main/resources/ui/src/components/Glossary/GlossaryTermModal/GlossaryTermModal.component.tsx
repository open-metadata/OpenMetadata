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
import React, { FC, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { EntityReference } from '../../../generated/entity/type';
import AddGlossaryTermForm from '../AddGlossaryTermForm/AddGlossaryTermForm.component';
import { GlossaryTermForm } from '../AddGlossaryTermForm/AddGlossaryTermForm.interface';

interface Props {
  glossaryName: string;
  glossaryTerm: GlossaryTerm | undefined;
  glossaryReviewers?: EntityReference[];
  onSave: (value: GlossaryTermForm) => void;
  onCancel: () => void;
  visible: boolean;
  editMode: boolean;
}

const GlossaryTermModal: FC<Props> = ({
  editMode,
  glossaryName,
  visible,
  glossaryTerm,
  glossaryReviewers = [],
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [form] = useForm();

  const dialogTitle = useMemo(() => {
    return editMode
      ? t('label.edit-entity', { entity: t('label.glossary-term') })
      : t('label.add-entity', { entity: t('label.glossary-term') });
  }, [editMode]);

  useEffect(() => {
    !visible && form.resetFields();
  }, [visible]);

  return (
    <Modal
      centered
      destroyOnClose
      cancelText={t('label.cancel')}
      className="edit-glossary-modal"
      closable={false}
      data-testid="edit-glossary-modal"
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
      okText={t('label.save')}
      open={visible}
      title={dialogTitle}
      width={800}
      onCancel={onCancel}>
      <AddGlossaryTermForm
        isFormInModal
        isLoading
        editMode={editMode}
        formRef={form}
        glossaryName={glossaryName}
        glossaryReviewers={glossaryReviewers}
        glossaryTerm={glossaryTerm}
        onCancel={onCancel}
        onSave={onSave}
      />
    </Modal>
  );
};

export default GlossaryTermModal;
