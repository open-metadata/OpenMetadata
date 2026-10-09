/*
 *  Copyright 2023 Collate.
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
import { Button, Select } from '@openmetadata/ui-core-components';
import { Check, XClose } from '@openmetadata/ui-core-components/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DomainType } from '../../../generated/api/domains/createDomain';
import { DomainTypeSelectFormProps } from './DomainTypeSelectForm.interface';

const domainTypeItems = Object.values(DomainType).map((value) => ({
  id: value,
  label: value,
}));

const DomainTypeSelectForm = ({
  defaultValue,
  onSubmit,
  onCancel,
}: DomainTypeSelectFormProps) => {
  const { t } = useTranslation();
  const [domainType, setDomainType] = useState(defaultValue);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);

  const handleSubmit = () => {
    setIsSubmitLoading(true);
    onSubmit(domainType);
  };

  return (
    <div className="tw:flex tw:flex-col tw:gap-2">
      <div className="tw:flex tw:justify-end tw:gap-2">
        <Button
          aria-label={t('label.cancel')}
          color="secondary"
          data-testid="cancelAssociatedTag"
          iconLeading={XClose}
          isDisabled={isSubmitLoading}
          size="xs"
          onClick={onCancel}
        />
        <Button
          aria-label={t('label.save')}
          color="primary"
          data-testid="saveAssociatedTag"
          iconLeading={Check}
          isLoading={isSubmitLoading}
          size="xs"
          onClick={handleSubmit}
        />
      </div>
      <Select
        aria-label={t('label.domain-type')}
        data-testid="domainType-select"
        items={domainTypeItems}
        size="sm"
        value={domainType}
        onChange={(key) => setDomainType(key as string)}>
        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
      </Select>
    </div>
  );
};

export default DomainTypeSelectForm;
