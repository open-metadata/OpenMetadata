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

import { Col, Divider, Row, Tag, Tooltip, Typography } from 'antd';
import { isEmpty, isNil, startCase } from 'lodash';
import React, { Fragment, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArgumentsInput,
  SubscriptionType,
} from '../../../../generated/events/eventSubscription';
import searchClassBase from '../../../../utils/SearchClassBase';
import FormCardSection from '../../../common/FormCardSection/FormCardSection';
import { AlertConfigDetailsProps } from './AlertConfigDetails.interface';

function AlertConfigDetails({ alertDetails }: AlertConfigDetailsProps) {
  const { t } = useTranslation();

  const { resource, filters, actions, destinations } = useMemo(
    () => ({
      resource: alertDetails?.filteringRules?.resources[0],
      filters: alertDetails?.input?.filters,
      actions: alertDetails?.input?.actions,
      destinations: alertDetails?.destinations,
    }),
    [alertDetails]
  );

  const getFilterDetails = (isFilter: boolean, filters?: ArgumentsInput[]) => (
    <div className="p-md">
      {filters?.map((filterDetails, index) => (
        <Fragment key={filterDetails.name}>
          <Row data-testid={`filter-${filterDetails.name}`} gutter={[0, 8]}>
            <Col className="font-medium" span={3}>
              {t('label.effect')}
            </Col>
            <Col span={1}>:</Col>
            <Col data-testid="effect-value" span={20}>
              {startCase(filterDetails.effect)}
            </Col>
            <Col className="font-medium" span={3}>
              {t('label.entity-name', {
                entity: isFilter ? t('label.filter') : t('label.action'),
              })}
            </Col>
            <Col span={1}>:</Col>
            <Col data-testid="filter-name" span={20}>
              {startCase(filterDetails.name)}
            </Col>
            {!isEmpty(filterDetails.arguments) && (
              <>
                <Col className="font-medium" span={3}>
                  {t('label.argument-plural')}
                </Col>
                <Col span={1}>:</Col>
                <Col
                  className="border rounded-4 p-sm"
                  data-testid="arguments-container"
                  span={20}>
                  {filterDetails.arguments?.map((argument) => (
                    <Row
                      data-testid={`argument-container-${argument.name}`}
                      gutter={[0, 8]}
                      key={argument.name}>
                      <Col className="font-medium" span={24}>
                        <Typography.Text data-testid="argument-name">
                          {argument.name}
                        </Typography.Text>
                      </Col>
                      <Col span={24}>
                        {argument.input?.map((inputItem) => (
                          <Tooltip key={inputItem} title={inputItem}>
                            <Tag
                              className="m-b-xs w-max-full"
                              data-testid="argument-value">
                              <Typography.Text ellipsis>
                                {inputItem}
                              </Typography.Text>
                            </Tag>
                          </Tooltip>
                        ))}
                      </Col>
                    </Row>
                  ))}
                </Col>
              </>
            )}
          </Row>
          {index < filters.length - 1 && <Divider className="m-y-sm" />}
        </Fragment>
      ))}
    </div>
  );

  const destinationDetails = useMemo(
    () => (
      <div className="p-md">
        <Row gutter={[0, 8]}>
          <Col className="font-medium" span={3}>
            {`${t('label.connection-timeout')} (${t('label.second-plural')})`}
          </Col>
          <Col span={1}>:</Col>
          <Col data-testid="connection-timeout" span={20}>
            {destinations?.[0].timeout}
          </Col>
        </Row>
        <Divider className="m-y-sm" />
        {destinations?.map((destination, index) => (
          <Fragment key={`${destination.category}-${destination.type}`}>
            <Row
              data-testid={`destination-${destination.category}`}
              gutter={[0, 8]}>
              <Col className="font-medium" span={3}>
                {t('label.category')}
              </Col>
              <Col span={1}>:</Col>
              <Col data-testid="category-value" span={20}>
                {startCase(destination.category)}
              </Col>
              <Col className="font-medium" span={3}>
                {t('label.type')}
              </Col>
              <Col span={1}>:</Col>
              <Col data-testid="destination-type" span={20}>
                {startCase(destination.type)}
              </Col>
              {destination.type === SubscriptionType.Webhook &&
                destination.config?.secretKey && (
                  <>
                    <Col className="font-medium" span={3}>
                      {t('label.secret-key')}
                    </Col>
                    <Col span={1}>:</Col>
                    <Col data-testid="secret-key" span={20}>
                      {destination.config.secretKey}
                    </Col>
                  </>
                )}
              {!isEmpty(destination.config?.receivers) &&
                !isNil(destination.config?.receivers) && (
                  <>
                    <Col className="font-medium" span={3}>
                      {t('label.config')}
                    </Col>
                    <Col span={1}>:</Col>
                    <Col className="border rounded-4 p-sm" span={20}>
                      <Row gutter={[0, 8]}>
                        {destination.config?.receivers && (
                          <>
                            <Col className="font-medium" span={24}>
                              <Typography.Text>
                                {t('label.receiver-plural')}
                              </Typography.Text>
                            </Col>
                            <Col data-testid="receivers-value" span={24}>
                              {destination.config?.receivers?.map(
                                (receiver) => (
                                  <Tooltip key={receiver} title={receiver}>
                                    <Tag
                                      className="m-b-xs w-max-full"
                                      data-testid={`receiver-${receiver}`}>
                                      <Typography.Text ellipsis>
                                        {receiver}
                                      </Typography.Text>
                                    </Tag>
                                  </Tooltip>
                                )
                              )}
                            </Col>
                          </>
                        )}
                      </Row>
                    </Col>
                  </>
                )}
            </Row>
            {index < destinations.length - 1 && <Divider className="m-y-sm" />}
          </Fragment>
        ))}
      </div>
    ),
    [destinations]
  );

  const resourceIcon = useMemo(
    () => searchClassBase.getEntityIcon(resource ?? ''),
    [resource]
  );

  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <FormCardSection
          childrenContainerClassName="bg-white p-y-xs p-x-sm border rounded-4"
          heading={t('label.source')}
          subHeading={t('message.alerts-source-description')}>
          <div className="d-flex items-center gap-2 m-l-sm">
            {resourceIcon && (
              <div className="d-flex h-4 w-4">{resourceIcon}</div>
            )}
            <span data-testid="resource-name">{startCase(resource)}</span>
          </div>
        </FormCardSection>
      </Col>
      {!isEmpty(filters) && !isNil(filters) && (
        <Col span={24}>
          <FormCardSection
            childrenContainerClassName="bg-white p-y-xs p-x-sm border rounded-4"
            heading={t('label.filter-plural')}
            subHeading={t('message.alerts-filter-description')}>
            {getFilterDetails(true, filters)}
          </FormCardSection>
        </Col>
      )}
      {!isEmpty(actions) && !isNil(actions) && (
        <Col span={24}>
          <FormCardSection
            childrenContainerClassName="bg-white p-y-xs p-x-sm border rounded-4"
            heading={t('label.trigger')}
            subHeading={t('message.alerts-trigger-description')}>
            {getFilterDetails(false, actions)}
          </FormCardSection>
        </Col>
      )}
      <Col span={24}>
        <FormCardSection
          childrenContainerClassName="bg-white p-y-xs p-x-sm border rounded-4"
          heading={t('label.destination')}
          subHeading={t('message.alerts-destination-description')}>
          {destinationDetails}
        </FormCardSection>
      </Col>
    </Row>
  );
}

export default AlertConfigDetails;
