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

import classNames from 'classnames';
import { t } from 'i18next';
import { startCase } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import {
  excludedService,
  serviceTypes,
} from '../../../constants/Services.constant';
import { ServiceCategory } from '../../../enums/service.enum';
import { MetadataServiceType } from '../../../generated/entity/services/metadataService';
import { MlModelServiceType } from '../../../generated/entity/services/mlmodelService';
import { errorMsg, getServiceLogo } from '../../../utils/CommonUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { Button } from '../../buttons/Button/Button';
import Searchbar from '../../common/searchbar/Searchbar';
import { Field } from '../../Field/Field';
import { SelectServiceTypeProps } from './Steps.interface';

const SelectServiceType = ({
  serviceCategory,
  selectServiceType,
  showError,
  serviceCategoryHandler,
  handleServiceTypeClick,
  onCancel,
  onNext,
}: SelectServiceTypeProps) => {
  const [category, setCategory] = useState('');
  const [connectorSearchTerm, setConnectorSearchTerm] = useState('');
  const [selectedConnectors, setSelectedConnectors] = useState<string[]>([]);

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

  return (
    <div>
      <Field>
        <select
          className="tw-form-inputs tw-form-inputs-padding"
          data-testid="service-category"
          id="serviceCategory"
          name="serviceCategory"
          value={category}
          onChange={(e) => {
            setConnectorSearchTerm('');
            serviceCategoryHandler(e.target.value as ServiceCategory);
          }}>
          {Object.values(ServiceCategory).map((option, i) => (
            <option key={i} value={option}>
              {startCase(option)}
            </option>
          ))}
        </select>
      </Field>

      <Field className="tw-mt-7">
        <Field>
          <Searchbar
            removeMargin
            placeholder={`${t('label.search-for-type', {
              type: t('label.connector'),
            })}...`}
            searchValue={connectorSearchTerm}
            typingInterval={500}
            onSearch={handleConnectorSearchTerm}
          />
        </Field>
        <div className="tw-flex">
          <div
            className="tw-grid tw-grid-cols-6 tw-grid-flow-row tw-gap-4 tw-mt-4"
            data-testid="select-service">
            {filteredConnectors.map((type) => (
              <div
                className={classNames(
                  'tw-flex tw-flex-col tw-items-center tw-relative tw-p-2 tw-w-24 tw-cursor-pointer tw-border tw-rounded-md',
                  {
                    'tw-border-primary': type === selectServiceType,
                  }
                )}
                data-testid={type}
                key={type}
                onClick={() => handleServiceTypeClick(type)}>
                <div className="tw-mb-2.5">
                  <div data-testid="service-icon">
                    {getServiceLogo(type || '', 'tw-h-9')}
                  </div>
                  <div className="tw-absolute tw-top-0 tw-right-1.5">
                    {type === selectServiceType && (
                      <SVGIcons alt="checkbox" icon={Icons.CHECKBOX_PRIMARY} />
                    )}
                  </div>
                </div>
                <p className="break-word text-center">
                  {type.includes('Custom') ? startCase(type) : type}
                </p>
              </div>
            ))}
          </div>
        </div>
        {showError &&
          errorMsg(
            t('message.field-text-is-required', {
              fieldText: t('label.service'),
            })
          )}
      </Field>
      <Field className="tw-flex tw-justify-end tw-mt-10">
        <Button
          className={classNames('tw-mr-2')}
          data-testid="previous-button"
          size="regular"
          theme="primary"
          variant="text"
          onClick={onCancel}>
          <span>{t('label.cancel')}</span>
        </Button>

        <Button
          data-testid="next-button"
          size="regular"
          theme="primary"
          variant="contained"
          onClick={onNext}>
          <span>{t('label.next')}</span>
        </Button>
      </Field>
    </div>
  );
};

export default SelectServiceType;
