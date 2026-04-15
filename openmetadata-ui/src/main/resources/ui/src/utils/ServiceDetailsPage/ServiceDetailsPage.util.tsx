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
import { CommonWidgets } from '../../components/DataAssets/CommonWidgets/CommonWidgets';
import { useGenericContext } from '../../components/Customization/GenericProvider/GenericProvider';
import ServiceEntityTable from '../../components/Service/ServiceEntityTable/ServiceEntityTable';
import { DetailPageWidgetKeys } from '../../enums/CustomizeDetailPage.enum';
import { EntityType } from '../../enums/entity.enum';
import { ServicesType } from '../../interface/service.interface';
import { WidgetConfig } from '../../pages/CustomizablePage/CustomizablePage.interface';

const ServiceCommonWidgets = ({
  widgetConfig,
}: {
  widgetConfig: WidgetConfig;
}) => {
  const { type } = useGenericContext<ServicesType>();

  return (
    <CommonWidgets
      entityType={type as EntityType}
      widgetConfig={widgetConfig}
    />
  );
};

export const getServiceWidgetsFromKey = (widgetConfig: WidgetConfig) => {
  if (widgetConfig.i.startsWith(DetailPageWidgetKeys.SERVICE_ENTITY_TABLE)) {
    return <ServiceEntityTable />;
  }

  return <ServiceCommonWidgets widgetConfig={widgetConfig} />;
};
