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
import { FilterSelect } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { isNil } from 'lodash';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CertificationIcon } from '../../assets/svg/ic-certification.svg';
import {
  CERTIFICATION_CATEGORY,
  PAGE_SIZE_LARGE,
} from '../../constants/constants';
import { Tag } from '../../generated/entity/classification/tag';
import { getTags } from '../../rest/tagAPI';
import { getEntityName } from '../../utils/EntityNameUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { CertificationProps } from './Certification.interface';

// Lazy-loaded from the dedicated `@openmetadata/ui-core-components/icon`
// subpath (not the package root) so ICON_MAP's ~44 icon components — a plain
// object a bundler cannot tree-shake key-by-key — never enter this eagerly
// rendered component's chunk unless a certification actually has an iconURL.
const Icon = lazy(() =>
  import('@openmetadata/ui-core-components/icon').then((m) => ({
    default: m.Icon,
  }))
);

const renderCertificationIcon = (certification: Tag) => {
  const fallback = <CertificationIcon height={18} width={18} />;
  const iconURL = certification.style?.iconURL;

  return iconURL ? (
    <Suspense fallback={fallback}>
      <Icon
        alt={getEntityName(certification)}
        fallback={fallback}
        iconValue={iconURL}
        size={18}
      />
    </Suspense>
  ) : (
    fallback
  );
};

const Certification = ({
  currentCertificate = '',
  children,
  onCertificationUpdate,
  popoverProps,
  onClose,
  isDisabled,
  'data-testid': testId,
  'aria-labelledby': ariaLabelledBy,
  className,
}: CertificationProps) => {
  const { t } = useTranslation();
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [certifications, setCertifications] = useState<Tag[]>([]);
  const isOpen = popoverProps?.open ?? isPopupOpen;
  const isFormField = isNil(children);
  // A pick or clear closes the picker itself; only a dismissal calls onClose.
  const isCommitRef = useRef(false);

  const fetchCertifications = async () => {
    setIsLoading(true);
    try {
      // Every page: the list is searched locally, so a certification past the
      // first page would never be offered. Cursor pages are sequential by
      // nature, and a real catalog fits in one.
      const all: Tag[] = [];
      let after: string | undefined;
      do {
        const { data, paging } = await getTags({
          parent: CERTIFICATION_CATEGORY,
          limit: PAGE_SIZE_LARGE,
          after,
          disabled: false,
        });
        all.push(...data);
        after = paging.after;
      } while (after);

      // Sort certifications with Gold, Silver, Bronze first
      const order: Record<string, number> = { Gold: 0, Silver: 1, Bronze: 2 };
      setCertifications(
        all.sort(
          (a, b) =>
            (order[getEntityName(a)] ?? 3) - (order[getEntityName(b)] ?? 3)
        )
      );
    } catch (err) {
      showErrorToast(
        err as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.certification-plural-lowercase'),
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isFormField ? certifications.length === 0 : isOpen) {
      void fetchCertifications();
    }
  }, [isOpen]);

  const options = useMemo(
    () =>
      certifications.map((certification) => ({
        value: certification.fullyQualifiedName ?? '',
        label: getEntityName(certification),
        icon: renderCertificationIcon(certification),
      })),
    [certifications]
  );

  const handleOpenChange = (open: boolean) => {
    setIsPopupOpen(open);
    popoverProps?.onOpenChange?.(open);
    if (!open && !isCommitRef.current) {
      onClose?.();
    }
    isCommitRef.current = false;
  };

  const handleChange = async ([value]: string[]) => {
    isCommitRef.current = true;
    await onCertificationUpdate?.(
      certifications.find((cert) => cert.fullyQualifiedName === value)
    );
  };

  return (
    <FilterSelect
      hideCounts
      searchable
      showRadio
      aria-labelledby={ariaLabelledBy}
      className={className}
      data-testid={testId}
      emptyState={t('label.no-entity-available', {
        entity: t('label.certification-plural-lowercase'),
      })}
      isDisabled={isDisabled}
      isLoading={isLoading}
      isOpen={isOpen}
      label={t('label.certification')}
      options={options}
      placeholder={t('label.select-field', {
        field: t('label.certification'),
      })}
      selectedValues={currentCertificate ? [currentCertificate] : []}
      selectionMode="single"
      trigger={children}
      triggerVariant="input"
      onChange={handleChange}
      onOpenChange={handleOpenChange}
    />
  );
};

export default Certification;
