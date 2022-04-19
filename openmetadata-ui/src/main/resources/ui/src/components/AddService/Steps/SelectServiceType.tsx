/*
 *  Copyright 2021 Collate
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
import { startCase } from 'lodash';
import React, { useEffect, useState } from 'react';
import { serviceTypes } from '../../../constants/services.const';
import { ServiceCategory } from '../../../enums/service.enum';
import { errorMsg, getServiceLogo } from '../../../utils/CommonUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { Button } from '../../buttons/Button/Button';
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

  useEffect(() => {
    const allCategory = Object.values(ServiceCategory);
    setCategory(
      allCategory.includes(serviceCategory) ? serviceCategory : allCategory[0]
    );
  }, [serviceCategory]);

  return (
    <div>
      <Field>
        <select
          className="tw-form-inputs tw-px-3 tw-py-1"
          data-testid="service-category"
          id="serviceCategory"
          name="serviceCategory"
          value={category}
          onChange={(e) =>
            serviceCategoryHandler(e.target.value as ServiceCategory)
          }>
          {Object.values(ServiceCategory).map((option, i) => (
            <option key={i} value={option}>
              {startCase(option)}
            </option>
          ))}
        </select>
      </Field>

      <Field className="tw-mt-7">
        <div className="tw-flex tw-justify-center">
          <div
            className="tw-grid tw-grid-cols-5 tw-grid-flow-row tw-gap-5 tw-mt-4"
            data-testid="select-service">
            {serviceTypes[serviceCategory]?.map((type) => (
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
                  <div className="tw-w-9" data-testid="service-icon">
                    {getServiceLogo(type || '', 'tw-h-9 tw-w-9')}
                  </div>
                  <div className="tw-absolute tw-top-0 tw-right-1.5">
                    {type === selectServiceType && (
                      <SVGIcons alt="checkbox" icon={Icons.CHECKBOX_PRIMARY} />
                    )}
                  </div>
                </div>
                <p className="">{type}</p>
              </div>
            ))}
          </div>
        </div>
        {showError && errorMsg('Service is required')}
      </Field>
      <Field className="tw-flex tw-justify-end tw-mt-10">
        <Button
          className={classNames('tw-mr-2')}
          data-testid="previous-button"
          size="regular"
          theme="primary"
          variant="text"
          onClick={onCancel}>
          <span>Back</span>
        </Button>

        <Button
          data-testid="next-button"
          size="regular"
          theme="primary"
          variant="contained"
          onClick={onNext}>
          <span>Next</span>
        </Button>
      </Field>
    </div>
  );
};

export default SelectServiceType;
