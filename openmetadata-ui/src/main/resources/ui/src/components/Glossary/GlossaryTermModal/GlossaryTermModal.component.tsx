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
import { AxiosError } from 'axios';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { getGlossaryTermByFQN } from '../../../rest/glossaryAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import Loader from '../../common/Loader/Loader';
import AddGlossaryTermForm from '../AddGlossaryTermForm/AddGlossaryTermForm.component';
import { GlossaryTermForm } from '../AddGlossaryTermForm/AddGlossaryTermForm.interface';

interface Props {
  glossaryTermFQN?: string;
  onSave: (value: GlossaryTermForm) => void | Promise<void>;
  onCancel: () => void;
  visible: boolean;
  editMode: boolean;
}

const GlossaryTermModal: FC<Props> = ({
  editMode,
  visible,
  glossaryTermFQN,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [form] = useForm();
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [glossaryTerm, setGlossaryTerm] = useState<GlossaryTerm>();

  const dialogTitle = useMemo(() => {
    return editMode
      ? t('label.edit-entity', { entity: t('label.glossary-term') })
      : t('label.add-entity', { entity: t('label.glossary-term') });
  }, [editMode]);

  const fetchCurrentEntity = useCallback(async () => {
    try {
      const data = await getGlossaryTermByFQN(glossaryTermFQN, {
        fields: 'tags,reviewers,relatedTerms,owner',
      });
      setGlossaryTerm(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, [glossaryTermFQN]);

  const handleSave = async (values: GlossaryTermForm) => {
    setSaving(true);
    try {
      await onSave(values);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (editMode) {
      fetchCurrentEntity();
    } else {
      setIsLoading(false);
    }
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
          loading={saving}
          type="primary"
          onClick={form.submit}>
          {t('label.save')}
        </Button>,
      ]}
      maskClosable={false}
      okText={t('label.save')}
      open={visible}
      title={dialogTitle}
      width={800}
      onCancel={onCancel}>
      {isLoading ? (
        <Loader />
      ) : (
        <AddGlossaryTermForm
          editMode={editMode}
          formRef={form}
          glossaryTerm={glossaryTerm}
          onCancel={onCancel}
          onSave={handleSave}
        />
      )}
    </Modal>
  );
};

export default GlossaryTermModal;
