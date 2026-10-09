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
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CertificationIcon } from '../../assets/svg/ic-certification.svg';
import { CERTIFICATION_CATEGORY } from '../../constants/constants';
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

const ICON_SIZE = 18;
const CERTIFICATION_ORDER: Record<string, number> = {
  Gold: 0,
  Silver: 1,
  Bronze: 2,
};

const byCertificationOrder = (a: Tag, b: Tag) =>
  (CERTIFICATION_ORDER[getEntityName(a)] ?? 3) -
  (CERTIFICATION_ORDER[getEntityName(b)] ?? 3);

const renderCertificationIcon = (certification: Tag) => {
  const fallback = <CertificationIcon height={ICON_SIZE} width={ICON_SIZE} />;
  const iconURL = certification.style?.iconURL;

  return iconURL ? (
    <Suspense fallback={fallback}>
      <Icon
        alt={getEntityName(certification)}
        fallback={fallback}
        iconValue={iconURL}
        size={ICON_SIZE}
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
  className,
}: CertificationProps) => {
  const { t } = useTranslation();
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [certifications, setCertifications] = useState<Tag[]>([]);
  const isOpen = popoverProps?.open ?? isPopupOpen;
  const isFormField = children === undefined;

  const fetchCertifications = async () => {
    setIsLoading(true);
    try {
      // ponytail: one page of 1000, as SetActionForm; page it if a catalog
      // ever defines more certifications than that.
      const { data } = await getTags({
        parent: CERTIFICATION_CATEGORY,
        limit: 1000,
        disabled: false,
      });
      setCertifications([...data].sort(byCertificationOrder));
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

  // Keyed on the resolved open state, so a caller opening it through
  // `popoverProps.open` fetches as well. A form field fetches up front so its
  // closed trigger can name the selected certification.
  useEffect(() => {
    if (isOpen || isFormField) {
      fetchCertifications();
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
    if (!open) {
      onClose?.();
    }
  };

  const handleChange = async ([value]: string[]) => {
    await onCertificationUpdate?.(
      certifications.find((cert) => cert.fullyQualifiedName === value)
    );
  };

  return (
    <FilterSelect
      clearable
      hideCounts
      searchable
      showRadio
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
