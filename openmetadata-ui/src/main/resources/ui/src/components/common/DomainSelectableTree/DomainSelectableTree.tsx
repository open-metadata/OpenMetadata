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
  Box,
  Button,
  Input,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus, SearchLg } from '@untitledui/icons';
import { Tree } from 'antd';
import { AntTreeNodeProps } from 'antd/lib/tree';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { debounce, isEmpty, uniqBy } from 'lodash';
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
import { ReactComponent as DomainIcon } from '../../../assets/svg/ic-domain.svg';
import { DEFAULT_DOMAIN_VALUE } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { Domain } from '../../../generated/entity/domains/domain';
import type { EntityReference } from '../../../generated/type/entityReference';
import { useDomainStore } from '../../../hooks/useDomainStore';
import {
  getDomainChildrenPaginated,
  searchDomains,
} from '../../../rest/domainAPI';
import { isDomainExist } from '../../../utils/DomainFilterUtils';
import { filterDomainsToAllowed } from '../../../utils/DomainRestrictionUtils';
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

const INITIAL_PAGE_SIZE = 15;
const SCROLL_TRIGGER_THRESHOLD = 200;
const INITIAL_PAGING_STATE = { offset: 0, limit: INITIAL_PAGE_SIZE, total: 0 };

const DomainSelectablTree: FC<DomainSelectableTreeProps> = ({
  onSubmit,
  value,
  visible,
  onCancel,
  isMultiple = false,
  initialDomains,
  showAllDomains = false,
  restrictedDomains,
  isClearable = true,
}) => {
  const { t } = useTranslation();
  const [treeData, setTreeData] = useState<TreeListItem[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
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

  const { activeDomain } = useDomainStore();
  const pagingRef = useRef(INITIAL_PAGING_STATE);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

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
          limit: INITIAL_PAGE_SIZE,
          total: 0,
        };

        const currentOffset = isLoadMore
          ? currentPaging.offset + currentPaging.limit
          : 0;

        const response = await getDomainChildrenPaginated(
          parentFqn,
          INITIAL_PAGE_SIZE,
          currentOffset
        );
        const children = response.data ?? [];
        const total = response.paging.total;

        setChildPaging((prev) => ({
          ...prev,
          [parentFqn]: {
            offset: currentOffset,
            limit: INITIAL_PAGE_SIZE,
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
            <Button
              className="tw:ml-7"
              color="link-color"
              iconLeading={isLoadingMore ? undefined : Plus}
              size="sm"
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation();
                handleLoadMore?.(parentFqn);
              }}>
              {isLoadingMore ? <Loader size="small" /> : t('label.load-more')}
            </Button>
          ),
        });
      }

      return processedItems;
    },
    [childPaging, loadingChildren, domainMapper, t]
  );

  useEffect(() => {
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

  const handleMyDomainsClick = async () => {
    await onSubmit([]);
  };
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

  const handleSingleDomainSave = async (domains?: Domain[]) => {
    const availableDomains = domains ?? selectedDomains;
    const selectedFqn = availableDomains[0]?.fullyQualifiedName;
    const initialFqn = value?.[0];

    if (selectedFqn === initialFqn) {
      onCancel();
    } else {
      setIsSubmitLoading(true);
      let retn: EntityReference[] = [];
      if (availableDomains.length > 0) {
        const domain = getEntityReferenceFromEntity<Domain>(
          availableDomains[0],
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

        const rawData = data.data ?? [];
        const fetchedData = restrictedDomains?.length
          ? filterDomainsToAllowed(rawData, restrictedDomains)
          : rawData;
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
    [domains, isMultiple, initialDomains, restrictedDomains]
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
      handleSingleDomainSave(selectedData);
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

  const onSearch = useCallback(
    debounce(async (value: string) => {
      setSearchTerm(value);
      if (value) {
        try {
          setIsLoading(true);
          const encodedValue = getEncodedFqn(escapeESReservedCharacters(value));
          const results: Domain[] = await searchDomains(encodedValue);
          const filteredResults = restrictedDomains?.length
            ? filterDomainsToAllowed(results, restrictedDomains)
            : results;

          const combinedData = [...filteredResults];

          // Ensure initialDomains are included
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
    [fetchAPI, initialDomains, isMultiple, restrictedDomains]
  );

  const switcherIcon = useCallback(
    ({ expanded }: AntTreeNodeProps) =>
      expanded ? <IconDown /> : <IconRight />,
    []
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
    [hasMore, isLoadingMore, isLoading, searchTerm, fetchAPI, domains.length]
  );

  const treeContent = useMemo(() => {
    if (isLoading) {
      return <Loader />;
    } else if (treeData.length === 0) {
      return (
        <Box
          align="center"
          className="tw:py-6 tw:text-text-tertiary"
          direction="col"
          gap={2}
          justify="center">
          <DomainIcon height={24} name="domain" width={24} />
          <Typography className="tw:text-text-tertiary" size="text-sm">
            {t('label.no-entity-available', {
              entity: t('label.domain-plural'),
            })}
          </Typography>
        </Box>
      );
    } else {
      return (
        <>
          <div className="tw:relative">
            {isSubmitLoading && (
              <div className="tw:absolute tw:inset-0 tw:z-10 tw:flex tw:items-center tw:justify-center tw:bg-primary/60">
                <Loader size="small" />
              </div>
            )}
            <div
              className="tw:max-h-75 tw:overflow-y-auto"
              ref={scrollContainerRef}
              onScroll={handleScroll}>
              <Tree
                blockNode
                checkStrictly
                showLine
                autoExpandParent={Boolean(searchTerm)}
                checkable={isMultiple}
                className="domain-selectable-tree"
                defaultCheckedKeys={isMultiple ? value : []}
                defaultExpandedKeys={value}
                defaultSelectedKeys={isMultiple ? [] : value}
                loadData={searchTerm ? undefined : onLoadData}
                multiple={isMultiple}
                switcherIcon={switcherIcon}
                treeData={treeData}
                virtual={false}
                onCheck={onCheck}
                onSelect={onSelect}
              />
            </div>
          </div>
          {isLoadingMore && (
            <div className="tw:p-2 tw:text-center">
              <Loader size="small" />
            </div>
          )}
        </>
      );
    }
  }, [
    isLoading,
    isLoadingMore,
    isSubmitLoading,
    treeData,
    value,
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
      fetchAPI();
    }
  }, [visible]);

  useEffect(() => {
    const loadSelectedDomainChildren = async () => {
      if (value?.length === 0 || !visible || isEmpty(domainMapper)) {
        return;
      }

      for (const fqn of value ?? []) {
        const domain = domainMapper[fqn];
        if (!domain) {
          continue;
        }

        const hasLoaded = (domain.children?.length || 0) > 0;
        const hasChildrenCount = (domain.childrenCount ?? 0) > 0;

        if (!hasLoaded && hasChildrenCount && !loadingChildren[fqn]) {
          await loadChildDomains(fqn);
        }
      }
    };

    loadSelectedDomainChildren();
  }, [value, visible, domainMapper]);

  const handleAllDomainKeyPress = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // To pass Sonar test
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleMyDomainsClick();
    }
  };

  return (
    <div className="p-sm" data-testid="domain-selectable-tree">
      <Input
        autoFocus
        className="tw:mb-2"
        icon={SearchLg}
        inputDataTestId="searchbar"
        placeholder={t('label.search')}
        onChange={onSearch}
      />

      {showAllDomains && (
        <Box
          align="center"
          className={classNames(
            'all-domain-container p-xs border-bottom gap-2 cursor-pointer w-full',
            {
              'selected-node':
                activeDomain === DEFAULT_DOMAIN_VALUE &&
                selectedDomains.length === 0,
            }
          )}
          data-testid="all-domains-selector"
          direction="row"
          role="button"
          tabIndex={0}
          onClick={handleMyDomainsClick}
          onKeyDown={handleAllDomainKeyPress}>
          <DomainIcon height={20} name="domain" width={20} />
          <Typography
            className={classNames({
              'font-semibold':
                activeDomain === DEFAULT_DOMAIN_VALUE &&
                selectedDomains.length === 0,
            })}>
            {t('label.all-domain-plural')}
          </Typography>
        </Box>
      )}

      {treeContent}

      {isMultiple ? (
        <Box className="tw:mt-3 tw:justify-end" direction="row" gap={2}>
          <Button
            className="update-btn"
            color="primary"
            data-testid="saveAssociatedTag"
            isLoading={isSubmitLoading}
            type="submit"
            onClick={handleMultiDomainSave}>
            {t('label.update')}
          </Button>
          <Button
            color="secondary"
            data-testid="cancelAssociatedTag"
            onClick={onCancel}>
            {t('label.cancel')}
          </Button>
        </Box>
      ) : null}
    </div>
  );
};

export default DomainSelectablTree;
