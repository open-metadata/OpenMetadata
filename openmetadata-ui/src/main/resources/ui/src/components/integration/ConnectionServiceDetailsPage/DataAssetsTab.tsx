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

import { Dispatch, SetStateAction, useMemo } from 'react';
import { CustomizeEntityType } from '../../../constants/Customize.constants';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { DetailPageWidgetKeys } from '../../../enums/CustomizeDetailPage.enum';
import { ServiceCategory } from '../../../enums/service.enum';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { Paging } from '../../../generated/type/paging';
import { UsePagingInterface } from '../../../hooks/paging/usePaging';
import type { WidgetConfig } from '../../../interface/customization.interface';
import { ServicePageData } from '../../../interface/platform/service.interface';
import { ServicesType } from '../../../interface/service.interface';
import ServiceMainTabContent from '../../../pages/ServiceDetailsPage/ServiceMainTabContent';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import { getEntityTypeFromServiceCategory } from '../../../utils/ServicePureUtils';
import Description from '../../common/EntityDescription/Description';
import { GenericProvider } from '../../Customization/GenericProvider/GenericProvider';
import { CommonWidgets } from '../../DataAssets/CommonWidgets/CommonWidgets';
import './data-assets-tab.less';

const RIGHT_PANEL_WIDGETS = [
  DetailPageWidgetKeys.DATA_PRODUCTS,
  DetailPageWidgetKeys.TAGS,
  DetailPageWidgetKeys.GLOSSARY_TERMS,
].map((i) => ({ i } as WidgetConfig));

interface DataAssetsTabProps {
  serviceCategory: ServiceCategory;
  servicePermission: OperationPermission;
  serviceDetails: ServicesType;
  onDescriptionUpdate: (updatedHTML: string) => Promise<void>;
  showDeleted: boolean;
  onShowDeletedChange: (value: boolean) => void;
  data: ServicePageData[];
  isServiceLoading: boolean;
  paging: Paging;
  currentPage: number;
  setFilters: (val: { [key: string]: string | undefined }) => void;
  saveUpdatedServiceData: (updatedData: ServicesType) => Promise<void>;
  pagingInfo: UsePagingInterface;
  setIsServiceLoading: Dispatch<SetStateAction<boolean>>;
  onDataProductUpdate: (dataProducts: DataProduct[]) => Promise<void>;
}

const DataAssetsTab = ({
  serviceCategory,
  servicePermission,
  serviceDetails,
  onDescriptionUpdate,
  saveUpdatedServiceData,
  onDataProductUpdate,
  ...rest
}: DataAssetsTabProps) => {
  const entityType = useMemo(
    () => getEntityTypeFromServiceCategory(serviceCategory),
    [serviceCategory]
  );

  const { canEditDescription } = useMemo(
    () => getDerivedPermissionFlags(servicePermission, serviceDetails.deleted),
    [servicePermission, serviceDetails.deleted]
  );

  return (
    <div className="data-assets-tab tw:flex tw:items-start tw:gap-4">
      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-4">
        <Description
          wrapInCard
          description={serviceDetails.description}
          entityName={serviceDetails.name ?? ''}
          entityType={entityType}
          hasEditAccess={canEditDescription}
          showActions={!serviceDetails.deleted}
          showCommentsIcon={false}
          onDescriptionUpdate={onDescriptionUpdate}
        />
        <div className="data-assets-table-wrapper">
          <ServiceMainTabContent
            {...rest}
            hideRightPanel
            saveUpdatedServiceData={saveUpdatedServiceData}
            serviceDetails={serviceDetails}
            serviceName={serviceDetails.name ?? ''}
            servicePermission={servicePermission}
            wrapInCard={false}
            onDataProductUpdate={onDataProductUpdate}
            onDescriptionUpdate={onDescriptionUpdate}
          />
        </div>
      </div>
      {/* The same widget cards as an entity page's right panel, saving through the service. */}
      <GenericProvider
        data={serviceDetails}
        permissions={servicePermission}
        type={entityType as CustomizeEntityType}
        onUpdate={saveUpdatedServiceData}>
        <div
          className="tw:flex tw:w-80 tw:shrink-0 tw:flex-col tw:gap-4"
          data-testid="service-right-panel">
          {RIGHT_PANEL_WIDGETS.map((widgetConfig) => (
            <CommonWidgets
              entityType={entityType}
              key={widgetConfig.i}
              showTaskHandler={false}
              widgetConfig={widgetConfig}
            />
          ))}
        </div>
      </GenericProvider>
    </div>
  );
};

export default DataAssetsTab;
