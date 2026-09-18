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

import { Button, Input, Select } from '@openmetadata/ui-core-components';
import { isEmpty } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Environment,
  ServiceAttributes,
} from '../../../../generated/entity/services/serviceAttributes';
import ServiceSectionCard from '../ServiceSectionCard/ServiceSectionCard';

export interface ServiceAttributesCardProps {
  serviceAttributes?: ServiceAttributes;
  /** Hides the edit affordance when the user cannot edit the service. */
  hasEditPermission: boolean;
  onSave: (serviceAttributes: ServiceAttributes) => Promise<void>;
}

/** Blank strings would persist as empty values; the field is absent, not empty. */
const trimmedOrUndefined = (value?: string) =>
  value && value.trim() !== '' ? value.trim() : undefined;

const ServiceAttributesCard = ({
  serviceAttributes,
  hasEditPermission,
  onSave,
}: ServiceAttributesCardProps) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState<ServiceAttributes>(
    serviceAttributes ?? {}
  );

  const environmentOptions = useMemo(() => Object.values(Environment), []);

  const displayColumns = useMemo(
    () => [
      {
        key: 'environment',
        label: t('label.environment'),
        value: serviceAttributes?.environment,
      },
      {
        key: 'region',
        label: t('label.region'),
        value: serviceAttributes?.region,
      },
      {
        key: 'deployment',
        label: t('label.deployment'),
        value: serviceAttributes?.deployment,
      },
    ],
    [serviceAttributes, t]
  );

  const startEditing = useCallback(() => {
    setDraft(serviceAttributes ?? {});
    setIsEditing(true);
  }, [serviceAttributes]);

  const cancelEditing = useCallback(() => {
    setDraft(serviceAttributes ?? {});
    setIsEditing(false);
  }, [serviceAttributes]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave({
        environment: draft.environment,
        region: trimmedOrUndefined(draft.region),
        deployment: trimmedOrUndefined(draft.deployment),
      });
      setIsEditing(false);
    } catch {
      // Swallowed on purpose: the caller has already surfaced the failure to the user. Catching
      // here is about this card's own state -- staying in edit mode so nothing typed is lost --
      // and it keeps a rejected save from escaping the click handler as an unhandled rejection.
    } finally {
      setIsSaving(false);
    }
  }, [draft, onSave]);

  const actions = isEditing ? (
    <>
      <Button
        color="secondary"
        data-testid="cancel-service-attributes"
        isDisabled={isSaving}
        size="sm"
        onClick={cancelEditing}>
        {t('label.cancel')}
      </Button>
      <Button
        data-testid="save-service-attributes"
        isLoading={isSaving}
        size="sm"
        onClick={handleSave}>
        {t('label.save')}
      </Button>
    </>
  ) : (
    hasEditPermission && (
      <Button
        color="secondary"
        data-testid="edit-service-attributes"
        size="sm"
        onClick={startEditing}>
        {t('label.edit')}
      </Button>
    )
  );

  return (
    <ServiceSectionCard
      actions={actions}
      description={t('message.service-attributes-description')}
      testId="service-attributes-card"
      title={t('label.service-attribute-plural')}>
      {isEditing ? (
        <div className="tw:grid tw:grid-cols-1 tw:gap-6 tw:md:grid-cols-3">
          <Select
            isRequired
            data-testid="service-environment-select"
            label={t('label.environment')}
            value={draft.environment}
            onChange={(key) =>
              setDraft((previous) => ({
                ...previous,
                environment: (key as Environment) ?? undefined,
              }))
            }>
            {environmentOptions.map((option) => (
              <Select.Item id={option} key={option} label={option} />
            ))}
          </Select>
          <Input
            id="service-region"
            inputDataTestId="service-region"
            label={t('label.region')}
            value={draft.region ?? ''}
            onChange={(value: string) =>
              setDraft((previous) => ({ ...previous, region: value }))
            }
          />
          <Input
            id="service-deployment"
            inputDataTestId="service-deployment"
            label={t('label.deployment')}
            value={draft.deployment ?? ''}
            onChange={(value: string) =>
              setDraft((previous) => ({ ...previous, deployment: value }))
            }
          />
        </div>
      ) : (
        <div
          className="tw:grid tw:grid-cols-1 tw:gap-6 tw:md:grid-cols-3 tw:md:gap-0"
          data-testid="service-attributes-values">
          {displayColumns.map((column, index) => (
            <div
              className={
                // Dividers between columns, not before the first one, and only once the
                // columns actually sit side by side.
                index === 0
                  ? 'tw:md:pr-6'
                  : 'tw:md:border-l tw:md:border-secondary tw:md:px-6'
              }
              key={column.key}>
              <div className="tw:text-xs tw:text-tertiary">{column.label}</div>
              <div
                className="tw:mt-1 tw:text-sm tw:font-medium tw:text-primary"
                data-testid={`service-${column.key}-value`}>
                {isEmpty(column.value) ? '-' : column.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </ServiceSectionCard>
  );
};

export default ServiceAttributesCard;
