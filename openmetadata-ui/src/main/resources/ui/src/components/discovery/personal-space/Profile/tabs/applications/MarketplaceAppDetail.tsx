/*
 *  Copyright 2026 Collate.
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
  Badge,
  BadgeWithIcon,
  Box,
  Button,
  Card,
  EmptyPlaceholder,
  Grid,
  Skeleton,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  CheckVerified01,
  Download01,
  GridView,
  LinkExternal01,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import {
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { TabSpecificField } from '../../../../../../enums/entity.enum';
import { AppMarketPlaceDefinition } from '../../../../../../generated/entity/applications/marketplace/appMarketPlaceDefinition';
import { Include } from '../../../../../../generated/type/include';
import { getApplicationByName } from '../../../../../../rest/applicationAPI';
import { getMarketPlaceApplicationByFqn } from '../../../../../../rest/applicationMarketPlaceAPI';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { Transi18next } from '../../../../../../utils/i18next/LocalUtil';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import RichTextEditorPreviewerV1 from '../../../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import applicationsClassBase from '../../../../../Settings/Applications/AppDetails/ApplicationsClassBase';
import type { ApplicationsViewProps } from './Applications.types';
import { getAppResources, getInstallBlockedReason } from './Applications.utils';

/** A third of the 24-column core grid. */
const THIRD_SPAN = 8;

interface MarketplaceAppDetailProps extends ApplicationsViewProps {
  fqn: string;
}

const Section: FC<{ title: string; children: ReactNode; testId: string }> = ({
  title,
  children,
  testId,
}) => (
  <Box data-testid={testId} direction="col" gap={3}>
    <Typography
      className="tw:text-secondary tw:uppercase"
      size="text-xs"
      weight="semibold">
      {title}
    </Typography>
    {children}
  </Box>
);

const DetailRow: FC<{
  label: string;
  description?: string;
  value: ReactNode;
}> = ({ label, description, value }) => (
  <Box
    align="center"
    className="tw:border-b tw:border-secondary tw:px-6 tw:py-4 tw:last:border-b-0"
    direction="row"
    gap={4}
    justify="between">
    <Box direction="col">
      <Typography className="tw:text-primary" size="text-sm" weight="medium">
        {label}
      </Typography>
      {description && (
        <Typography className="tw:text-tertiary" size="text-sm">
          {description}
        </Typography>
      )}
    </Box>
    <Box align="center" direction="row" gap={2}>
      {value}
    </Box>
  </Box>
);

const MarketplaceAppBody: FC<{
  appData: AppMarketPlaceDefinition;
  blockedReason?: string;
  blockedReasonNode: ReactNode;
}> = ({ appData, blockedReason, blockedReasonNode }) => {
  const { t } = useTranslation();
  const resources = getAppResources(appData);

  return (
    <Box className="tw:px-8 tw:pb-8" direction="col" gap={8}>
      {appData.enabled === false && (
        <Card data-testid="install-blocked-alert" size="sm">
          <Card.Content>
            <Typography className="tw:text-secondary" size="text-sm">
              {blockedReasonNode}
            </Typography>
            {blockedReason === 'message.paid-addon-description' && (
              <Typography className="tw:text-tertiary" size="text-sm">
                {t('message.please-contact-us')}
              </Typography>
            )}
          </Card.Content>
        </Card>
      )}

      <Section testId="app-overview" title={t('label.overview')}>
        <Card size="md">
          <Card.Content>
            <RichTextEditorPreviewerV1
              enableSeeMoreVariant={false}
              markdown={appData.description ?? ''}
            />
          </Card.Content>
        </Card>
      </Section>

      <Section testId="app-details" title={t('label.detail-plural')}>
        <Card size="md">
          <DetailRow
            description={t('message.marketplace-verify-msg')}
            label={t('label.publisher')}
            value={
              <>
                <Typography className="tw:text-primary" size="text-sm">
                  {appData.developer}
                </Typography>
                <Badge color="success" size="sm" type="pill-color">
                  {t('label.verified-status')}
                </Badge>
              </>
            }
          />
        </Card>
      </Section>

      {resources.length > 0 && (
        <Section testId="app-resources" title={t('label.resource-plural')}>
          <Card size="md">
            <Grid gap="0">
              {resources.map((resource) => (
                <Grid.Item
                  className="tw:border-secondary tw:px-6 tw:py-4 tw:not-last:border-r"
                  key={resource.id}
                  span={THIRD_SPAN}>
                  <Button
                    color="link-color"
                    data-testid={resource.id}
                    href={resource.href}
                    iconTrailing={LinkExternal01}
                    rel="noopener noreferrer"
                    target="_blank">
                    {t(resource.labelKey)}
                  </Button>
                </Grid.Item>
              ))}
            </Grid>
          </Card>
        </Section>
      )}
    </Box>
  );
};

const MarketplaceAppDetail: FC<MarketplaceAppDetailProps> = ({
  fqn,
  onNavigate,
  onHeaderChange,
}) => {
  const { t } = useTranslation();
  const [appData, setAppData] = useState<AppMarketPlaceDefinition>();
  const [isInstalled, setIsInstalled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAppDetails = useCallback(async () => {
    setIsLoading(true);
    const [marketplaceApp, installedApp] = await Promise.allSettled([
      getMarketPlaceApplicationByFqn(fqn, { fields: TabSpecificField.OWNERS }),
      getApplicationByName(fqn, {
        fields: TabSpecificField.OWNERS,
        include: Include.All,
      }),
    ]);
    setIsInstalled(installedApp.status === 'fulfilled');

    if (marketplaceApp.status === 'fulfilled') {
      setAppData(marketplaceApp.value);
    } else {
      showErrorToast(marketplaceApp.reason as AxiosError);
    }
    setIsLoading(false);
  }, [fqn]);

  useEffect(() => {
    void fetchAppDetails();
  }, [fetchAppDetails]);

  const blockedReason = appData
    ? getInstallBlockedReason(appData, isInstalled)
    : undefined;

  const blockedReasonNode = useMemo(
    () =>
      blockedReason === 'message.paid-addon-description' ? (
        <Transi18next
          i18nKey="message.paid-addon-description"
          renderElement={
            <Typography as="span" data-testid="appName" weight="semibold" />
          }
          values={{ app: appData?.displayName }}
        />
      ) : (
        blockedReason && t(blockedReason)
      ),
    [appData?.displayName, blockedReason, t]
  );

  useEffect(() => {
    if (!appData) {
      // Not found: keep the trail pointing at the requested app.
      if (!isLoading) {
        onHeaderChange({ crumb: fqn });
      }

      return;
    }

    const installButton = (
      <Button
        color="primary"
        data-testid="install-application"
        iconLeading={Download01}
        isDisabled={Boolean(blockedReason)}
        size="sm"
        onPress={() => onNavigate({ type: 'install', fqn })}>
        {t('label.install')}
      </Button>
    );

    onHeaderChange({
      title: getEntityName(appData),
      description: t('label.developed-by-developer', {
        developer: appData.developer,
      }),
      icon: applicationsClassBase.getAppIcon(appData.name),
      crumb: getEntityName(appData),
      titleSuffix: (
        <BadgeWithIcon
          color="brand"
          data-testid="verified-badge"
          iconLeading={CheckVerified01}
          size="sm"
          type="pill-color">
          {t('label.verified-status')}
        </BadgeWithIcon>
      ),
      actions: blockedReasonNode ? (
        <Tooltip
          excludeTriggerFromTabOrder
          placement="bottom"
          title={blockedReasonNode}>
          <Box inline data-testid="install-blocked-reason">
            {installButton}
          </Box>
        </Tooltip>
      ) : (
        installButton
      ),
    });
  }, [
    appData,
    blockedReason,
    blockedReasonNode,
    fqn,
    isLoading,
    onHeaderChange,
    onNavigate,
    t,
  ]);

  if (isLoading) {
    return (
      <Box className="tw:px-8 tw:pb-8" direction="col" gap={4}>
        <Skeleton height={160} variant="rounded" width="100%" />
        <Skeleton height={200} variant="rounded" width="100%" />
      </Box>
    );
  }

  if (!appData) {
    return (
      <Box className="tw:relative tw:flex-1 tw:min-h-90 tw:mx-8">
        <EmptyPlaceholder
          data-testid="app-not-found"
          description={fqn}
          icon={GridView}
          title={t('label.no-entity', { entity: t('label.application') })}
        />
      </Box>
    );
  }

  return (
    <MarketplaceAppBody
      appData={appData}
      blockedReason={blockedReason}
      blockedReasonNode={blockedReasonNode}
    />
  );
};

export default MarketplaceAppDetail;
