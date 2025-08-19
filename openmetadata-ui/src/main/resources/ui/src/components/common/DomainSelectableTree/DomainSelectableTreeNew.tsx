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
import { Button, Empty, Space, Tree } from 'antd';
import { AxiosError } from 'axios';
import { debounce } from 'lodash';
import { FC, Key, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconDown } from '../../../assets/svg/ic-arrow-down.svg';
import { ReactComponent as IconRight } from '../../../assets/svg/ic-arrow-right.svg';
import { ReactComponent as ClosePopoverIcon } from '../../../assets/svg/ic-popover-close.svg';
import { ReactComponent as SavePopoverIcon } from '../../../assets/svg/ic-popover-save.svg';
import { DEBOUNCE_TIMEOUT } from '../../../constants/Lineage.constants';
import { EntityType } from '../../../enums/entity.enum';
import { Domain } from '../../../generated/entity/domains/domain';
import { EntityReference } from '../../../generated/tests/testCase';
import { listDomainHierarchy, searchDomains } from '../../../rest/domainAPI';
import {
    convertDomainsToTreeOptions,
    isDomainExist
} from '../../../utils/DomainUtils';
import { getEntityReferenceFromEntity } from '../../../utils/EntityUtils';
import { findItemByFqn } from '../../../utils/GlossaryUtils';
import {
    escapeESReservedCharacters,
    getEncodedFqn
} from '../../../utils/StringsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { Select } from '../AntdCompat';
import Loader from '../Loader/Loader';
import { TagRenderer } from '../TagRenderer/TagRenderer';
import './domain-selectable.less';
import {
    DomainSelectableTreeProps,
    TreeListItem
} from './DomainSelectableTree.interface';
;

const DomainSelectablTreeNew: FC<DomainSelectableTreeProps> = ({
  onSubmit,
  value,
  visible,
  onCancel,
  isMultiple = false,
  initialDomains,
  dropdownRef,
  handleDropdownChange,
}) => {
  const { t } = useTranslation();
  const [treeData, setTreeData] = useState<TreeListItem[]>([]);
  const [allDomains, setAllDomains] = useState<Domain[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [selectedDomains, setSelectedDomains] = useState<Domain[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const handleMultiDomainSave = async () => {
    const selectedFqns = selectedDomains
      .map((domain) => domain?.fullyQualifiedName)
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

  const handleSingleDomainSave = async () => {
    const selectedFqn = selectedDomains[0]?.fullyQualifiedName;
    const initialFqn = value?.[0];

    if (selectedFqn !== initialFqn) {
      setIsSubmitLoading(true);
      let retn: EntityReference[] = [];
      if (selectedDomains.length > 0) {
        const domain = getEntityReferenceFromEntity<Domain>(
          selectedDomains[0],
          EntityType.DOMAIN
        );
        retn = [domain];
      }
      await onSubmit(retn);
      setIsSubmitLoading(false);
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
          isDomainExist(domain, selectedDomain?.fullyQualifiedName ?? '')
        );
        if (!exists) {
          combinedData.push(selectedDomain as unknown as Domain);
        }
      });

      setTreeData(convertDomainsToTreeOptions(combinedData, 0, isMultiple));
      setAllDomains(combinedData);
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
          findItemByFqn(allDomains, item as string, false) as Domain
        );
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
        selectedData.push(
          findItemByFqn(allDomains, item as string, false) as Domain
        );
      }

      setSelectedDomains(selectedData);
    } else {
      const selected = checked.checked.map(
        (item) => findItemByFqn(allDomains, item as string, false) as Domain
      );

      setSelectedDomains(selected);
    }
  };

  const switcherIcon = useCallback(({ expanded }: { expanded?: boolean }) => {
    return expanded ? <IconDown /> : <IconRight />;
  }, []);

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
      } finally {
        setIsLoading(false);
      }
    } else {
      const updatedTreeData = convertDomainsToTreeOptions(
        allDomains,
        0,
        isMultiple
      );
      setTreeData(updatedTreeData);
    }
  }, DEBOUNCE_TIMEOUT);

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
        <Tree
          blockNode
          checkStrictly
          defaultExpandAll
          showLine
          autoExpandParent={Boolean(searchTerm)}
          checkable={isMultiple}
          className="domain-selectable-tree-new"
          defaultCheckedKeys={isMultiple ? value : []}
          defaultExpandedKeys={value}
          defaultSelectedKeys={isMultiple ? [] : value}
          multiple={isMultiple}
          switcherIcon={switcherIcon}
          treeData={treeData}
          onCheck={onCheck}
          onSelect={onSelect}
        />
      );
    }
  }, [isLoading, treeData, value, onSelect, isMultiple, searchTerm]);

  useEffect(() => {
    if (visible) {
      setSearchTerm('');
      fetchAPI();
    }
  }, [visible]);
  const handleSelectChange = (selectedFqns: string[]) => {
    const selectedData = selectedFqns.map(
      (fqn) => findItemByFqn(allDomains, fqn, false) as Domain
    );
    setSelectedDomains(selectedData);
  };
  useEffect(() => {
    if (initialDomains) {
      setSelectedDomains(initialDomains as unknown as Domain[]);
    } else if (value) {
      const selectedData = (value as string[]).map(
        (fqn) => findItemByFqn(allDomains, fqn, false) as Domain
      );
      setSelectedDomains(selectedData);
    }
  }, [initialDomains, value, allDomains]);

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
          options={allDomains.map((domain) => ({
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
