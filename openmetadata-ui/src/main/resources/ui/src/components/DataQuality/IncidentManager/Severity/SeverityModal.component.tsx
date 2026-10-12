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

import { Form, Select, SimpleModal } from '@openmetadata/ui-core-components';
import { startCase } from 'lodash';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Severities } from '../../../../generated/tests/testCaseResolutionStatus';
import { SeverityModalProps } from './Severity.interface';

const NO_SEVERITY = 'none';

const SeverityModal = ({
  initialSeverity,
  onCancel,
  onSubmit,
}: SeverityModalProps) => {
  const { t } = useTranslation();
  const [severity, setSeverity] = useState<Severities | undefined>(
    initialSeverity
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // The leading "No severity" item stands in for antd's allowClear.
  const severityItems = [
    {
      id: NO_SEVERITY,
      label: t('label.no-entity', { entity: t('label.severity') }),
    },
    ...Object.values(Severities).map((value) => ({
      id: value,
      label: startCase(value),
    })),
  ];

  const handleSubmit = () => {
    setIsLoading(true);
    onSubmit(severity).finally(() => {
      setIsLoading(false);
    });
  };

  return (
    <SimpleModal
      isOpen
      cancelText={t('label.cancel')}
      isDismissable={false}
      isOkLoading={isLoading}
      okText={t('label.save')}
      title={t('label.edit-entity', { entity: t('label.severity') })}
      width={600}
      onCancel={onCancel}
      onOk={handleSubmit}>
      <Form data-testid="severity-form">
        <Select
          data-testid="severity-select"
          items={severityItems}
          label={t('label.severity')}
          placeholder={t('label.please-select-entity', {
            entity: t('label.severity'),
          })}
          selectedKey={severity ?? null}
          onSelectionChange={(key) =>
            setSeverity(
              key === NO_SEVERITY || key === null
                ? undefined
                : (key as Severities)
            )
          }>
          {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
        </Select>
      </Form>
    </SimpleModal>
  );
};

export default SeverityModal;
