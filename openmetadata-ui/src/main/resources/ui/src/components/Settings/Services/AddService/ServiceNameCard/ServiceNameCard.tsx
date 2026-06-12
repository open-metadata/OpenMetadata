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

import { Button, Input } from '@openmetadata/ui-core-components';
import { Plus } from '@untitledui/icons';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import RichTextEditor from '../../../../common/RichTextEditor/RichTextEditor';

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
  const initialDescription = useRef(description);
  const [showDescription, setShowDescription] = useState(
    () => description.length > 0
  );

  return (
    <div
      className="tw:rounded-xl tw:border tw:border-secondary tw:bg-primary tw:p-4 tw:shadow-xs"
      data-testid="service-name-card">
      <div className="tw:text-sm tw:font-medium tw:leading-5 tw:text-primary">
        {t('label.name-this-service')}
      </div>
      <div className="tw:mt-0.5 tw:text-xs tw:text-tertiary">
        {t('message.name-this-service-description', { serviceType })}
      </div>
      <div className="tw:my-3 tw:h-px tw:bg-[var(--tw-color-border-secondary)]" />

      <Input
        isRequired
        hint={nameError ?? t('message.service-name-rule')}
        id="service-name"
        inputDataTestId="service-name"
        isInvalid={!!nameError}
        label={t('label.service-name')}
        placeholder={t('label.service-name')}
        value={name}
        onChange={onNameChange}
        onFocus={() => onFocus?.('serviceName')}
      />

      {showDescription ? (
        <div className="tw:mt-4">
          <label
            className="tw:mb-2 tw:block tw:font-medium tw:text-secondary"
            htmlFor="service-description">
            {t('label.description')}
          </label>
          <RichTextEditor
            initialValue={initialDescription.current}
            placeHolder={t('message.add-a-description-for-the-service')}
            onFocus={() => onFocus?.('serviceDescription')}
            onTextChange={onDescriptionChange}
          />
        </div>
      ) : (
        <Button
          excludeFromTabOrder
          className="tw:mt-3"
          color="link-color"
          data-testid="add-description-button"
          iconLeading={<Plus size={15} />}
          size="sm"
          type="button"
          onPress={() => {
            onFocus?.('serviceDescription');
            setShowDescription(true);
          }}>
          {t('label.add-a-description')}
        </Button>
      )}
    </div>
  );
};

export default ServiceNameCard;
