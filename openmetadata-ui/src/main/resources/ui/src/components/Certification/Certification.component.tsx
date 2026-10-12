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
import { debounce, isNil } from 'lodash';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CertificationIcon } from '../../assets/svg/ic-certification.svg';
import {
  CERTIFICATION_CATEGORY,
  PAGE_SIZE_LARGE,
} from '../../constants/constants';
import { SearchIndex } from '../../enums/search.enum';
import { Tag } from '../../generated/entity/classification/tag';
import { searchQuery } from '../../rest/searchAPI';
import { getEntityName } from '../../utils/EntityNameUtils';
import { getTermQuery } from '../../utils/SearchPureUtils';
import {
  escapeESReservedCharacters,
  getEncodedFqn,
} from '../../utils/StringUtils';
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

const CERTIFICATION_ORDER: Record<string, number> = {
  Gold: 0,
  Silver: 1,
  Bronze: 2,
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
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [certifications, setCertifications] = useState<Tag[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState('');
  const isOpen = popoverProps?.open ?? isPopupOpen;
  const isFormField = isNil(children);
  // A pick or clear closes the picker itself; only a dismissal calls onClose.
  const isCommitRef = useRef(false);
  // Drops responses for a search or page the user has already moved past.
  const searchGeneration = useRef(0);
  // Scroll fires several times before a re-render, so the guard can't wait for state.
  const isFetchingMore = useRef(false);
  // Every certification seen, so the selected one keeps its label under any search.
  const knownCertifications = useRef(new Map<string, Tag>());

  const fetchPage = async (search: string, pageNumber: number) => {
    const res = await searchQuery({
      query: search
        ? `*${getEncodedFqn(escapeESReservedCharacters(search))}*`
        : '',
      pageNumber,
      pageSize: PAGE_SIZE_LARGE,
      queryFilter: getTermQuery({
        'classification.name.keyword': CERTIFICATION_CATEGORY,
        disabled: 'false',
      }),
      searchIndex: SearchIndex.TAG,
      sortField: 'name.keyword',
      sortOrder: 'asc',
    });
    const tags = res.hits.hits.map(({ _source }) => _source as Tag);
    tags.forEach((tag) =>
      knownCertifications.current.set(tag.fullyQualifiedName ?? '', tag)
    );

    return { tags, total: res.hits.total.value };
  };

  const showFetchError = (err: unknown) =>
    showErrorToast(
      err as AxiosError,
      t('server.entity-fetch-error', {
        entity: t('label.certification-plural-lowercase'),
      })
    );

  const loadFirstPage = async (search: string, generation: number) => {
    try {
      const res = await fetchPage(search, 1);
      if (generation !== searchGeneration.current) {
        return;
      }
      setCertifications(res.tags);
      setTotal(res.total);
      setPage(1);
      setSearchText(search);
    } catch (err) {
      if (generation === searchGeneration.current) {
        // Rows from the previous search must not read as this one's results.
        setCertifications([]);
        setTotal(0);
        showFetchError(err);
      }
    } finally {
      if (generation === searchGeneration.current) {
        setIsLoading(false);
      }
    }
  };

  // Built once: loadFirstPage reads only refs and state setters.
  const debouncedLoad = useMemo(() => debounce(loadFirstPage, 300), []);

  const beginSearch = (search: string, immediate = false) => {
    const generation = ++searchGeneration.current;
    setIsLoading(true);
    setIsLoadingMore(false);
    isFetchingMore.current = false;
    debouncedLoad.cancel();
    if (immediate) {
      void loadFirstPage(search, generation);
    } else {
      debouncedLoad(search, generation);
    }
  };

  // A form field also loads on mount, so its trigger can show the label.
  useEffect(() => {
    if (isOpen || (isFormField && knownCertifications.current.size === 0)) {
      beginSearch('', true);
    }

    return () => {
      ++searchGeneration.current;
      debouncedLoad.cancel();
    };
  }, [isOpen]);

  const handleLoadMore = async () => {
    if (isLoading || isFetchingMore.current || certifications.length >= total) {
      return;
    }
    const generation = searchGeneration.current;
    isFetchingMore.current = true;
    setIsLoadingMore(true);
    try {
      const res = await fetchPage(searchText, page + 1);
      if (generation !== searchGeneration.current) {
        return;
      }
      setCertifications((prev) => [...prev, ...res.tags]);
      setTotal(res.total);
      setPage((prev) => prev + 1);
    } catch (err) {
      if (generation === searchGeneration.current) {
        showFetchError(err);
      }
    } finally {
      if (generation === searchGeneration.current) {
        isFetchingMore.current = false;
        setIsLoadingMore(false);
      }
    }
  };

  // Gold, Silver, Bronze first; the rest keep the server's name order.
  const options = useMemo(
    () =>
      [...certifications]
        .sort(
          (a, b) =>
            (CERTIFICATION_ORDER[getEntityName(a)] ?? 3) -
            (CERTIFICATION_ORDER[getEntityName(b)] ?? 3)
        )
        .map((certification) => ({
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
    await onCertificationUpdate?.(knownCertifications.current.get(value));
  };

  const resolveLabel = (fqn: string) => {
    const certification = knownCertifications.current.get(fqn);

    return certification ? getEntityName(certification) : fqn;
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
      isLoadingMore={isLoadingMore}
      isOpen={isOpen}
      label={t('label.certification')}
      options={options}
      placeholder={t('label.select-field', {
        field: t('label.certification'),
      })}
      resolveMissingLabel={resolveLabel}
      selectedValues={currentCertificate ? [currentCertificate] : []}
      selectionMode="single"
      trigger={children}
      triggerVariant="input"
      onChange={handleChange}
      onLoadMore={handleLoadMore}
      onOpenChange={handleOpenChange}
      onSearch={(search) => beginSearch(search)}
    />
  );
};

export default Certification;
