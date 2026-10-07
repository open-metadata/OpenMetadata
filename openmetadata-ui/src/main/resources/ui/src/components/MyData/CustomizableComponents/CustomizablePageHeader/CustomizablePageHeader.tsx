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
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Plus,
  RefreshCcw01,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import { kebabCase } from 'lodash';
import { type Key, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PersonaCustomizePageFqn } from '../../../../constants/Customize.constants';
import { PageType } from '../../../../generated/system/ui/page';
import { useFqn } from '../../../../hooks/useFqn';
import { useCustomizeStore } from '../../../../pages/CustomizablePage/CustomizeStore';
import { Transi18next } from '../../../../utils/i18next/LocalUtil';
import { getPersonaDetailsPath } from '../../../../utils/RouterUtils';
import { useRequiredParams } from '../../../../utils/useRequiredParams';
import { UnsavedChangesModal } from '../../../Modals/UnsavedChangesModal/UnsavedChangesModal.component';

export const CustomizablePageHeader = ({
  disableSave,
  onAddWidget,
  onClose: onCloseOverride,
  onReset,
  onSave,
  personaName,
}: {
  disableSave?: boolean;
  onAddWidget?: () => void;
  onClose?: () => void;
  onReset: () => void;
  onSave: () => Promise<void>;
  personaName: string;
}) => {
  const { t } = useTranslation();
  const { fqn: personaFqn } = useFqn();
  const { pageFqn } = useRequiredParams<{ pageFqn: string }>();
  const { currentPageType } = useCustomizeStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [saving, setSaving] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);

  const showWidgetActions =
    currentPageType === PageType.LandingPage ||
    currentPageType === PageType.DataMarketplace;

  const isLandingPage =
    currentPageType === PageType.LandingPage ||
    (currentPageType as string) === PersonaCustomizePageFqn.Homepage;
  const isNavigationPage = pageFqn === PersonaCustomizePageFqn.Navigation;
  const isAppLayoutPage = pageFqn === PersonaCustomizePageFqn.AppLayout;

  const handleClose = useCallback(() => {
    if (onCloseOverride) {
      onCloseOverride();

      return;
    }
    if (
      (location.state as { fromPersonasModal?: boolean } | null)
        ?.fromPersonasModal
    ) {
      navigate(-1);
    } else {
      navigate(getPersonaDetailsPath(personaFqn));
    }
  }, [onCloseOverride, navigate, personaFqn, location.state]);

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
    [personaName, isLandingPage, currentPageType, t]
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

  const pageTypeLabel = useMemo(() => {
    if (isLandingPage) {
      return t('label.home-page');
    } else if (isNavigationPage) {
      return t('label.navigation');
    } else if (isAppLayoutPage) {
      return t('label.app-layout');
    }

    return t(`label.${kebabCase(currentPageType as string)}`);
  }, [isLandingPage, isNavigationPage, isAppLayoutPage, currentPageType, t]);

  const breadcrumbItems = useMemo(
    () => [
      { id: 'persona', label: personaName },
      { id: 'current', label: pageTypeLabel },
    ],
    [personaName, pageTypeLabel]
  );

  const handleBreadcrumbAction = useCallback(
    (id: Key) => {
      if (String(id) === 'persona') {
        navigate(getPersonaDetailsPath(personaFqn));
      }
    },
    [navigate, personaFqn]
  );

  return (
    <>
      <div className="tw:px-6 tw:pt-3 tw:pb-1">
        <Breadcrumbs
          divider="chevron"
          items={breadcrumbItems}
          size="xs"
          type="text"
          onAction={handleBreadcrumbAction}
        />
      </div>
      <Box
        align="center"
        className="tw:border-b tw:border-secondary tw:bg-primary tw:px-6 tw:py-4 tw:mb-6"
        data-testid="customize-landing-page-header"
        direction="row"
        justify="between">
        <Box direction="col" gap={1}>
          <Typography
            as="h5"
            className="tw:m-0 tw:text-primary"
            data-testid="customize-page-title"
            size="text-md"
            weight="semibold">
            {t('label.customize-entity', {
              entity: isLandingPage
                ? t('label.home-page')
                : t(`label.${kebabCase(currentPageType as string)}`),
            })}
          </Typography>
          <Typography as="p" className="tw:m-0 tw:text-tertiary" size="text-sm">
            <Transi18next
              i18nKey={subTitle}
              renderElement={<Link to={getPersonaDetailsPath(personaFqn)} />}
              values={i18Values}
            />
          </Typography>
        </Box>
        <Box align="center" direction="row" gap={2}>
          {showWidgetActions && onAddWidget && (
            <Button
              color="secondary"
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
    </>
  );
};
