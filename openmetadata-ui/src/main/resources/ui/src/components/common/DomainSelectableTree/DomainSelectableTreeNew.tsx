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
import {
  Button,
  Input,
  Tag,
  TagGroup,
  TagList,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus } from '@untitledui/icons';
import { Tree } from 'antd';
import { AxiosError } from 'axios';
import { debounce, uniqBy } from 'lodash';
import {
  FC,
  Key,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconDown } from '../../../assets/svg/ic-arrow-down.svg';
import { ReactComponent as IconRight } from '../../../assets/svg/ic-arrow-right.svg';
import { ReactComponent as ClosePopoverIcon } from '../../../assets/svg/ic-popover-close.svg';
import { ReactComponent as SavePopoverIcon } from '../../../assets/svg/ic-popover-save.svg';
import {
  INITIAL_PAGING_STATE,
  PAGE_SIZE_BASE,
  SCROLL_TRIGGER_THRESHOLD,
} from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { Domain } from '../../../generated/entity/domains/domain';
import { EntityReference } from '../../../generated/tests/testCase';
import {
  getDomainChildrenPaginated,
  searchDomains,
} from '../../../rest/domainAPI';
import { isDomainExist } from '../../../utils/DomainFilterUtils';
import { convertDomainsToTreeOptions } from '../../../utils/DomainUtils';
import { getEntityReferenceFromEntity } from '../../../utils/EntityReferenceUtils';
import {
  escapeESReservedCharacters,
  getEncodedFqn,
} from '../../../utils/StringUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import Loader from '../Loader/Loader';
import './domain-selectable.less';
import {
  DomainSelectableTreeProps,
  TreeListItem,
} from './DomainSelectableTree.interface';

const MAX_VISIBLE_TAGS = 2;

const DomainSelectablTreeNew: FC<DomainSelectableTreeProps> = ({
  onSubmit,
  value,
  visible,
  onCancel,
  isMultiple = false,
  initialDomains,
  isClearable = true,
}) => {
  const { t } = useTranslation();
  const [treeData, setTreeData] = useState<TreeListItem[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [searchValue, setSearchValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [selectedDomains, setSelectedDomains] = useState<Domain[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [paging, setPaging] = useState(INITIAL_PAGING_STATE);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [loadingChildren, setLoadingChildren] = useState<
    Record<string, boolean>
  >({});
  const [childPaging, setChildPaging] = useState<
    Record<
      string,
      {
        offset: number;
        limit: number;
        total: number;
      }
    >
  >({});
  const [domainMapper, setDomainMapper] = useState<Record<string, Domain>>({});

  const pagingRef = useRef(INITIAL_PAGING_STATE);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const selectionInitializedRef = useRef<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    pagingRef.current = paging;
  }, [paging]);

  const updateNested = useCallback(
    (
      domainList: Domain[],
      targetFqn: string,
      newChildren: Domain[],
      isAppend = false
    ): Domain[] => {
      return domainList.map((domain) => {
        if (domain.fullyQualifiedName === targetFqn) {
          return {
            ...domain,
            children: isAppend
              ? [
                  ...(domain.children ?? []),
                  ...(newChildren as unknown as EntityReference[]),
                ]
              : (newChildren as unknown as EntityReference[]),
          };
        }

        if (domain.children?.length) {
          return {
            ...domain,
            children: updateNested(
              domain.children as unknown as Domain[],
              targetFqn,
              newChildren,
              isAppend
            ) as unknown as EntityReference[],
          };
        }

        return domain;
      });
    },
    []
  );

  const loadChildDomains = useCallback(
    async (parentFqn: string, isLoadMore = false): Promise<void> => {
      setLoadingChildren((prev) => ({ ...prev, [parentFqn]: true }));

      try {
        const currentPaging = childPaging[parentFqn] || {
          offset: 0,
          limit: PAGE_SIZE_BASE,
          total: 0,
        };

        const currentOffset = isLoadMore
          ? currentPaging.offset + currentPaging.limit
          : 0;

        const response = await getDomainChildrenPaginated(
          parentFqn,
          PAGE_SIZE_BASE,
          currentOffset
        );
        const children = response.data ?? [];
        const total = response.paging.total;

        setChildPaging((prev) => ({
          ...prev,
          [parentFqn]: {
            offset: currentOffset,
            limit: PAGE_SIZE_BASE,
            total,
          },
        }));

        setDomains((prev) =>
          updateNested(prev, parentFqn, children, isLoadMore)
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setLoadingChildren((prev) => ({ ...prev, [parentFqn]: false }));
      }
    },
    [updateNested, childPaging]
  );

  const addLoadMoreNodes = useCallback(
    (
      treeItems: TreeListItem[],
      parentFqn?: string,
      handleLoadMore?: (fqn: string) => void
    ): TreeListItem[] => {
      const shouldAddLoadMore = (parentFqn?: string) => {
        if (!parentFqn || !handleLoadMore) {
          return false;
        }
        const paging = childPaging[parentFqn];
        if (!paging) {
          return false;
        }

        return paging.offset + paging.limit < paging.total;
      };

      const processedItems: TreeListItem[] = [];

      for (const item of treeItems) {
        const itemFqn = item.key as string;
        const domain = domainMapper[itemFqn];

        const hasChildren = domain?.children && item.children;

        processedItems.push(
          hasChildren
            ? {
                ...item,
                children: addLoadMoreNodes(
                  item.children,
                  itemFqn,
                  handleLoadMore
                ),
              }
            : item
        );
      }

      if (parentFqn && shouldAddLoadMore(parentFqn)) {
        const isLoadingMore = loadingChildren[parentFqn] ?? false;

        processedItems.push({
          key: `${parentFqn}-load-more`,
          value: `${parentFqn}-load-more`,
          name: 'Load More',
          label: 'Load More',
          isLeaf: true,
          selectable: false,
          disabled: true,
          className: 'load-more-node',
          title: (
            <div onClick={(e) => e.stopPropagation()}>
              <Button
                color="link-color"
                iconLeading={isLoadingMore ? undefined : Plus}
                size="sm"
                onPress={() => handleLoadMore?.(parentFqn)}>
                {isLoadingMore ? <Loader size="small" /> : t('label.load-more')}
              </Button>
            </div>
          ),
        });
      }

      return processedItems;
    },
    [childPaging, loadingChildren, domainMapper, t]
  );

  const buildIndex = (domainList: Domain[]) => {
    const map: Record<string, Domain> = {};
    for (const d of domainList) {
      map[d.fullyQualifiedName as string] = d;

      if (d.children?.length) {
        const childMap = buildIndex(d.children as unknown as Domain[]);
        Object.assign(map, childMap);
      }
    }

    return map;
  };

  useEffect(() => {
    const newMap = buildIndex(domains);

    setDomainMapper((prev) => {
      const merged = { ...prev, ...newMap };

      if (JSON.stringify(prev) === JSON.stringify(merged)) {
        return prev;
      }

      return merged;
    });

    if (domains.length > 0 && !searchTerm) {
      const baseTreeData = convertDomainsToTreeOptions(domains, 0, isMultiple);
      const treeDataWithLoadMore = addLoadMoreNodes(
        baseTreeData,
        undefined,
        (fqn: string) => loadChildDomains(fqn, true)
      );
      setTreeData(treeDataWithLoadMore);
    }
  }, [domains, searchTerm, isMultiple, addLoadMoreNodes, loadChildDomains]);

  const handleMultiDomainSave = async () => {
    const selectedFqns = selectedDomains
      .map((domain) => domain.fullyQualifiedName)
      .sort((a, b) => (a ?? '').localeCompare(b ?? ''));
    const initialFqns = (value as string[]).sort((a, b) => a.localeCompare(b));

    if (JSON.stringify(selectedFqns) === JSON.stringify(initialFqns)) {
      onCancel();
    } else {
      setIsSubmitLoading(true);
      const domains1 = selectedDomains.map((item) =>
        getEntityReferenceFromEntity<Domain>(item, EntityType.DOMAIN)
      );
      await onSubmit(domains1);
      setIsSubmitLoading(false);
    }
  };

  const handleSingleDomainSave = async () => {
    const selectedFqn = selectedDomains[0]?.fullyQualifiedName;
    const initialFqn = value?.[0];

    if (selectedFqn === initialFqn) {
      onCancel();
    } else {
      setIsSubmitLoading(true);
      let retn: EntityReference[] = [];
      if (selectedDomains.length > 0) {
        const domain = getEntityReferenceFromEntity<Domain>(
          selectedDomains[0],
          EntityType.DOMAIN
        );
        retn = [domain];
      }
      try {
        await onSubmit(retn);
      } finally {
        setIsSubmitLoading(false);
      }
    }
  };

  const fetchAPI = useCallback(
    async (isLoadMore = false) => {
      const setLoadingState = isLoadMore ? setIsLoadingMore : setIsLoading;
      setLoadingState(true);

      if (!isLoadMore) {
        setPaging(INITIAL_PAGING_STATE);
        setHasMore(true);
      }

      try {
        const currentPaging = pagingRef.current;
        const currentOffset = isLoadMore
          ? currentPaging.offset + currentPaging.limit
          : 0;

        const data = await getDomainChildrenPaginated(
          undefined,
          currentPaging.limit,
          currentOffset
        );

        const fetchedData = data.data ?? [];
        const total = data.paging.total ?? 0;

        let combinedData: Domain[];
        if (isLoadMore) {
          combinedData = [...domains, ...fetchedData];
        } else {
          combinedData = [...fetchedData];
        }

        setTreeData(convertDomainsToTreeOptions(combinedData, 0, isMultiple));
        setDomains(combinedData);

        setPaging({
          offset: currentOffset,
          limit: currentPaging.limit,
          total,
        });

        setHasMore(currentOffset + currentPaging.limit < total);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setLoadingState(false);
      }
    },
    [domains, isMultiple, initialDomains]
  );

  const onSelect = (selectedKeys: React.Key[]) => {
    if (!isMultiple) {
      if (selectedKeys.length === 0 && !isClearable) {
        return;
      }

      const selectedData = [];
      for (const item of selectedKeys) {
        const domain = domainMapper[item as string];
        if (domain) {
          selectedData.push(domain);
        }
      }

      setSelectedDomains(selectedData);
    }
  };

  const onCheck = (
    checked: Key[] | { checked: Key[]; halfChecked: Key[] }
  ): void => {
    if (Array.isArray(checked)) {
      const selectedData = [];
      for (const item of checked) {
        const domain = domainMapper[item as string];
        if (domain) {
          selectedData.push(domain);
        }
      }

      setSelectedDomains(selectedData);
    } else {
      const selected = checked.checked
        .map((item) => domainMapper[item as string])
        .filter(Boolean);

      setSelectedDomains(selected);
    }
  };

  const switcherIcon = useCallback((props: { expanded?: boolean }) => {
    return props?.expanded ? <IconDown /> : <IconRight />;
  }, []);

  const selectedKeys = useMemo(
    () =>
      selectedDomains
        .map((domain) => domain.fullyQualifiedName)
        .filter(Boolean) as string[],
    [selectedDomains]
  );

  const onSearch = useCallback(
    debounce(async (value: string) => {
      setSearchTerm(value);
      if (value) {
        try {
          setIsLoading(true);
          const encodedValue = getEncodedFqn(escapeESReservedCharacters(value));
          const results: Domain[] = await searchDomains(encodedValue);

          const combinedData = [...results];

          initialDomains?.forEach((selectedDomain) => {
            const exists = combinedData.some((domain: Domain) =>
              isDomainExist(domain, selectedDomain.fullyQualifiedName ?? '')
            );
            if (!exists) {
              combinedData.push(selectedDomain as unknown as Domain);
            }
          });

          const uniqueData = uniqBy(combinedData, 'fullyQualifiedName');
          const updatedTreeData = convertDomainsToTreeOptions(
            uniqueData,
            0,
            isMultiple
          );
          setTreeData(updatedTreeData);
          setDomains(uniqueData);
        } finally {
          setIsLoading(false);
        }
      } else {
        fetchAPI();
      }
    }, 300),
    [fetchAPI, isMultiple]
  );

  const onLoadData = useCallback(
    async (node: TreeListItem) => {
      const nodeFqn = node.key as string;
      const domain = domainMapper[nodeFqn];

      if (!domain) {
        return false;
      }

      const hasLoaded = (domain.children?.length || 0) > 0;
      const hasChildrenCount = (domain.childrenCount ?? 0) > 0;

      if (!hasLoaded && hasChildrenCount && !loadingChildren[nodeFqn]) {
        return loadChildDomains(nodeFqn);
      }

      return true;
    },
    [domainMapper, loadingChildren, loadChildDomains]
  );

  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      if (!hasMore || isLoadingMore || isLoading || searchTerm) {
        return;
      }

      if (distanceFromBottom < SCROLL_TRIGGER_THRESHOLD) {
        fetchAPI(true);
      }
    },
    [hasMore, isLoadingMore, isLoading, searchTerm, fetchAPI]
  );

  const treeContent = useMemo(() => {
    if (isLoading) {
      return <Loader />;
    } else if (treeData.length === 0) {
      return (
        <div className="tw:py-4 tw:text-center tw:text-sm tw:text-tertiary">
          {t('label.no-entity-available', {
            entity: t('label.domain-plural'),
          })}
        </div>
      );
    } else {
      return (
        <div
          className="domain-custom-dropdown-class"
          ref={scrollContainerRef}
          style={{ maxHeight: 200, overflowY: 'auto' }}
          onScroll={handleScroll}>
          <Tree
            blockNode
            checkStrictly
            showLine
            autoExpandParent={Boolean(searchTerm)}
            checkable={isMultiple}
            checkedKeys={isMultiple ? selectedKeys : undefined}
            className="domain-selectable-tree-new"
            loadData={searchTerm ? undefined : onLoadData}
            multiple={isMultiple}
            selectedKeys={isMultiple ? undefined : selectedKeys}
            switcherIcon={switcherIcon}
            treeData={treeData}
            virtual={false}
            onCheck={onCheck}
            onSelect={onSelect}
          />
          {isLoadingMore && (
            <div style={{ textAlign: 'center', padding: '8px' }}>
              <Loader size="small" />
            </div>
          )}
        </div>
      );
    }
  }, [
    isLoading,
    isLoadingMore,
    treeData,
    selectedKeys,
    onSelect,
    isMultiple,
    searchTerm,
    handleScroll,
    onCheck,
    switcherIcon,
    onLoadData,
    t,
  ]);

  useEffect(() => {
    if (visible) {
      setSearchTerm('');
      setSearchValue('');
      selectionInitializedRef.current = false;
      fetchAPI();
      searchInputRef.current?.focus();
    }
  }, [visible]);

  const handleRemoveDomains = useCallback(
    (keys: Set<Key>) => {
      setSelectedDomains((prev) => {
        if (!isMultiple && !isClearable && prev.length === 1) {
          return prev;
        }

        return prev.filter(
          (domain) => !keys.has(domain.fullyQualifiedName as string)
        );
      });
    },
    [isMultiple, isClearable]
  );

  const handleSearchChange = useCallback(
    (searchText: string) => {
      setSearchValue(searchText);
      onSearch(searchText);
    },
    [onSearch]
  );

  const handleBoxClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if ((event.target as HTMLElement).closest('button')) {
        return;
      }
      searchInputRef.current?.focus();
    },
    []
  );

  const selectedTagItems = useMemo(
    () =>
      selectedDomains
        .filter((domain) => domain?.fullyQualifiedName)
        .map((domain) => ({
          id: domain.fullyQualifiedName as string,
          label: domain.displayName ?? domain.name,
        })),
    [selectedDomains]
  );

  const visibleTagItems = selectedTagItems.slice(0, MAX_VISIBLE_TAGS);
  const hiddenTagCount = selectedTagItems.length - visibleTagItems.length;

  useEffect(() => {
    if (selectionInitializedRef.current) {
      return;
    }

    if (initialDomains) {
      setSelectedDomains(initialDomains as unknown as Domain[]);
      selectionInitializedRef.current = true;
    } else if (value && value.length > 0) {
      const selectedData = value
        .map((fqn) => domainMapper[fqn])
        .filter(Boolean);
      if (selectedData.length > 0) {
        setSelectedDomains(selectedData);
        selectionInitializedRef.current = true;
      }
    }
  }, [initialDomains, value, domainMapper]);

  return (
    <div data-testid="domain-selectable-tree" style={{ width: '339px' }}>
      <div
        className="custom-domain-edit-select tw:flex tw:cursor-text tw:flex-col tw:gap-1 tw:rounded-lg tw:border tw:border-primary tw:px-2.5 tw:py-1.5 tw:focus-within:border-brand"
        data-testid="domain-search-input-wrapper"
        onClick={handleBoxClick}>
        {selectedTagItems.length > 0 && (
          <div className="tw:flex tw:flex-nowrap tw:items-center tw:gap-1 tw:overflow-hidden">
            <TagGroup
              className="tw:flex tw:min-w-0 tw:flex-nowrap tw:gap-1"
              label={t('label.domain-plural')}
              size="sm"
              onRemove={handleRemoveDomains}>
              <TagList
                className="tw:flex tw:min-w-0 tw:flex-nowrap tw:gap-1"
                items={visibleTagItems}>
                {(item) => (
                  <Tag id={item.id}>
                    <span className="tw:inline-block tw:max-w-20 tw:truncate tw:align-bottom">
                      {item.label}
                    </span>
                  </Tag>
                )}
              </TagList>
            </TagGroup>
          </div>
        )}
        <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-2">
          {hiddenTagCount > 0 && (
            <Typography
              className="tw:shrink-0 tw:text-brand-secondary"
              data-testid="domain-tag-more-count"
              size="text-xs"
              weight="medium">
              {t('label.plus-count-more', { count: hiddenTagCount })}
            </Typography>
          )}
          <Input
            className="tw:min-w-16 tw:flex-1"
            inputClassName="tw:p-0!"
            inputDataTestId="domain-search-input"
            placeholder={t('label.select-entity', {
              entity: t('label.domain'),
            })}
            ref={searchInputRef}
            value={searchValue}
            wrapperClassName="tw:bg-transparent! tw:shadow-none! tw:outline-0!"
            onChange={handleSearchChange}
          />
        </div>
      </div>
      <div className="tw:mt-2">{treeContent}</div>
      <div className="tw:mt-3 tw:flex tw:justify-end tw:gap-2">
        <Button
          className="profile-edit-save tw:size-7.5 tw:p-0!"
          data-testid="user-profile-domain-edit-save"
          iconLeading={<ClosePopoverIcon height={24} />}
          size="sm"
          onPress={onCancel}
        />
        <Button
          className="profile-edit-cancel tw:size-7.5 tw:p-0!"
          data-testid="user-profile-domain-edit-cancel"
          iconLeading={<SavePopoverIcon height={24} />}
          isLoading={isSubmitLoading}
          size="sm"
          onPress={isMultiple ? handleMultiDomainSave : handleSingleDomainSave}
        />
      </div>
    </div>
  );
};

export default DomainSelectablTreeNew;
