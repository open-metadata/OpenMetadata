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
/*
 *  Copyright 2025 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */
import {
  Button,
  Card,
  Dropdown,
  Empty,
  Input,
  Space,
  TreeSelect,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import { debounce, isArray, isEmpty } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Classification } from '../../generated/entity/classification/classification';
import { Tag } from '../../generated/entity/classification/tag';
import { getAllClassifications, getTags } from '../../rest/tagAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import { SearchDropdownOption } from '../SearchDropdown/SearchDropdown.interface';

type Props = {
  label: string;
  selected: SearchDropdownOption[];
  onChange: (values: SearchDropdownOption[]) => void;
  triggerButtonSize?: 'large' | 'middle' | 'small';
};

type TreeNode = {
  title: string;
  value: string;
  key: string;
  isLeaf?: boolean;
  selectable?: boolean;
  children?: TreeNode[];
};

const fqnToPathLabel = (fqn: string) => fqn.split('.').join(' > ');

const QuickFilterClassificationTree = ({
  label,
  selected,
  onChange,
  triggerButtonSize = 'small',
}: Props) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [value, setValue] = useState<string[]>(() =>
    (selected ?? []).map((s) => s.key)
  );

  const fetchClassifications = async () => {
    setLoading(true);
    try {
      const { data } = await getAllClassifications({ limit: 50 });
      const nodes: TreeNode[] = data.map((c: Classification) => ({
        title: c.displayName || c.name,
        value: c.fullyQualifiedName || c.name,
        key: c.fullyQualifiedName || c.name,
        selectable: false,
        isLeaf: false,
      }));
      setTreeData(nodes);
    } catch (e) {
      showErrorToast(e as AxiosError);
    } finally {
      setLoading(false);
    }
  };

  const loadChildren = async (fqn: string) => {
    try {
      const { data } = await getTags({ parent: fqn, limit: 200 });
      const children: TreeNode[] = (data || []).map((t: Tag) => ({
        title: t.displayName || t.name,
        value: t.fullyQualifiedName || t.name,
        key: t.fullyQualifiedName || t.name,
        isLeaf: false, // may have deeper levels
      }));

      return children;
    } catch (e) {
      showErrorToast(e as AxiosError);

      return [] as TreeNode[];
    }
  };

  const onLoadData = async (node: any) => {
    const { key, children } = node;
    if (children && children.length) {
      return;
    }
    const kids = await loadChildren(key);
    setTreeData((prev) =>
      prev.map((n) => (n.key === key ? { ...n, children: kids } : n))
    );
  };

  useEffect(() => {
    if (open && isEmpty(treeData)) {
      fetchClassifications();
    }
  }, [open]);

  const handleSave = () => {
    const mapped: SearchDropdownOption[] = (value ?? []).map((k) => ({
      key: k,
      label: fqnToPathLabel(k),
    }));
    onChange(mapped);
    setOpen(false);
  };

  const debouncedSearch = useMemo(
    () =>
      debounce((v: string) => {
        setSearch(v);
      }, 400),
    []
  );

  const filteredTreeData = useMemo(() => {
    if (!search) {
      return treeData;
    }
    const lower = search.toLowerCase();
    const filterRec = (nodes: TreeNode[]): TreeNode[] =>
      nodes
        .map((n) => ({
          ...n,
          children: n.children ? filterRec(n.children) : n.children,
        }))
        .filter(
          (n) =>
            n.title.toLowerCase().includes(lower) ||
            n.value.toLowerCase().includes(lower) ||
            (n.children && n.children.length > 0)
        );

    return filterRec(treeData);
  }, [treeData, search]);

  const dropdown = (
    <Card bodyStyle={{ padding: 8 }} style={{ width: 340 }}>
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Input
          data-testid="classification-tree-search"
          placeholder={t('label.search-entity', {
            entity: t('label.tag-plural'),
          })}
          onChange={(e) => debouncedSearch(e.target.value)}
        />
        {loading ? null : isEmpty(treeData) ? (
          <Empty description={t('message.no-data-available')} />
        ) : (
          <TreeSelect
            treeCheckStrictly
            treeCheckable
            dropdownStyle={{ display: 'none' }}
            loadData={onLoadData as any}
            placeholder={t('label.select-entity', {
              entity: t('label.tag-plural'),
            })}
            showSearch={false}
            style={{ width: '100%' }}
            treeData={filteredTreeData}
            value={value}
            onChange={(v: any) => {
              const arr = (isArray(v) ? v : [v]) as any[];
              setValue(arr.map((x) => (typeof x === 'string' ? x : x.value)));
            }}
          />
        )}
        <Space>
          <Button size="small" type="primary" onClick={handleSave}>
            {t('label.update')}
          </Button>
          <Button size="small" type="link" onClick={() => setOpen(false)}>
            {t('label.close')}
          </Button>
        </Space>
      </Space>
    </Card>
  );

  return (
    <Dropdown
      destroyPopupOnHide
      dropdownRender={() => dropdown}
      open={open}
      trigger={['click']}
      onOpenChange={setOpen}>
      <Button size={triggerButtonSize}>
        <Space size={4}>
          <Typography.Text className="filters-label font-medium">
            {label}
          </Typography.Text>
          {value?.length ? (
            <Typography.Text className="text-primary font-medium">
              {value.length}
            </Typography.Text>
          ) : null}
        </Space>
      </Button>
    </Dropdown>
  );
};

export default QuickFilterClassificationTree;
