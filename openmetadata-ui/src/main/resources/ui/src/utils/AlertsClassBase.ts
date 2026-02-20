/*
 *  Copyright 2025 Collate.
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
import { FormInstance } from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isUndefined, omitBy, trim } from 'lodash';
import { DEFAULT_READ_TIMEOUT } from '../constants/Alerts.constants';
import { OperationPermission } from '../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../enums/entity.enum';
import { NotificationTemplate } from '../generated/entity/events/notificationTemplate';
import { User } from '../generated/entity/teams/user';
import { CreateEventSubscription } from '../generated/events/api/createEventSubscription';
import {
  EventSubscription,
  SubscriptionCategory,
} from '../generated/events/eventSubscription';
import {
  ModifiedCreateEventSubscription,
  ModifiedEventSubscription,
} from '../pages/AddObservabilityPage/AddObservabilityPage.interface';
import {
  getConfigHeaderArrayFromObject,
  getConfigHeaderObjectFromArray,
  getConfigQueryParamsArrayFromObject,
  getConfigQueryParamsObjectFromArray,
  getRandomizedAlertName,
} from './Alerts/AlertsUtil';
import { HandleAlertSaveProps } from './AlertsClassBase.interface';
import { getEntityName } from './EntityUtils';
import { handleEntityCreationError } from './formUtils';
import { t } from './i18next/LocalUtil';
import { showSuccessToast } from './ToastUtils';

export interface AddAlertFormWidgetProps {
  formRef: FormInstance<ModifiedCreateEventSubscription>;
  alertDetails?: ModifiedEventSubscription;
  templates?: NotificationTemplate[];
  loading?: boolean;
  isViewMode?: boolean;
  templateResourcePermission?: OperationPermission;
}

class AlertsClassBase {
  public getAddAlertFormExtraWidgets() {
    const widgets: Record<
      string,
      React.ComponentType<AddAlertFormWidgetProps>
    > = {};

    return widgets;
  }
  public getAddAlertFormExtraButtons() {
    const buttons: Record<
      string,
      React.ComponentType<AddAlertFormWidgetProps>
    > = {};

    return buttons;
  }

  public formatDestinations(
    data: ModifiedCreateEventSubscription,
    initialData?: EventSubscription
  ) {
    const destinations = data.destinations?.map((d) => {
      const initialDestination =
        d.id && initialData?.destinations?.find((dest) => dest.id === d.id);

      return {
        ...(initialDestination ?? {}),
        type: d.type,
        config: {
          ...d.config,
          headers: getConfigHeaderObjectFromArray(d.config?.headers),
          queryParams: getConfigQueryParamsObjectFromArray(
            d.config?.queryParams
          ),
        },
        category: d.category,
        timeout: data.timeout,
        readTimeout: data.readTimeout,
        notifyDownstream: d.notifyDownstream,
        downstreamDepth: d.downstreamDepth,
      };
    });

    return destinations;
  }

  public getCommonAlertFieldsData(
    data: ModifiedCreateEventSubscription,
    initialData?: EventSubscription
  ) {
    const alertName = trim(initialData?.name ?? getRandomizedAlertName());
    const alertDisplayName = trim(getEntityName(data));
    const destinations = this.formatDestinations(data, initialData);

    return { alertName, alertDisplayName, destinations };
  }

  public getAlertCreationData(
    data: ModifiedCreateEventSubscription,
    initialData?: EventSubscription,
    currentUser?: User
  ): CreateEventSubscription {
    const { alertName, alertDisplayName, destinations } =
      this.getCommonAlertFieldsData(data, initialData);
    // Remove timeout from alert object since it's only for UI

    const { timeout: _timeout, readTimeout: _readTimeout, ...finalData } = data;

    return {
      ...(finalData as CreateEventSubscription),
      destinations,
      name: alertName,
      displayName: alertDisplayName,
      ...(currentUser?.id
        ? {
            owners: [
              {
                id: currentUser.id,
                type: EntityType.USER,
              },
            ],
          }
        : {}),
    };
  }

  public getAlertUpdateData(
    data: ModifiedCreateEventSubscription,
    initialData: EventSubscription
  ) {
    const { alertName, alertDisplayName, destinations } =
      this.getCommonAlertFieldsData(data, initialData);
    const { description, input, owners, resources } = data;

    return {
      ...initialData,
      description,
      displayName: alertDisplayName,
      name: alertName,
      input: {
        actions: input?.actions ?? [],
        filters: input?.filters ?? [],
      },
      owners,
      filteringRules: {
        ...initialData.filteringRules,
        resources: resources ?? [],
      },
      destinations: destinations ?? [],
    };
  }

  public async handleAlertSave({
    data,
    fqn,
    initialData,
    createAlertAPI,
    updateAlertAPI,
    afterSaveAction,
    setInlineAlertDetails,
    currentUser,
  }: HandleAlertSaveProps) {
    try {
      let alertDetails;

      if (fqn && !isUndefined(initialData)) {
        const newAlertData: EventSubscription = this.getAlertUpdateData(
          data,
          initialData
        );

        const jsonPatch = compare(
          omitBy(initialData, isUndefined),
          newAlertData
        );

        alertDetails = await updateAlertAPI(initialData.id, jsonPatch);
      } else {
        const finalData = this.getAlertCreationData(
          data,
          initialData,
          currentUser
        );

        alertDetails = await createAlertAPI(finalData);
      }

      showSuccessToast(
        t(`server.${'create'}-entity-success`, {
          entity: t('label.alert-plural'),
        })
      );
      afterSaveAction(alertDetails.fullyQualifiedName ?? '');
    } catch (error) {
      handleEntityCreationError({
        error: error as AxiosError,
        entity: t('label.alert'),
        entityLowercase: t('label.alert-lowercase'),
        entityLowercasePlural: t('label.alert-lowercase-plural'),
        setInlineAlertDetails,
        name: data.name,
        defaultErrorType: 'create',
      });
    }
  }

  public getModifiedAlertDataForForm(
    alertData: EventSubscription
  ): ModifiedEventSubscription {
    return {
      ...alertData,
      timeout: alertData.destinations[0].timeout ?? 10,
      readTimeout:
        alertData.destinations[0].readTimeout ?? DEFAULT_READ_TIMEOUT,
      destinations: alertData.destinations.map((destination) => {
        const isExternalDestination =
          destination.category === SubscriptionCategory.External;

        return {
          ...destination,
          destinationType: isExternalDestination
            ? destination.type
            : destination.category,
          config: {
            ...destination.config,
            headers: getConfigHeaderArrayFromObject(
              destination.config?.headers
            ),
            queryParams: getConfigQueryParamsArrayFromObject(
              destination.config?.queryParams
            ),
          },
        };
      }),
    };
  }
}

const alertsClassBase = new AlertsClassBase();

export default alertsClassBase;
export { AlertsClassBase };
