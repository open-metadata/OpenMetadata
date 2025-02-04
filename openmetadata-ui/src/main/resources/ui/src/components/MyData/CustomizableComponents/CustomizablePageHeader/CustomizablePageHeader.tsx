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
import { Button, Col, Modal, Space, Typography } from 'antd';
import { startCase } from 'lodash';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory } from 'react-router-dom';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
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
  const history = useHistory();
  const [isResetModalOpen, setIsResetModalOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const { theme } = useApplicationStore();

  const handleCancel = () => {
    history.push(getPersonaDetailsPath(personaFqn));
  };

  const handleOpenResetModal = useCallback(() => {
    setIsResetModalOpen(true);
  }, []);

  const handleCloseResetModal = useCallback(() => {
    setIsResetModalOpen(false);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    await onSave();
    setSaving(false);
  }, [onSave]);

  const handleReset = useCallback(async () => {
    onReset();
    setIsResetModalOpen(false);
  }, [onReset]);
  const i18Values = useMemo(
    () => ({
      persona: personaName,
      pageName: startCase(currentPageType as string) ?? t('label.landing-page'),
    }),
    [personaName]
  );

  return (
    <Col
      className="bg-white d-flex justify-between border-bottom p-sm"
      data-testid="customize-landing-page-header"
      span={24}>
      <div className="d-flex gap-2 items-center">
        <Typography.Title
          className="m-0"
          data-testid="customize-page-title"
          level={5}>
          <Transi18next
            i18nKey="message.customize-landing-page-header"
            renderElement={
              <Link
                style={{ color: theme.primaryColor, fontSize: '16px' }}
                to={getPersonaDetailsPath(personaFqn)}
              />
            }
            values={i18Values}
          />
        </Typography.Title>
      </div>
      <Space>
        <Button
          data-testid="cancel-button"
          disabled={saving}
          size="small"
          onClick={handleCancel}>
          {t('label.cancel')}
        </Button>
        <Button
          data-testid="reset-button"
          disabled={saving}
          size="small"
          onClick={handleOpenResetModal}>
          {t('label.reset')}
        </Button>
        <Button
          data-testid="save-button"
          loading={saving}
          size="small"
          type="primary"
          onClick={handleSave}>
          {t('label.save')}
        </Button>
      </Space>
      {isResetModalOpen && (
        <Modal
          centered
          cancelText={t('label.no')}
          data-testid="reset-layout-modal"
          okText={t('label.yes')}
          open={isResetModalOpen}
          title={t('label.reset-default-layout')}
          onCancel={handleCloseResetModal}
          onOk={handleReset}>
          {t('message.reset-layout-confirmation')}
        </Modal>
      )}
    </Col>
  );
};
