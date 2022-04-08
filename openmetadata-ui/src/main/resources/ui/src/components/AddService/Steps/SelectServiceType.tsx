import classNames from 'classnames';
import React, { useEffect, useState } from 'react';
import { serviceTypes } from '../../../constants/services.const';
import { ServiceCategory } from '../../../enums/service.enum';
import { errorMsg, getServiceLogo } from '../../../utils/CommonUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { Button } from '../../buttons/Button/Button';
import { Field } from '../../Field/Field';

type SelectServiceTypeProps = {
  showError: boolean;
  serviceCategory: ServiceCategory;
  serviceCategoryHandler: (category: ServiceCategory) => void;
  selectServiceType: string;
  handleServiceTypeClick: (type: string) => void;
  onCancel: () => void;
  onNext: () => void;
};

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
              {option}
            </option>
          ))}
        </select>
      </Field>

      <Field className="tw-mt-7">
        <div
          className="tw-flex tw-flex-wrap tw-gap-5 tw-mt-4"
          data-testid="selectService">
          {serviceTypes[serviceCategory].map((type) => (
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
          <span>Discard</span>
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
