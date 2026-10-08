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
  Box,
  Breadcrumbs,
  Button,
  ButtonUtility,
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Minimize01,
  Plus,
  RefreshCcw01,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import { kebabCase } from 'lodash';
import { useCallback, useMemo, useState, type Key } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { PersonaCustomizePageFqn } from '../../../../constants/Customize.constants';
import { PageType } from '../../../../generated/system/ui/page';
import { useCustomizeStore } from '../../../../pages/CustomizablePage/CustomizeStore';
import { useFqn } from '../../../../hooks/useFqn';
import { Transi18next } from '../../../../utils/i18next/LocalUtil';
import { getPersonaDetailsPath } from '../../../../utils/RouterUtils';
import { useRequiredParams } from '../../../../utils/useRequiredParams';
import { UnsavedChangesModal } from '../../../Modals/UnsavedChangesModal/UnsavedChangesModal.component';
import './customizable-page-header.less';
import {
  CUSTOMIZE_CHROME_BACK_ID,
  useCustomizePageChrome,
} from './CustomizePageChrome.context';

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
  const chrome = useCustomizePageChrome();
  const [saving, setSaving] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  // Crumb id the user tried to leave to while there were unsaved changes.
  const [pendingExit, setPendingExit] = useState<string>();

  const showWidgetActions =
    currentPageType === PageType.LandingPage ||
    currentPageType === PageType.DataMarketplace;

  const isLandingPage =
    currentPageType === PageType.LandingPage ||
    (currentPageType as string) === PersonaCustomizePageFqn.Homepage;
  const isNavigationPage = pageFqn === PersonaCustomizePageFqn.Navigation;
  const isAppLayoutPage = pageFqn === PersonaCustomizePageFqn.AppLayout;

  // Persona settings leave via a hash change, which NavigationBlocker lets
  // through, so the unsaved-changes prompt has to be raised here instead.
  const requestExit = useCallback(
    (id: string) => {
      if (!chrome) {
        navigate(getPersonaDetailsPath(personaFqn));

        return;
      }
      if (disableSave) {
        chrome.onNavigate(id);
      } else {
        setPendingExit(id);
      }
    },
    [chrome, disableSave, navigate, personaFqn]
  );

  const handleClose = useCallback(
    () => requestExit(CUSTOMIZE_CHROME_BACK_ID),
    [requestExit]
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    await onSave();
    setSaving(false);
  }, [onSave]);

  const handleResetConfirm = useCallback(() => {
    onReset();
    setResetModalOpen(false);
  }, [onReset]);

  const handleDiscardExit = useCallback(() => {
    if (pendingExit) {
      chrome?.onNavigate(pendingExit);
    }
    setPendingExit(undefined);
  }, [chrome, pendingExit]);

  const handleSaveAndExit = useCallback(async () => {
    try {
      await handleSave();
      handleDiscardExit();
    } catch {
      // onSave already surfaced the error; stay on the page.
      setSaving(false);
      setPendingExit(undefined);
    }
  }, [handleSave, handleDiscardExit]);

  const pageEntityLabel = isLandingPage
    ? t('label.home-page')
    : t(`label.${kebabCase(currentPageType as string)}`);

  const i18Values = useMemo(
    () => ({ persona: personaName, entity: pageEntityLabel }),
    [personaName, pageEntityLabel]
  );

  const subTitle = useMemo(() => {
    if (isNavigationPage) {
      return 'message.customize-your-navigation-subheader';
    } else if (isAppLayoutPage) {
      return 'message.customize-your-app-layout-subheader';
    } else if (isLandingPage) {
      return 'message.customize-home-page-page-header-for-persona';
    }

    return 'message.customize-entity-landing-page-header-for-persona';
  }, [isNavigationPage, isAppLayoutPage, isLandingPage]);

  const personaLink = chrome ? (
    <Button
      className="tw:inline"
      color="link-color"
      data-testid="customize-persona-link"
      onPress={handleClose}
    />
  ) : (
    <Link to={getPersonaDetailsPath(personaFqn)} />
  );

  return (
    <>
      {/* Breadcrumbs and card form one block so parent layouts (flex gap vs
          none) can't space them differently across customize pages. */}
      <Box direction="col" gap={3}>
        {chrome && (
          <Box
            align="center"
            data-testid="customize-page-breadcrumbs"
            direction="row"
            justify="between">
            <Breadcrumbs
              divider="chevron"
              items={chrome.breadcrumbs}
              size="xs"
              type="text"
              onAction={(id: Key) => requestExit(String(id))}
            />
            <ButtonUtility
              aria-label={t('label.close')}
              color="tertiary"
              data-testid="customize-minimize-button"
              icon={Minimize01}
              size="sm"
              onPress={handleClose}
            />
          </Box>
        )}
        <Card
          className="customize-page-header m-b-lg tw:p-6"
          data-testid="customize-landing-page-header">
          <Box align="center" direction="row" justify="between">
            <Box direction="col" gap={1}>
              <Typography
                as="h5"
                className="tw:m-0 tw:text-primary"
                data-testid="customize-page-title"
                size="text-md"
                weight="semibold">
                {t('label.customize-entity', { entity: pageEntityLabel })}
              </Typography>
              <Typography as="p" className="tw:m-0 tw:text-tertiary">
                <Transi18next
                  i18nKey={subTitle}
                  renderElement={personaLink}
                  values={i18Values}
                />
              </Typography>
            </Box>
            <Box align="center" direction="row" gap={2}>
              {showWidgetActions && onAddWidget && (
                <Button
                  color="primary"
                  data-testid="add-widget-button"
                  iconLeading={<Plus />}
                  onPress={onAddWidget}>
                  {t('label.add-widget-plural')}
                </Button>
              )}
              <Button
                color="secondary"
                data-testid="reset-button"
                iconLeading={<RefreshCcw01 />}
                isDisabled={saving}
                onPress={() => setResetModalOpen(true)}>
                {t('label.reset')}
              </Button>
              <Button
                color="primary"
                data-testid="save-button"
                isDisabled={disableSave}
                isLoading={saving}
                onPress={handleSave}>
                {t('label.save')}
              </Button>
              <ButtonUtility
                aria-label={t('label.cancel')}
                color="tertiary"
                data-testid="cancel-button"
                icon={XClose}
                isDisabled={saving}
                onPress={handleClose}
              />
            </Box>
          </Box>
        </Card>
      </Box>

      <UnsavedChangesModal
        description={t('message.reset-layout-confirmation')}
        discardText={t('label.cancel')}
        loading={saving}
        open={resetModalOpen}
        saveText={t('label.reset')}
        title={t('label.reset-default-layout')}
        onCancel={() => setResetModalOpen(false)}
        onDiscard={() => setResetModalOpen(false)}
        onSave={handleResetConfirm}
      />
      <UnsavedChangesModal
        loading={saving}
        open={Boolean(pendingExit)}
        onCancel={() => setPendingExit(undefined)}
        onDiscard={handleDiscardExit}
        onSave={handleSaveAndExit}
      />
    </>
  );
};
