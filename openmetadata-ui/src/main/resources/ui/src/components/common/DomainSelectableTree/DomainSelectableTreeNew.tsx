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
import AddIcon from '@mui/icons-material/Add';
import { Button as MUIButton, useTheme } from '@mui/material';
import { Button, Empty, Select, Space, Tree } from 'antd';
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
import {
  convertDomainsToTreeOptions,
  isDomainExist,
} from '../../../utils/DomainUtils';
import { getEntityReferenceFromEntity } from '../../../utils/EntityUtils';
import {
  escapeESReservedCharacters,
  getEncodedFqn,
} from '../../../utils/StringsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import Loader from '../Loader/Loader';
import { TagRenderer } from '../TagRenderer/TagRenderer';
import './domain-selectable.less';
import {
  DomainSelectableTreeProps,
  TreeListItem,
} from './DomainSelectableTree.interface';

const DomainSelectablTreeNew: FC<DomainSelectableTreeProps> = ({
  onSubmit,
  value,
  visible,
  onCancel,
  isMultiple = false,
  initialDomains,
  dropdownRef,
  handleDropdownChange,
  isClearable = true,
}) => {
  const theme = useTheme();
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
            <MUIButton
              startIcon={isLoadingMore ? null : <AddIcon />}
              sx={{
                p: 0,
                ml: 7,
                cursor: 'pointer',
                fontSize: '14px',
                color: theme.palette.primary.main,
                fontWeight: theme.typography.fontWeightMedium,
                textTransform: 'none',
                '&:hover': {
                  color: theme.palette.primary.dark,
                  backgroundColor: 'transparent',
                },
              }}
              variant="text"
              onClick={(e) => {
                e.stopPropagation();
                handleLoadMore?.(parentFqn);
              }}>
              {isLoadingMore ? <Loader size="small" /> : t('label.load-more')}
            </MUIButton>
          ),
        } as TreeListItem);
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
        <Empty
          description={t('label.no-entity-available', {
            entity: t('label.domain-plural'),
          })}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    } else {
      return (
        <div
          ref={scrollContainerRef}
          style={{ maxHeight: 200, overflowY: 'auto' }}
          onScroll={handleScroll}>
          <Tree
            blockNode
            checkStrictly
            showLine
            autoExpandParent={Boolean(searchTerm)}
            checkable={isMultiple}
            className="domain-selectable-tree-new"
            defaultCheckedKeys={isMultiple ? value : []}
            defaultSelectedKeys={isMultiple ? [] : value}
            loadData={searchTerm ? undefined : onLoadData}
            multiple={isMultiple}
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

  const handleSelectChange = (selectedFqns: string[]) => {
    const selectedData = selectedFqns
      .map((fqn) => domainMapper[fqn])
      .filter(Boolean);
    setSelectedDomains(selectedData);
  };

  useEffect(() => {
    if (initialDomains) {
      setSelectedDomains(initialDomains as unknown as Domain[]);
    } else if (value) {
      const selectedData = value
        .map((fqn) => domainMapper[fqn])
        .filter(Boolean);
      setSelectedDomains(selectedData);
    }
  }, [initialDomains, value, domainMapper]);

  return (
    <div data-testid="domain-selectable-tree" style={{ width: '339px' }}>
      <div style={{ borderRadius: '5px', width: '100px' }}>
        <Select
          className="custom-domain-edit-select"
          dropdownRender={() => treeContent}
          dropdownStyle={{ maxHeight: '200px' }}
          filterOption={false}
          maxTagCount={3}
          maxTagPlaceholder={(omittedValues) => (
            <span className="max-tag-text">
              {t('label.plus-count-more', { count: omittedValues.length })}
            </span>
          )}
          mode={isMultiple ? 'multiple' : undefined}
          options={domains.map((domain) => ({
            value: domain?.fullyQualifiedName,
            label: domain?.name,
          }))}
          placeholder="Select a domain"
          popupClassName="domain-custom-dropdown-class"
          ref={dropdownRef}
          tagRender={TagRenderer}
          value={
            selectedDomains
              ?.map((domain) => domain?.fullyQualifiedName)
              .filter(Boolean) as string[]
          }
          onChange={handleSelectChange}
          onDropdownVisibleChange={handleDropdownChange}
          onSearch={onSearch}
        />
      </div>
      <Space className="d-flex" size={8}>
        <Button
          className="profile-edit-save"
          data-testid="user-profile-domain-edit-save"
          icon={<ClosePopoverIcon height={24} />}
          size="small"
          style={{
            width: '30px',
            height: '30px',
            background: '#0950C5',
            position: 'absolute',
            bottom: '20px',
            right: '58px',
          }}
          type="primary"
          onClick={onCancel}
        />
        <Button
          className="profile-edit-cancel"
          data-testid="user-profile-domain-edit-cancel"
          icon={<SavePopoverIcon height={24} />}
          loading={isSubmitLoading}
          size="small"
          style={{
            width: '30px',
            height: '30px',
            background: '#0950C5',
            position: 'absolute',
            bottom: '20px',
            right: '20px',
          }}
          type="primary"
          onClick={isMultiple ? handleMultiDomainSave : handleSingleDomainSave}
        />
      </Space>
    </div>
  );
};

export default DomainSelectablTreeNew;
