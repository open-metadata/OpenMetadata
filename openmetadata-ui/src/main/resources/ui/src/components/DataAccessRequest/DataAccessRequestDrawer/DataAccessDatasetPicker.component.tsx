/*
 *  Copyright 2026 Collate.
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

import { Empty, Modal, Select, Spin } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { searchData } from '../../../rest/miscAPI';

interface DatasetOption {
  fqn: string;
  displayName: string;
  entityType: EntityType;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (option: DatasetOption) => void;
}

const DataAccessDatasetPicker = ({ open, onClose, onSelect }: Props) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<DatasetOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setOptions([]);
      return;
    }

    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await searchData(
          search,
          1,
          20,
          '',
          'updatedAt',
          'desc',
          [SearchIndex.TABLE, SearchIndex.DATA_PRODUCT]
        );
        if (cancelled) {
          return;
        }
        const hits =
          (res?.data?.hits?.hits as Array<{ _source: Record<string, unknown> }>) ?? [];
        setOptions(
          hits.map((hit) => ({
            fqn: String(hit._source.fullyQualifiedName ?? hit._source.name ?? ''),
            displayName: String(
              hit._source.displayName ?? hit._source.name ?? hit._source.fullyQualifiedName
            ),
            entityType: (hit._source.entityType as EntityType) ?? EntityType.TABLE,
          }))
        );
      } catch {
        if (!cancelled) {
          setOptions([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [open, search]);

  return (
    <Modal
      data-testid="dar-dataset-picker"
      footer={null}
      open={open}
      title={t('label.choose-a-dataset')}
      width={520}
      onCancel={onClose}>
      <Select
        autoFocus
        showSearch
        data-testid="dar-dataset-picker-select"
        filterOption={false}
        notFoundContent={loading ? <Spin size="small" /> : <Empty />}
        onSearch={setSearch}
        onSelect={(_value, option) => {
          const found = options.find((o) => o.fqn === option.value);
          if (found) {
            onSelect(found);
          }
        }}
        options={options.map((o) => ({
          label: `${o.displayName} (${o.entityType})`,
          value: o.fqn,
        }))}
        placeholder={t('label.search-by-type', {
          type: t('label.dataset'),
        })}
        style={{ width: '100%' }}
      />
    </Modal>
  );
};

export default DataAccessDatasetPicker;
