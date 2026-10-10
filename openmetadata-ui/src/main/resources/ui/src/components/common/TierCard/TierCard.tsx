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
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZE_LARGE } from '../../../constants/constants';
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
        limit: PAGE_SIZE_LARGE,
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

  // A tier's description is a summary line, then (after a blank line) its details.
  const options = useMemo(
    () =>
      tiers.map((tier) => {
        const name = getEntityName(tier);
        const description = tier.description ?? '';
        const splitAt = description.indexOf('\n\n');
        const hasDetails = splitAt !== -1;
        const summary = (
          hasDetails ? description.slice(0, splitAt) : description
        ).replace(/\*/g, '');
        const details = hasDetails ? description.slice(splitAt).trim() : '';

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
              {summary && (
                <span className="tw:text-xs tw:whitespace-normal tw:text-tertiary">
                  {summary}
                </span>
              )}
            </span>
          ),
          details: details ? (
            <RichTextEditorPreviewerV1
              className="tier-card-description"
              enableSeeMoreVariant={false}
              markdown={details}
            />
          ) : undefined,
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
      trigger={children}
      onChange={handleChange}
      onOpenChange={handleOpenChange}
    />
  );
};

export default TierCard;
