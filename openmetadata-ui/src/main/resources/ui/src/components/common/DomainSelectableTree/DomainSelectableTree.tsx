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
import { Button, Empty, Space, Spin, Tree, Typography } from 'antd';
import Search from 'antd/lib/input/Search';
import { AxiosError } from 'axios';
import { debounce } from 'lodash';
import { FC, Key, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconDown } from '../../../assets/svg/ic-arrow-down.svg';
import { ReactComponent as IconRight } from '../../../assets/svg/ic-arrow-right.svg';
import { EntityType } from '../../../enums/entity.enum';
import { Domain } from '../../../generated/entity/domains/domain';
import { EntityReference } from '../../../generated/tests/testCase';
import { listDomainHierarchy, searchDomains } from '../../../rest/domainAPI';
import {
  convertDomainsToTreeOptions,
  isDomainExist,
} from '../../../utils/DomainUtils';
import { getEntityReferenceFromEntity } from '../../../utils/EntityUtils';
import { findItemByFqn } from '../../../utils/GlossaryUtils';
import {
  escapeESReservedCharacters,
  getEncodedFqn,
} from '../../../utils/StringsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import Loader from '../Loader/Loader';
import './domain-selectable.less';
import {
  DomainSelectableTreeProps,
  TreeListItem,
} from './DomainSelectableTree.interface';

import classNames from 'classnames';
import { ReactComponent as DomainIcon } from '../../../assets/svg/ic-domain.svg';
import { DEFAULT_DOMAIN_VALUE } from '../../../constants/constants';
import { useDomainStore } from '../../../hooks/useDomainStore';
const DomainSelectablTree: FC<DomainSelectableTreeProps> = ({
  onSubmit,
  value,
  visible,
  onCancel,
  isMultiple = false,
  initialDomains,
  showAllDomains = false,
}) => {
  const { t } = useTranslation();
  const [treeData, setTreeData] = useState<TreeListItem[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [selectedDomains, setSelectedDomains] = useState<Domain[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const { activeDomain } = useDomainStore();

  const handleMyDomainsClick = async () => {
    await onSubmit([]);
  };
  const handleMultiDomainSave = async () => {
    const selectedFqns = selectedDomains
      .map((domain) => domain.fullyQualifiedName)
      .sort((a, b) => (a ?? '').localeCompare(b ?? ''));
    const initialFqns = (value as string[]).sort((a, b) => a.localeCompare(b));

    if (JSON.stringify(selectedFqns) !== JSON.stringify(initialFqns)) {
      setIsSubmitLoading(true);
      const domains1 = selectedDomains.map((item) =>
        getEntityReferenceFromEntity<Domain>(item, EntityType.DOMAIN)
      );
      await onSubmit(domains1);
      setIsSubmitLoading(false);
    } else {
      onCancel();
    }
  };

  const handleSingleDomainSave = async (domains?: Domain[]) => {
    const availableDomains = domains ?? selectedDomains;
    const selectedFqn = availableDomains[0]?.fullyQualifiedName;
    const initialFqn = value?.[0];

    if (selectedFqn !== initialFqn) {
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
    } else {
      onCancel();
    }
  };

  const fetchAPI = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await listDomainHierarchy({ limit: 100 });

      const combinedData = [...data.data];
      initialDomains?.forEach((selectedDomain) => {
        const exists = combinedData.some((domain: Domain) =>
          isDomainExist(domain, selectedDomain.fullyQualifiedName ?? '')
        );
        if (!exists) {
          combinedData.push(selectedDomain as unknown as Domain);
        }
      });

      setTreeData(convertDomainsToTreeOptions(combinedData, 0, isMultiple));
      setDomains(combinedData);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, [initialDomains]);

  const onSelect = (selectedKeys: React.Key[]) => {
    if (!isMultiple) {
      const selectedData = [];
      for (const item of selectedKeys) {
        selectedData.push(
          findItemByFqn(domains, item as string, false) as Domain
        );
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
        selectedData.push(
          findItemByFqn(domains, item as string, false) as Domain
        );
      }

      setSelectedDomains(selectedData);
    } else {
      const selected = checked.checked.map(
        (item) => findItemByFqn(domains, item as string, false) as Domain
      );

      setSelectedDomains(selected);
    }
  };

  const onSearch = debounce(async (value: string) => {
    setSearchTerm(value);
    if (value) {
      try {
        setIsLoading(true);
        const encodedValue = getEncodedFqn(escapeESReservedCharacters(value));
        const results: Domain[] = await searchDomains(encodedValue);
        const updatedTreeData = convertDomainsToTreeOptions(
          results,
          0,
          isMultiple
        );
        setTreeData(updatedTreeData);
        setDomains(results);
      } finally {
        setIsLoading(false);
      }
    } else {
      fetchAPI();
    }
  }, 300);

  const switcherIcon = useCallback(({ expanded }: { expanded?: boolean }) => {
    return expanded ? <IconDown /> : <IconRight />;
  }, []);

  const treeContent = useMemo(() => {
    if (isLoading) {
      return <Loader />;
    } else if (treeData.length === 0) {
      return (
        <Empty
          description={t('label.no-entity-available', {
            entity: t('label.domain'),
          })}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    } else {
      return (
        <Spin indicator={<Loader size="small" />} spinning={isSubmitLoading}>
          <Tree
            blockNode
            checkStrictly
            defaultExpandAll
            showLine
            autoExpandParent={Boolean(searchTerm)}
            checkable={isMultiple}
            className="domain-selectable-tree"
            defaultCheckedKeys={isMultiple ? value : []}
            defaultExpandedKeys={value}
            defaultSelectedKeys={isMultiple ? [] : value}
            multiple={isMultiple}
            switcherIcon={switcherIcon}
            treeData={treeData}
            onCheck={onCheck}
            onSelect={onSelect}
          />
        </Spin>
      );
    }
  }, [isLoading, treeData, value, onSelect, isMultiple, searchTerm]);

  useEffect(() => {
    if (visible) {
      setSearchTerm('');
      fetchAPI();
    }
  }, [visible]);
  const handleAllDomainKeyPress = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // To pass Sonar test
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleMyDomainsClick();
    }
  };

  return (
    <div className="p-sm" data-testid="domain-selectable-tree">
      <Search
        data-testid="searchbar"
        placeholder="Search"
        style={{ marginBottom: 8 }}
        onChange={(e) => onSearch(e.target.value)}
      />

      {showAllDomains && (
        <div
          className={classNames(
            'all-domain-container d-flex items-center p-xs border-bottom gap-2 cursor-pointer',
            {
              'selected-node':
                activeDomain === DEFAULT_DOMAIN_VALUE &&
                selectedDomains.length === 0,
            }
          )}
          data-testid="all-domains-selector"
          role="button"
          tabIndex={0}
          onClick={handleMyDomainsClick}
          onKeyDown={handleAllDomainKeyPress}>
          <DomainIcon height={20} name="domain" width={20} />
          <Typography.Text
            className={classNames({
              'font-semibold':
                activeDomain === DEFAULT_DOMAIN_VALUE &&
                selectedDomains.length === 0,
            })}>
            {t('label.all-domain-plural')}
          </Typography.Text>
        </div>
      )}

      {treeContent}

      {isMultiple ? (
        <Space className="p-sm p-b-xss p-l-xs custom-dropdown-render" size={8}>
          <Button
            className="update-btn"
            data-testid="saveAssociatedTag"
            htmlType="submit"
            loading={isSubmitLoading}
            type="default"
            onClick={handleMultiDomainSave}>
            {t('label.update')}
          </Button>
          <Button
            data-testid="cancelAssociatedTag"
            type="default"
            onClick={onCancel}>
            {t('label.cancel')}
          </Button>
        </Space>
      ) : null}
    </div>
  );
};

export default DomainSelectablTree;
