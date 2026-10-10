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

import { FilterSelect } from '@openmetadata/ui-core-components';
import { Tag01 } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { isNil } from 'lodash';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tag } from '../../../generated/entity/classification/tag';
import { getTags } from '../../../rest/tagAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import RichTextEditorPreviewerV1 from '../RichTextEditor/RichTextEditorPreviewerV1';
import './tier-card.style.less';
import { TierCardProps } from './TierCard.interface';

const TierCard = ({
  currentTier,
  updateTier,
  children,
  open,
  onOpenChange,
  onClose,
  className,
}: TierCardProps) => {
  const { t } = useTranslation();
  const [tiers, setTiers] = useState<Tag[]>([]);
  const [isLoadingTierData, setIsLoadingTierData] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  // A pick or clear closes the picker itself; only a dismissal calls onClose.
  const isCommitRef = useRef(false);

  const getTierData = async () => {
    setIsLoadingTierData(true);
    try {
      const { data } = await getTags({
        parent: 'Tier',
        limit: 50,
        disabled: false,
      });
      setTiers(data ?? []);
    } catch (err) {
      showErrorToast(
        err as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.tier-plural-lowercase'),
        })
      );
    } finally {
      setIsLoadingTierData(false);
    }
  };

  useEffect(() => {
    if (isOpen && tiers.length === 0) {
      getTierData();
    }
  }, [isOpen]);

  // A tier's description is a summary line, then its details.
  const options = useMemo(
    () =>
      tiers.map((tier) => {
        const name = getEntityName(tier);
        const summary = tier.description
          .substring(0, tier.description.indexOf('\n\n'))
          .replace(/\*/g, '');
        const details = tier.description.substring(
          tier.description.indexOf('\n\n') + 1
        );

        return {
          value: tier.fullyQualifiedName ?? '',
          textValue: name,
          icon: Tag01,
          label: (
            <span className="tw:flex tw:min-w-0 tw:flex-col">
              <span
                className="tw:truncate"
                style={{ color: tier.style?.color }}>
                {name}
              </span>
              <span className="tw:text-xs tw:whitespace-normal tw:text-tertiary">
                {summary}
              </span>
            </span>
          ),
          details: (
            <RichTextEditorPreviewerV1
              className="tier-card-description"
              enableSeeMoreVariant={false}
              markdown={details}
            />
          ),
        };
      }),
    [tiers]
  );

  const handleOpenChange = (visible: boolean) => {
    setInternalOpen(visible);
    onOpenChange?.(visible);
    if (!visible && !isCommitRef.current) {
      onClose?.();
    }
    isCommitRef.current = false;
  };

  const handleChange = async ([value]: string[]) => {
    isCommitRef.current = true;
    await updateTier?.(tiers.find((tier) => tier.fullyQualifiedName === value));
  };

  return (
    <FilterSelect
      hideCounts
      searchable
      showRadio
      className={className}
      emptyState={t('label.no-entity-available', {
        entity: t('label.tier-plural-lowercase'),
      })}
      isLoading={isLoadingTierData}
      isOpen={isOpen}
      label={t('label.tier')}
      options={options}
      selectedValues={currentTier ? [currentTier] : []}
      selectionMode="single"
      trigger={isNil(children) ? null : children}
      onChange={handleChange}
      onOpenChange={handleOpenChange}
    />
  );
};

export default TierCard;
