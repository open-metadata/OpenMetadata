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
import {
  CloseOutlined,
  PlusOutlined,
  RedoOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { Button, Card, Space, Typography } from 'antd';
import { kebabCase } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { PersonaCustomizePageFqn } from '../../../../constants/Customize.constants';
import { PageType } from '../../../../generated/system/ui/page';
import { useFqn } from '../../../../hooks/useFqn';
import { useCustomizeStore } from '../../../../pages/CustomizablePage/CustomizeStore';
import { Transi18next } from '../../../../utils/i18next/LocalUtil';
import { getPersonaDetailsPath } from '../../../../utils/RouterUtils';
import { useRequiredParams } from '../../../../utils/useRequiredParams';
import { UnsavedChangesModal } from '../../../Modals/UnsavedChangesModal/UnsavedChangesModal.component';
import './customizable-page-header.less';

export const CustomizablePageHeader = ({
  disableSave,
  onAddWidget,
  onReset,
  onSave,
  personaName,
}: {
  disableSave?: boolean;
  onAddWidget?: () => void;
  onReset: () => void;
  onSave: () => Promise<void>;
  personaName: string;
}) => {
  const { t } = useTranslation();
  const { fqn: personaFqn } = useFqn();
  const { pageFqn } = useRequiredParams<{ pageFqn: string }>();
  const { currentPageType } = useCustomizeStore();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);

  const showWidgetActions =
    currentPageType === PageType.LandingPage ||
    currentPageType === PageType.DataMarketplace;

  const isLandingPage =
    currentPageType === PageType.LandingPage ||
    currentPageType === PersonaCustomizePageFqn.Homepage;
  const isNavigationPage = pageFqn === PersonaCustomizePageFqn.Navigation;
  const isAppModePage = pageFqn === PersonaCustomizePageFqn.AppMode;

  // The cancel (×) button just triggers back-navigation. The parent page's
  // NavigationBlocker (enabled while there are unsaved changes) intercepts
  // this and renders the single unsaved-changes confirmation modal, so this
  // component no longer needs to render its own "close" modal.
  const handleClose = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const handleOpenResetModal = useCallback(() => {
    setResetModalOpen(true);
  }, []);

  const handleCloseResetModal = useCallback(() => {
    setResetModalOpen(false);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    await onSave();
    setSaving(false);
  }, [onSave]);

  const handleResetConfirm = useCallback(() => {
    onReset();
    setResetModalOpen(false);
  }, [onReset]);

  const i18Values = useMemo(
    () => ({
      persona: personaName,
      entity: isLandingPage
        ? t('label.home-page')
        : t(`label.${kebabCase(currentPageType as string)}`),
    }),
    [personaName, isLandingPage]
  );

  const subTitle = useMemo(() => {
    if (isNavigationPage) {
      return 'message.customize-your-navigation-subheader';
    } else if (isAppModePage) {
      return 'message.customize-your-app-mode-subheader';
    } else if (isLandingPage) {
      return 'message.customize-home-page-page-header-for-persona';
    }

    return 'message.customize-entity-landing-page-header-for-persona';
  }, [isNavigationPage, isAppModePage, isLandingPage]);

  return (
    <Card
      className="customize-page-header m-b-lg"
      data-testid="customize-landing-page-header">
      <div className="d-flex items-center justify-between">
        <div>
          <Typography.Title
            className="m-0"
            data-testid="customize-page-title"
            level={5}>
            {t('label.customize-entity', {
              entity: isLandingPage
                ? t('label.home-page')
                : t(`label.${kebabCase(currentPageType as string)}`),
            })}
          </Typography.Title>
          <Typography.Paragraph className="m-0">
            <Transi18next
              i18nKey={subTitle}
              renderElement={<Link to={getPersonaDetailsPath(personaFqn)} />}
              values={i18Values}
            />
          </Typography.Paragraph>
        </div>
        <Space>
          {showWidgetActions && (
            <Button
              data-testid="add-widget-button"
              icon={<PlusOutlined />}
              type="primary"
              onClick={onAddWidget}>
              {t('label.add-widget-plural')}
            </Button>
          )}
          <Button
            data-testid="reset-button"
            disabled={saving}
            icon={<RedoOutlined />}
            onClick={handleOpenResetModal}>
            {t('label.reset')}
          </Button>
          <Button
            data-testid="save-button"
            disabled={disableSave}
            icon={<SaveOutlined />}
            loading={saving}
            type="primary"
            onClick={handleSave}>
            {t('label.save')}
          </Button>
          <Button
            className="landing-page-cancel-button"
            data-testid="cancel-button"
            disabled={saving}
            icon={<CloseOutlined />}
            onClick={handleClose}
          />
        </Space>
      </div>

      <UnsavedChangesModal
        description={t('message.reset-layout-confirmation')}
        discardText={t('label.cancel')}
        loading={saving}
        open={resetModalOpen}
        saveText={t('label.reset')}
        title={t('label.reset-default-layout')}
        onCancel={handleCloseResetModal}
        onDiscard={handleCloseResetModal}
        onSave={handleResetConfirm}
      />
    </Card>
  );
};
