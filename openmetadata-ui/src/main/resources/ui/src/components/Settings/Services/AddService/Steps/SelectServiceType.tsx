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
  Badge,
  Box,
  Card,
  Input,
  Select,
  SelectItem,
  Typography,
  type SelectItemType,
} from '@openmetadata/ui-core-components';
import { SearchLg } from '@untitledui/icons';
import classNames from 'classnames';
import { isEmpty, startCase } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import type { Key } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import {
  ALL_SERVICES_CATEGORY,
  BETA_SERVICES,
  excludedService,
  SERVICE_CATEGORY_OPTIONS,
  SERVICE_TYPE_WITH_DISPLAY_NAME,
} from '../../../../../constants/Services.constant';
import { ServiceCategoryParam } from '../../../../../constants/ServiceType.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../../enums/common.enum';
import { ServiceCategory } from '../../../../../enums/service.enum';
import { DatabaseServiceType } from '../../../../../generated/entity/data/database';
import { MetadataServiceType } from '../../../../../generated/entity/services/metadataService';
import { MlModelServiceType } from '../../../../../generated/entity/services/mlmodelService';
import { PipelineServiceType } from '../../../../../generated/entity/services/pipelineService';
import { errorMsg } from '../../../../../utils/EntityDisplayPureUtils';
import { getServiceLogo } from '../../../../../utils/EntityDisplayUtils';
import ServiceUtilClassBase from '../../../../../utils/ServiceUtilClassBase';
import ErrorPlaceHolder from '../../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { SelectServiceTypeProps } from './Steps.interface';

const SelectServiceType = ({
  serviceCategory,
  showError,
  serviceCategoryHandler,
  handleServiceTypeClick,
}: SelectServiceTypeProps) => {
  const { t } = useTranslation();
  const [category, setCategory] = useState('');
  const [connectorSearchTerm, setConnectorSearchTerm] = useState('');
  const serviceTypes = ServiceUtilClassBase.getSupportedServiceFromList();

  // "All Services" leads the list so a category-agnostic entry point has something truthful to
  // show as selected instead of silently defaulting to the first category.
  const categorySelectItems: SelectItemType[] = useMemo(
    () => [
      { id: ALL_SERVICES_CATEGORY, label: t('label.all-services') },
      ...SERVICE_CATEGORY_OPTIONS.map(({ label, value }) => ({
        id: value,
        label,
      })),
    ],
    [t]
  );

  useEffect(() => {
    const allCategory = Object.values(ServiceCategory);
    // The `all` sentinel is a legitimate selection, not an unrecognized category — only genuinely
    // unknown values fall back to the first category.
    const isKnownCategory =
      serviceCategory === ALL_SERVICES_CATEGORY ||
      allCategory.includes(serviceCategory as ServiceCategory);
    setCategory(isKnownCategory ? serviceCategory : allCategory[0]);
    setConnectorSearchTerm('');
  }, [serviceCategory]);

  // Each connector is paired with the category it came from, so clicking a card in the flattened
  // grid can tell the page which category's wizard to continue in.
  const categoryConnectors = useMemo(() => {
    const categories =
      category === ALL_SERVICES_CATEGORY
        ? Object.values(ServiceCategory)
        : ([category] as ServiceCategory[]);

    return categories.flatMap((serviceCategoryKey) =>
      (serviceTypes[serviceCategoryKey] ?? [])
        .filter(
          (connectorType) =>
            !excludedService.includes(
              connectorType as MlModelServiceType | MetadataServiceType
            )
        )
        .map((connectorType) => ({
          category: serviceCategoryKey,
          type: connectorType,
        }))
    );
  }, [category, serviceTypes]);

  const filteredConnectors = useMemo(() => {
    const searchTerm = connectorSearchTerm.trim().toLowerCase();

    return searchTerm
      ? categoryConnectors.filter(({ type }) =>
          type.toLowerCase().includes(searchTerm)
        )
      : categoryConnectors;
  }, [categoryConnectors, connectorSearchTerm]);

  const getServiceName = (type: string) => {
    if (type.includes('Custom')) {
      return startCase(type);
    }

    return SERVICE_TYPE_WITH_DISPLAY_NAME.get(type) || type;
  };

  return (
    <div>
      <div>
        <Select
          className="tw:w-full"
          data-testid="service-category"
          id="serviceCategory"
          items={categorySelectItems}
          selectedKey={category}
          size="md"
          onSelectionChange={(key: Key | null) => {
            if (key === null) {
              return;
            }
            setConnectorSearchTerm('');
            // Includes the `all` sentinel — the handler's parameter is widened to match.
            serviceCategoryHandler(key as ServiceCategoryParam);
          }}>
          {(item) => <SelectItem id={item.id} label={item.label} />}
        </Select>
      </div>

      <div className="tw:mt-[14px]">
        <Input
          icon={SearchLg}
          placeholder={t('label.search-for-a-connector')}
          size="md"
          value={connectorSearchTerm}
          onChange={setConnectorSearchTerm}
        />

        {isEmpty(filteredConnectors) && (
          <div className="flex-center">
            <ErrorPlaceHolder
              className="border-none"
              type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
              <Typography>
                {t('message.no-connectors-available-for-service')}
              </Typography>
            </ErrorPlaceHolder>
          </div>
        )}

        <div
          className="tw:mt-4 tw:grid tw:grid-cols-5 tw:gap-3"
          data-testid="select-service">
          {filteredConnectors.map(({ category: connectorCategory, type }) => (
            <Card
              isClickable
              className={classNames(
                'tw:h-[100px] tw:w-full tw:flex-col tw:px-2.5 tw:py-4',
                'tw:hover:bg-utility-brand-50 tw:hover:border-utility-brand-300'
              )}
              data-testid={type}
              // Composite key: connector types are unique across categories today, but the grid
              // spans every category in the `all` view so the category has to be part of the key.
              key={`${connectorCategory}-${type}`}
              size="sm"
              onClick={() => handleServiceTypeClick(type, connectorCategory)}>
              <div className="tw:flex tw:flex-col tw:items-center tw:justify-center tw:gap-3 tw:w-full">
                <div
                  className="tw:flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:border tw:border-secondary tw:bg-secondary"
                  data-testid="service-icon">
                  <div className="tw:flex tw:size-6 tw:items-center tw:justify-center">
                    {getServiceLogo(type || '', 'tw:size-6 tw:object-contain')}
                  </div>
                </div>
                <Box align="center" gap={2} justify="center">
                  <Typography size="text-xs" weight="semibold">
                    {getServiceName(type)}
                  </Typography>
                  {BETA_SERVICES.includes(
                    type as DatabaseServiceType | PipelineServiceType
                  ) ? (
                    <Badge color="brand" size="xs" type="pill-color">
                      {t('label.beta')}
                    </Badge>
                  ) : null}
                </Box>
              </div>
            </Card>
          ))}
        </div>

        {showError &&
          errorMsg(
            t('message.field-text-is-required', {
              fieldText: t('label.service'),
            })
          )}
      </div>
    </div>
  );
};

export default SelectServiceType;
