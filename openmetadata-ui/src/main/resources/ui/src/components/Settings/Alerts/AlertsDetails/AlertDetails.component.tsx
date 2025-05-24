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

import { Button, Card, Col, Divider, Row, Space, Typography } from 'antd';
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
import {
  EDIT_LINK_PATH,
  getDisplayNameForEntities,
  getFunctionDisplayName,
} from '../../../../utils/Alerts/AlertsUtil';
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
    <Row align="middle" gutter={[16, 16]}>
      <Col span={24}>
        <div className="d-flex items-center justify-between">
          {breadcrumb ? <TitleBreadcrumb titleLinks={breadcrumb} /> : null}

          {pageHeaderData ? <PageHeader data={pageHeaderData} /> : null}
          <Space size={16}>
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
          </Space>
        </div>
      </Col>
      <Col span={24}>
        <Card>
          <Space direction="vertical" size={8}>
            <Typography.Title className="m-0" level={5}>
              {t('label.trigger')}
            </Typography.Title>
            <Typography.Text data-testid="display-name-entities">
              {alerts?.filteringRules?.resources
                ?.map(getDisplayNameForEntities)
                ?.join(', ')}
            </Typography.Text>
          </Space>
          <Divider />
          <Typography.Title level={5}>
            {t('label.filter-plural')}
          </Typography.Title>
          <Typography.Paragraph>
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
                  <Typography.Text code>
                    {`${conditionName} ${effect} ${conditions}`}
                  </Typography.Text>
                  <br />
                </Fragment>
              );
            })}
          </Typography.Paragraph>
          <Divider />
          <Typography.Title level={5}>
            {t('label.destination')}
          </Typography.Title>
          <Row gutter={[16, 16]} />
        </Card>
      </Col>
    </Row>
  );
};
