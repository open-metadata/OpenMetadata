/*
 *  Copyright 2022 Collate.
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
  Divider,
  Grid,
  Typography,
} from '@openmetadata/ui-core-components';
import { Button, Card } from 'antd';
import { isArray } from 'lodash';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as IconEdit } from '../../../../assets/svg/edit-new.svg';
import { ReactComponent as IconDelete } from '../../../../assets/svg/ic-delete.svg';
import {
  Effect,
  EventSubscription,
} from '../../../../generated/events/eventSubscription';
import { EDIT_LINK_PATH } from '../../../../utils/Alerts/AlertsUtil';
import {
  getDisplayNameForEntities,
  getFunctionDisplayName,
} from '../../../../utils/Alerts/AlertsUtilPure';
import { getLayoutGutter } from '../../../../utils/common/layout.utils';
import TitleBreadcrumb from '../../../common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../../common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageHeader from '../../../PageHeader/PageHeader.component';
import { HeaderProps } from '../../../PageHeader/PageHeader.interface';

interface AlertDetailsComponentProps {
  alerts: EventSubscription;
  onDelete: () => void;
  pageHeaderData?: HeaderProps['data'];
  breadcrumb?: TitleBreadcrumbProps['titleLinks'];
  allowDelete?: boolean;
  allowEdit?: boolean;
}

export const AlertDetailsComponent = ({
  alerts,
  onDelete,
  pageHeaderData,
  allowDelete = true,
  breadcrumb,
  allowEdit = true,
}: AlertDetailsComponentProps) => {
  const { t } = useTranslation();

  return (
    <Grid
      className="layout-row layout-grid tw:items-center"
      style={{ ...getLayoutGutter(16, 16) }}>
      <Grid.Item className="layout-column" span={24}>
        <div className="d-flex items-center justify-between">
          {breadcrumb ? <TitleBreadcrumb titleLinks={breadcrumb} /> : null}

          {pageHeaderData ? <PageHeader data={pageHeaderData} /> : null}
          <Box
            inline
            align="center"
            className="layout-space layout-space-horizontal"
            gap={4}
            itemClassName="layout-space-item">
            {allowEdit && (
              <Link to={`${EDIT_LINK_PATH}/${alerts?.id}`}>
                <Button
                  className="flex flex-center"
                  icon={<IconEdit height={12} />}>
                  {t('label.edit')}
                </Button>
              </Link>
            )}
            {allowDelete && (
              <Button
                className="flex flex-center"
                icon={<IconDelete height={12} />}
                onClick={onDelete}>
                {t('label.delete')}
              </Button>
            )}
          </Box>
        </div>
      </Grid.Item>
      <Grid.Item className="layout-column" span={24}>
        <Card>
          <Box
            inline
            align="stretch"
            className="layout-space"
            direction="col"
            gap={2}
            itemClassName="layout-space-item">
            <Typography
              as="h5"
              className="m-0"
              size="text-md"
              weight="semibold">
              {t('label.trigger')}
            </Typography>
            <Typography data-testid="display-name-entities">
              {alerts?.filteringRules?.resources
                ?.map(getDisplayNameForEntities)
                ?.join(', ')}
            </Typography>
          </Box>
          <Divider className="tw:my-6" />
          <Typography as="h5" size="text-md" weight="semibold">
            {t('label.filter-plural')}
          </Typography>
          <Typography as="p">
            {alerts?.filteringRules?.rules?.map((filter) => {
              const conditions = isArray(filter.condition)
                ? filter.condition.join(', ')
                : filter.condition;
              const effect = filter.effect === Effect.Include ? '===' : '!==';
              const conditionName = getFunctionDisplayName(
                filter.fullyQualifiedName ?? ''
              );

              return (
                <Fragment key={filter.name}>
                  <Typography>
                    <code>{`${conditionName} ${effect} ${conditions}`}</code>
                  </Typography>
                  <br />
                </Fragment>
              );
            })}
          </Typography>
          <Divider className="tw:my-6" />
          <Typography as="h5" size="text-md" weight="semibold">
            {t('label.destination')}
          </Typography>
          <Box
            className="layout-row"
            style={{ ...getLayoutGutter(16, 16) }}
            wrap="wrap"
          />
        </Card>
      </Grid.Item>
    </Grid>
  );
};
