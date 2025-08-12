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
import { Button, Dropdown, Space, Tooltip, Typography } from 'antd';
import { isArray } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TagSource } from '../../generated/type/tagLabel';
import { SearchDropdownOption } from '../SearchDropdown/SearchDropdown.interface';
import TagSelectForm from '../Tag/TagsSelectForm/TagsSelectForm.component';

type Props = {
  label: string;
  selected: SearchDropdownOption[];
  onChange: (values: SearchDropdownOption[]) => void;
  triggerButtonSize?: 'large' | 'middle' | 'small';
};

const QuickFilterGlossaryTree = ({
  label,
  selected,
  onChange,
  triggerButtonSize = 'small',
}: Props) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const initialValue = useMemo(() => {
    return (selected ?? []).map((s) => ({ value: s.key, label: s.label }));
  }, [selected]);

  const handleSubmit = async (values: any) => {
    const opts = (isArray(values) ? values : [values]) as {
      value: string;
      label: string;
    }[];
    const mapped: SearchDropdownOption[] = opts.map((v) => ({
      key: v.value,
      label: v.label,
    }));
    onChange(mapped);
    setOpen(false);
  };

  const handleCancel = () => setOpen(false);

  return (
    <Dropdown
      destroyPopupOnHide
      dropdownRender={() => (
        <div style={{ padding: 8, width: 320 }}>
          <TagSelectForm
            defaultValue={initialValue}
            filterOptions={[]}
            placeholder={t('label.search-entity', {
              entity: t('label.glossary-term-plural'),
            })}
            tagData={[]}
            tagType={TagSource.Glossary}
            onCancel={handleCancel}
            onSubmit={handleSubmit}
          />
        </div>
      )}
      open={open}
      trigger={['click']}
      onOpenChange={setOpen}>
      <Tooltip
        mouseLeaveDelay={0}
        overlayClassName={selected?.length ? '' : 'd-none'}
        placement="top"
        title={(selected ?? []).map((s) => s.label).join(', ')}>
        <Button size={triggerButtonSize}>
          <Space size={4}>
            <Typography.Text className="filters-label font-medium">
              {label}
            </Typography.Text>
            {selected?.length ? (
              <Typography.Text className="text-primary font-medium">
                {selected.map((s) => s.label).join(', ')}
              </Typography.Text>
            ) : null}
          </Space>
        </Button>
      </Tooltip>
    </Dropdown>
  );
};

export default QuickFilterGlossaryTree;
