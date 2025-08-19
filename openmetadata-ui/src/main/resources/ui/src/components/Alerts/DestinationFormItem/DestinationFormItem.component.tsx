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

import { Button, Col, Divider, Form, Row } from 'antd';
import { Tooltip } from '../../common/AntdCompat';;
import { AxiosError } from 'axios';
import { isEmpty, isNil, isUndefined } from 'lodash';
import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FormCardSection from '../../../components/common/FormCardSection/FormCardSection';
import { EXTERNAL_CATEGORY_OPTIONS } from '../../../constants/Alerts.constants';
import {
  CreateEventSubscription,
  SubscriptionCategory,
} from '../../../generated/events/api/createEventSubscription';
import { Destination } from '../../../generated/events/eventSubscription';
import { testAlertDestination } from '../../../rest/alertsAPI';
import {
  getConnectionTimeoutField,
  getFormattedDestinations,
  getReadTimeoutField,
  listLengthValidator,
} from '../../../utils/Alerts/AlertsUtil';
import { showErrorToast } from '../../../utils/ToastUtils';
import './destination-form-item.less';
import { DestinationFormItemProps } from './DestinationFormItem.interface';
import DestinationSelectItem from './DestinationSelectItem/DestinationSelectItem';

function DestinationFormItem({ isViewMode = false }: DestinationFormItemProps) {
  const { t } = useTranslation();
  const form = Form.useFormInstance();
  const [destinationsWithStatus, setDestinationsWithStatus] =
    useState<Destination[]>();
  const [isDestinationStatusLoading, setIsDestinationStatusLoading] =
    useState<boolean>(false);

  const [selectedSource] =
    Form.useWatch<CreateEventSubscription['resources']>(['resources'], form) ??
    [];
  const destinations =
    Form.useWatch<CreateEventSubscription['destinations']>(
      ['destinations'],
      form
    ) ?? [];

  const handleTestDestinationClick = async () => {
    try {
      setIsDestinationStatusLoading(true);
      const destinations = form.getFieldValue('destinations');
      const formattedDestinations = getFormattedDestinations(destinations);
      if (!isUndefined(formattedDestinations)) {
        const externalDestinations = formattedDestinations.filter(
          (destination) =>
            destination.category === SubscriptionCategory.External
        );

        const results = await testAlertDestination({
          destinations: externalDestinations,
        });

        setDestinationsWithStatus(results);
      }
    } catch (e) {
      showErrorToast(e as AxiosError);
    } finally {
      setIsDestinationStatusLoading(false);
    }
  };

  const isExternalDestinationSelected = useMemo(
    () =>
      destinations.some((destination) => {
        const externalDestinationTypes = EXTERNAL_CATEGORY_OPTIONS.map(
          (option) => option.value
        );

        return (
          destination.category === SubscriptionCategory.External &&
          externalDestinationTypes.includes(destination.type)
        );
      }),
    [destinations]
  );

  const disableTestDestinationButton = useMemo(
    () =>
      isEmpty(selectedSource) ||
      isNil(selectedSource) ||
      !isExternalDestinationSelected,
    [selectedSource, isExternalDestinationSelected]
  );

  return (
    <FormCardSection
      heading={t('label.destination')}
      subHeading={t('message.alerts-destination-description')}>
      {getConnectionTimeoutField()}
      {getReadTimeoutField()}
      <Form.List
        name={['destinations']}
        rules={[
          {
            validator: listLengthValidator(t('label.destination')),
          },
        ]}>
        {(fields, { add, remove }, { errors }) => {
          return (
            <Row
              className="destination-list"
              data-testid="destination-list"
              gutter={[16, 16]}
              key="destinations">
              {fields.map(({ key, name }, index) => (
                <Fragment key={key}>
                  <DestinationSelectItem
                    destinationsWithStatus={destinationsWithStatus}
                    id={name}
                    isDestinationStatusLoading={isDestinationStatusLoading}
                    isViewMode={isViewMode}
                    remove={remove}
                    selectorKey={key}
                  />
                  {index < fields.length - 1 && (
                    <Col span={24}>
                      <Divider className="m-y-xs p-x-xs" />
                    </Col>
                  )}
                </Fragment>
              ))}

              {!isViewMode && (
                <Col span={24}>
                  <Row gutter={[16, 16]}>
                    <Col>
                      <Button
                        data-testid="add-destination-button"
                        disabled={
                          isEmpty(selectedSource) || isNil(selectedSource)
                        }
                        type="primary"
                        onClick={() => add({})}>
                        {t('label.add-entity', {
                          entity: t('label.destination'),
                        })}
                      </Button>
                    </Col>
                    <Col>
                      <Tooltip
                        placement="right"
                        title={t('message.external-destination-selection')}>
                        <Button
                          data-testid="test-destination-button"
                          disabled={disableTestDestinationButton}
                          onClick={handleTestDestinationClick}>
                          {t('label.test-entity', {
                            entity: t('label.destination-plural'),
                          })}
                        </Button>
                      </Tooltip>
                    </Col>
                  </Row>
                </Col>
              )}

              <Col span={24}>
                <Form.ErrorList errors={errors} />
              </Col>
            </Row>
          );
        }}
      </Form.List>
    </FormCardSection>
  );
}

export default DestinationFormItem;
