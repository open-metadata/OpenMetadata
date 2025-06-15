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
import { CloseOutlined, RedoOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Card, Modal, Space, Typography } from 'antd';
import { kebabCase } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { PageType } from '../../../../generated/system/ui/page';
import { useFqn } from '../../../../hooks/useFqn';
import { useCustomizeStore } from '../../../../pages/CustomizablePage/CustomizeStore';
import { Transi18next } from '../../../../utils/CommonUtils';
import { getPersonaDetailsPath } from '../../../../utils/RouterUtils';

export const CustomizablePageHeader = ({
  onReset,
  onSave,
  personaName,
}: {
  onSave: () => Promise<void>;
  onReset: () => void;
  personaName: string;
}) => {
  const { t } = useTranslation();
  const { fqn: personaFqn } = useFqn();
  const { currentPageType } = useCustomizeStore();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [confirmationModalOpen, setConfirmationModalOpen] = useState(false);

  const [confirmationModalType, setConfirmationModalType] = useState<
    'reset' | 'close'
  >('close');

  const handleCancel = () => {
    // Go back in history
    navigate(-1);
  };

  const { modalTitle, modalDescription } = useMemo(() => {
    if (confirmationModalType === 'reset') {
      return {
        modalTitle: t('label.reset-default-layout'),
        modalDescription: t('message.reset-layout-confirmation'),
      };
    }

    return {
      modalTitle: t('message.are-you-sure-want-to-text', {
        text: t('label.close'),
      }),
      modalDescription: t('message.unsaved-changes-warning'),
    };
  }, [confirmationModalType]);

  const handleOpenResetModal = useCallback(() => {
    setConfirmationModalType('reset');
    setConfirmationModalOpen(true);
  }, []);

  const handleCloseResetModal = useCallback(() => {
    setConfirmationModalOpen(false);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    await onSave();
    setSaving(false);
  }, [onSave]);

  const handleReset = useCallback(async () => {
    confirmationModalType === 'reset' ? onReset() : handleCancel();
    setConfirmationModalOpen(false);
  }, [onReset, confirmationModalType, handleCancel]);

  const i18Values = useMemo(
    () => ({
      persona: personaName,
      entity:
        currentPageType === PageType.LandingPage
          ? t('label.landing-page')
          : t(`label.${kebabCase(currentPageType as string)}`),
    }),
    [personaName]
  );

  const handleClose = useCallback(() => {
    setConfirmationModalType('close');
    setConfirmationModalOpen(true);
  }, []);

  return (
    <Card
      className="customize-page-header"
      data-testid="customize-landing-page-header">
      <div className="d-flex items-center justify-between">
        <div>
          <Typography.Title
            className="m-0"
            data-testid="customize-page-title"
            level={5}>
            {t('label.customize-entity', {
              entity: t(`label.${kebabCase(currentPageType as string)}`),
            })}
          </Typography.Title>
          <Typography.Paragraph className="m-0">
            <Transi18next
              i18nKey="message.customize-entity-landing-page-header-for-persona"
              renderElement={<Link to={getPersonaDetailsPath(personaFqn)} />}
              values={i18Values}
            />
          </Typography.Paragraph>
        </div>
        <Space>
          <Button
            data-testid="cancel-button"
            disabled={saving}
            icon={<CloseOutlined />}
            onClick={handleClose}>
            {t('label.close')}
          </Button>
          <Button
            data-testid="reset-button"
            disabled={saving}
            icon={<RedoOutlined />}
            onClick={handleOpenResetModal}>
            {t('label.reset')}
          </Button>
          <Button
            data-testid="save-button"
            icon={<SaveOutlined />}
            loading={saving}
            type="primary"
            onClick={handleSave}>
            {t('label.save')}
          </Button>
        </Space>
      </div>

      {confirmationModalOpen && (
        <Modal
          centered
          cancelText={t('label.no')}
          data-testid="reset-layout-modal"
          okText={t('label.yes')}
          open={confirmationModalOpen}
          title={modalTitle}
          onCancel={handleCloseResetModal}
          onOk={handleReset}>
          {modalDescription}
        </Modal>
      )}
    </Card>
  );
};
