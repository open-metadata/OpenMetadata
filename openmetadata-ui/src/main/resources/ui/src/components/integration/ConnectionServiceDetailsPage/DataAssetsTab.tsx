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
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
} from '@openmetadata/ui-core-components';
import { Dispatch, SetStateAction, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../enums/entity.enum';
import { ServiceCategory } from '../../../enums/service.enum';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { EntityReference } from '../../../generated/entity/type';
import { Paging } from '../../../generated/type/paging';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
import { UsePagingInterface } from '../../../hooks/paging/usePaging';
import { ServicePageData } from '../../../interface/platform/service.interface';
import { ServicesType } from '../../../interface/service.interface';
import ServiceMainTabContent from '../../../pages/ServiceDetailsPage/ServiceMainTabContent';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import { getEntityTypeFromServiceCategory } from '../../../utils/ServicePureUtils';
import DataProductsSection from '../../common/DataProductsSection/DataProductsSection';
import Description from '../../common/EntityDescription/Description';
import GlossaryTermsSection from '../../common/GlossaryTermsSection/GlossaryTermsSection';
import TagsSectionV1 from '../../common/TagsSection/TagsSection';
import './data-assets-tab.less';

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
  /** DataProductsSection saves the service itself; this keeps the caller's copy in step. */
  onDataProductsChange: (dataProducts: EntityReference[]) => void;
}

const DataAssetsTab = ({
  serviceCategory,
  servicePermission,
  serviceDetails,
  onDescriptionUpdate,
  saveUpdatedServiceData,
  onDataProductUpdate,
  onDataProductsChange,
  ...rest
}: DataAssetsTabProps) => {
  const { t } = useTranslation();

  const entityType = useMemo(
    () => getEntityTypeFromServiceCategory(serviceCategory),
    [serviceCategory]
  );

  const allTags = useMemo(
    () => serviceDetails?.tags ?? [],
    [serviceDetails?.tags]
  );
  // ServicesType doesn't declare the governance fields, though the service is fetched with them.
  const { domains, dataProducts } = serviceDetails as unknown as {
    domains?: EntityReference[];
    dataProducts?: EntityReference[];
  };

  const {
    canEditAll: editDataProductsPermission,
    canEditTags: editTagsPermission,
    canEditGlossaryTerms: editGlossaryTermsPermission,
    canEditDescription: editDescriptionPermission,
  } = useMemo(
    () => getDerivedPermissionFlags(servicePermission, serviceDetails.deleted),
    [servicePermission, serviceDetails.deleted]
  );

  const handleTagsUpdate = useCallback(
    async (updatedTags: TagLabel[]): Promise<TagLabel[] | undefined> => {
      const glossaryTags = allTags.filter(
        (t) => t.source === TagSource.Glossary
      );
      const tierTags = allTags.filter((t) => t.tagFQN?.startsWith('Tier.'));
      const merged = [...tierTags, ...glossaryTags, ...updatedTags];
      await saveUpdatedServiceData({ ...serviceDetails, tags: merged });

      return merged;
    },
    [allTags, saveUpdatedServiceData, serviceDetails]
  );

  const handleGlossaryTermsUpdate = useCallback(
    async (updatedTags: TagLabel[]): Promise<TagLabel[] | undefined> => {
      const nonGlossaryTags = allTags.filter(
        (t) => t.source !== TagSource.Glossary
      );
      const merged = [...nonGlossaryTags, ...updatedTags];
      await saveUpdatedServiceData({ ...serviceDetails, tags: merged });

      return merged;
    },
    [allTags, saveUpdatedServiceData, serviceDetails]
  );

  return (
    <div className="data-assets-tab tw:flex tw:flex-col tw:gap-4">
      <Accordion>
        <AccordionItem id="metadata-details">
          <AccordionHeader>{t('label.metadata-detail-plural')}</AccordionHeader>
          <AccordionPanel className="tw:!overflow-visible tw:!text-inherit">
            <div className="tw:flex tw:flex-col tw:gap-4">
              <Description
                description={serviceDetails.description}
                entityName={serviceDetails.name ?? ''}
                entityType={entityType}
                hasEditAccess={editDescriptionPermission}
                showActions={!serviceDetails.deleted}
                showCommentsIcon={false}
                onDescriptionUpdate={onDescriptionUpdate}
              />
              {/* Classic shows these in the right panel, which this tab hides; metadata services
                  carry no data products there either. */}
              {entityType !== EntityType.METADATA_SERVICE && (
                <div data-testid="service-data-products">
                  <DataProductsSection
                    activeDomains={domains}
                    dataProducts={dataProducts}
                    entityId={serviceDetails.id}
                    entityType={entityType}
                    hasPermission={editDataProductsPermission}
                    // The section keeps what it shows in its own state; remount it when the
                    // service's data products change underneath it, as the summary panel does.
                    key={`data-products-${serviceDetails.id}-${
                      dataProducts?.length ?? 0
                    }`}
                    onDataProductsUpdate={onDataProductsChange}
                  />
                </div>
              )}
              <div className="glossary-terms-section">
                <GlossaryTermsSection
                  entityId={serviceDetails.id}
                  entityType={entityType}
                  hasPermission={editGlossaryTermsPermission}
                  tags={allTags}
                  onGlossaryTermsUpdate={handleGlossaryTermsUpdate}
                />
              </div>
              <TagsSectionV1
                entityId={serviceDetails.id}
                entityType={entityType}
                hasPermission={editTagsPermission}
                tags={allTags}
                onTagsUpdate={handleTagsUpdate}
              />
            </div>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>

      <div className="data-assets-table-wrapper">
        <ServiceMainTabContent
          {...rest}
          saveUpdatedServiceData={saveUpdatedServiceData}
          serviceDetails={serviceDetails}
          serviceName={serviceDetails.name ?? ''}
          servicePermission={servicePermission}
          onDataProductUpdate={onDataProductUpdate}
          onDescriptionUpdate={onDescriptionUpdate}
        />
      </div>
    </div>
  );
};

export default DataAssetsTab;
