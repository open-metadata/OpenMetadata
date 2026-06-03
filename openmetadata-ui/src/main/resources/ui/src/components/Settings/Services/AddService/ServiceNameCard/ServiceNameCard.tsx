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

import { Plus } from '@untitledui/icons';
import classNames from 'classnames';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DesignTextControl } from '../../../../common/Form/JSONSchema/JSONSchemaFields/DesignControls/DesignControls';

interface ServiceNameCardProps {
  serviceType: string;
  name: string;
  description: string;
  nameError?: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onFocus?: (fieldName: string) => void;
}

const ServiceNameCard = ({
  serviceType,
  name,
  description,
  nameError,
  onNameChange,
  onDescriptionChange,
  onFocus,
}: ServiceNameCardProps) => {
  const { t } = useTranslation();
  const [showDescription, setShowDescription] = useState(
    () => description.length > 0
  );

  return (
    <div
      className="tw:rounded-xl tw:border tw:border-secondary tw:bg-primary tw:p-4 tw:shadow-xs"
      data-testid="service-name-card">
      <div className="tw:text-[15px] tw:font-semibold tw:leading-5 tw:text-primary">
        {t('label.name-this-service')}
      </div>
      <div className="tw:mt-0.5 tw:text-xs tw:leading-[18px] tw:text-tertiary">
        {t('message.name-this-service-description', { serviceType })}
      </div>
      <div className="tw:my-3 tw:h-px tw:bg-[var(--tw-color-border-secondary)]" />

      <DesignTextControl
        required
        error={nameError}
        hint={t('message.service-name-rule')}
        id="service-name"
        label={t('label.service-name')}
        testId="service-name"
        value={name}
        onChange={onNameChange}
        onFocus={() => onFocus?.('serviceName')}
      />

      {showDescription ? (
        <div className="tw:mt-4">
          <label
            className="tw:mb-1.5 tw:block tw:font-medium tw:leading-[17px] tw:text-secondary"
            htmlFor="service-description">
            {t('label.description')}
          </label>
          <textarea
            className={classNames(
              'tw:min-h-[88px] tw:w-full tw:rounded-lg tw:border tw:border-primary tw:bg-primary',
              'tw:p-3 tw:text-primary tw:shadow-xs tw:outline-none',
              'tw:placeholder:text-placeholder focus:tw:border-brand focus:tw:ring-4 focus:tw:ring-brand'
            )}
            data-testid="service-description"
            id="service-description"
            placeholder={t('message.add-a-description-for-the-service')}
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            onFocus={() => onFocus?.('serviceDescription')}
          />
        </div>
      ) : (
        <button
          className="tw:mt-3 tw:flex tw:cursor-pointer tw:items-center tw:gap-1.5 tw:font-semibold tw:text-brand-secondary"
          data-testid="add-description-button"
          tabIndex={-1}
          type="button"
          onClick={() => {
            onFocus?.('serviceDescription');
            setShowDescription(true);
          }}>
          <Plus size={15} />
          {t('label.add-a-description')}
          <span className="tw:text-tertiary">({t('label.optional')})</span>
        </button>
      )}
    </div>
  );
};

export default ServiceNameCard;
