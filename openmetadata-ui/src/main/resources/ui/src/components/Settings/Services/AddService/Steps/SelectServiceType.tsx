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
  BETA_SERVICES,
  excludedService,
  SERVICE_CATEGORY_OPTIONS,
  SERVICE_TYPE_WITH_DISPLAY_NAME,
} from '../../../../../constants/Services.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../../enums/common.enum';
import { ServiceCategory } from '../../../../../enums/service.enum';
import { DatabaseServiceType } from '../../../../../generated/entity/data/database';
import { MetadataServiceType } from '../../../../../generated/entity/services/metadataService';
import { MlModelServiceType } from '../../../../../generated/entity/services/mlmodelService';
import { PipelineServiceType } from '../../../../../generated/entity/services/pipelineService';
import {
  errorMsg,
  getServiceLogo,
} from '../../../../../utils/EntityDisplayUtils';
import ServiceUtilClassBase from '../../../../../utils/ServiceUtilClassBase';
import ErrorPlaceHolder from '../../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { SelectServiceTypeProps } from './Steps.interface';

const categorySelectItems: SelectItemType[] = SERVICE_CATEGORY_OPTIONS.map(
  ({ label, value }) => ({ id: value, label })
);

const SelectServiceType = ({
  serviceCategory,
  selectServiceType,
  showError,
  serviceCategoryHandler,
  handleServiceTypeClick,
}: SelectServiceTypeProps) => {
  const { t } = useTranslation();
  const [category, setCategory] = useState('');
  const [connectorSearchTerm, setConnectorSearchTerm] = useState('');
  const [selectedConnectors, setSelectedConnectors] = useState<string[]>([]);
  const serviceTypes = ServiceUtilClassBase.getSupportedServiceFromList();

  const handleConnectorSearchTerm = (value: string) => {
    setConnectorSearchTerm(value);
    setSelectedConnectors(
      serviceTypes[serviceCategory].filter((c) =>
        c.toLowerCase().includes(value.toLowerCase())
      )
    );
  };

  useEffect(() => {
    const allCategory = Object.values(ServiceCategory);
    const selectedCategory = allCategory.includes(serviceCategory)
      ? serviceCategory
      : allCategory[0];
    setCategory(selectedCategory);
    setSelectedConnectors(
      serviceTypes[selectedCategory].filter(
        (service) => !excludedService.find((e) => e === service)
      )
    );
  }, [serviceCategory]);

  const filteredConnectors = useMemo(
    () =>
      selectedConnectors.filter(
        (connectorType) =>
          !excludedService.includes(
            connectorType as MlModelServiceType | MetadataServiceType
          )
      ),
    [selectedConnectors]
  );

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
            serviceCategoryHandler(key as ServiceCategory);
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
          onChange={(value: string) => handleConnectorSearchTerm(value)}
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
          {filteredConnectors.map((type) => (
            <button
              className={classNames(
                'tw:relative tw:flex tw:h-[100px] tw:w-full tw:cursor-pointer tw:flex-col tw:items-center tw:justify-center',
                'tw:gap-3 tw:rounded-lg tw:border tw:bg-primary tw:px-2.5 tw:py-4',
                'tw:shadow-xs tw:transition-[border-color,background-color,box-shadow] tw:duration-[120ms]',
                'tw:whitespace-normal hover:tw:bg-utility-brand-50 hover:tw:border-utility-brand-300',
                type === selectServiceType
                  ? 'tw:border-2 tw:border-utility-brand-300'
                  : 'tw:border tw:border-secondary'
              )}
              data-testid={type}
              key={type}
              type="button"
              onClick={() => handleServiceTypeClick(type)}>
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
            </button>
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
