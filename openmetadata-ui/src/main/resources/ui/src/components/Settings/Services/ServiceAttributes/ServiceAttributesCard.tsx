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

  const displayRows = useMemo(
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

  const hasAnyValue = displayRows.some((row) => !isEmpty(row.value));

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

  return (
    <div
      className="tw:rounded-xl tw:border tw:border-secondary tw:bg-primary tw:p-5 tw:shadow-xs"
      data-testid="service-attributes-card">
      <div className="tw:flex tw:items-start tw:justify-between tw:gap-4">
        <div>
          <div className="tw:text-sm tw:font-semibold tw:leading-6 tw:text-primary">
            {t('label.service-attribute-plural')}
          </div>
          <div className="tw:mt-0.5 tw:text-xs tw:text-tertiary">
            {t('message.service-attributes-description')}
          </div>
        </div>
        {hasEditPermission && !isEditing && (
          <Button
            data-testid="edit-service-attributes"
            size="sm"
            onClick={startEditing}>
            {t('label.edit')}
          </Button>
        )}
      </div>

      <div className="tw:my-3 tw:h-px tw:bg-[var(--tw-color-border-secondary)]" />

      {isEditing ? (
        <div className="tw:flex tw:flex-col tw:gap-4">
          <Select
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
          <div className="tw:flex tw:justify-end tw:gap-2">
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
          </div>
        </div>
      ) : (
        <div
          className="tw:flex tw:flex-col tw:gap-2"
          data-testid="service-attributes-values">
          {hasAnyValue ? (
            displayRows.map((row) => (
              <div className="tw:flex tw:gap-2 tw:text-sm" key={row.key}>
                <span className="tw:text-tertiary">{row.label}</span>
                <span
                  className="tw:text-primary"
                  data-testid={`service-${row.key}-value`}>
                  {isEmpty(row.value) ? '-' : row.value}
                </span>
              </div>
            ))
          ) : (
            <div
              className="tw:text-sm tw:text-tertiary"
              data-testid="no-service-attributes">
              {t('message.no-service-attributes-set')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ServiceAttributesCard;
