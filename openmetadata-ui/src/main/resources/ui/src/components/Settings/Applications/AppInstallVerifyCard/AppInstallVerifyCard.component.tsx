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
import {
  CheckCircleTwoTone,
  ClockCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Box, Divider, Typography } from '@openmetadata/ui-core-components';
import { Avatar, Button, Card, Collapse } from 'antd';
import { useTranslation } from 'react-i18next';
import { LIGHT_GREEN_COLOR } from '../../../../constants/constants';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { getRelativeTime } from '../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { Transi18next } from '../../../../utils/i18next/LocalUtil';
import BrandImage from '../../../common/BrandImage/BrandImage';
import UserPopOverCard from '../../../common/PopOverCard/UserPopOverCard';
import AppLogo from '../AppLogo/AppLogo.component';
import './app-install-verify-card.less';
import { AppInstallVerifyCardProps } from './AppInstallVerifyCard.interface';

const AppInstallVerifyCard = ({
  appData,
  nextButtonLabel,
  onCancel,
  onSave,
}: AppInstallVerifyCardProps) => {
  const { t } = useTranslation();
  const { currentUser, theme } = useApplicationStore();

  return (
    <div className="flex-center flex-col">
      <Box
        inline
        align="center"
        className="layout-space layout-space-horizontal p-t-lg"
        gap={2}
        itemClassName="layout-space-item">
        <AppLogo appName={appData?.fullyQualifiedName ?? ''} />
        <Divider
          dashed
          className="tw:w-44 tw:gap-0 app-card-divider"
          label={<CheckCircleTwoTone twoToneColor={LIGHT_GREEN_COLOR} />}
        />
        <Avatar
          className="app-marketplace-avatar flex-center bg-white border"
          icon={
            <BrandImage
              isMonoGram
              className="vertical-middle"
              dataTestId="image"
              height={56}
              width={56}
            />
          }
          size={100}
        />
      </Box>
      <Typography as="h5" className="m-t-md" size="text-md" weight="semibold">
        {t('label.authorize-app', {
          app: getEntityName(appData),
        })}
      </Typography>
      <Card className="w-500 m-t-md">
        <Box
          inline
          align="center"
          className="layout-space layout-space-horizontal"
          gap={3}
          itemClassName="layout-space-item">
          <UserPopOverCard
            profileWidth={32}
            userName={currentUser?.name ?? ''}
          />
          <div className="d-flex flex-col">
            <Typography className="font-medium">
              <Transi18next
                i18nKey="label.application-by-developer"
                renderElement={
                  <a
                    aria-label={t('label.application')}
                    href={appData?.developerUrl}
                    rel="noreferrer"
                    style={{ color: theme.primaryColor }}
                    target="_blank"
                  />
                }
                values={{
                  dev: appData?.developer,
                  app: getEntityName(appData),
                }}
              />
            </Typography>
            <Typography className="text-xs" color="secondary">
              {t('label.wants-to-access-your-account', {
                username: currentUser?.displayName ?? currentUser?.name,
              })}
            </Typography>
          </div>
        </Box>

        <Collapse ghost className="w-full m-t-md" expandIconPosition="end">
          <Collapse.Panel
            header={` ${t('label.all-entity', {
              entity: t('label.metadata'),
            })}`}
            key="1"
          />
        </Collapse>

        <Divider className="tw:my-6" />
        <div className="d-flex justify-end gap-2">
          <Button block data-testid="cancel" onClick={onCancel}>
            {t('label.cancel')}
          </Button>
          <Button
            block
            data-testid="save-button"
            key="save-btn"
            type="primary"
            onClick={onSave}>
            {nextButtonLabel}
          </Button>
        </div>
      </Card>
      <Card className="w-500 m-t-md">
        <div className="d-flex items-center justify-between">
          <Box
            inline
            align="center"
            className="layout-space layout-space-horizontal"
            gap={2}
            itemClassName="layout-space-item">
            <UserOutlined />
            <Typography className="text-xs" color="secondary">
              {t('label.developed-by-developer', {
                developer: appData?.developer,
              })}
            </Typography>
          </Box>
          <Box
            inline
            align="center"
            className="layout-space layout-space-horizontal"
            gap={2}
            itemClassName="layout-space-item">
            <ClockCircleOutlined />
            <Typography className="text-xs" color="secondary">
              {`${t('label.updated')} ${getRelativeTime(appData?.updatedAt)}`}
            </Typography>
          </Box>
        </div>
      </Card>
    </div>
  );
};

export default AppInstallVerifyCard;
