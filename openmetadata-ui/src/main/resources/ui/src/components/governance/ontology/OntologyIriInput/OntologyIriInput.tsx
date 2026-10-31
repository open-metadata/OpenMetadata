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
import { Input, Select } from '@openmetadata/ui-core-components';
import { useMemo, useState } from 'react';

interface OntologyIriInputProps {
  label: string;
  value: string;
  options?: ReadonlyArray<{ iri: string; label: string }>;
  isRequired?: boolean;
  onChange: (iri: string) => void;
}

const OntologyIriInput = ({
  label,
  value,
  options,
  isRequired,
  onChange,
}: OntologyIriInputProps) => {
  const [search, setSearch] = useState<string>();
  const selected = options?.find((option) => option.iri === value);
  const items = useMemo(() => {
    const query = search?.toLowerCase() ?? '';

    return (options ?? [])
      .filter(
        (option) =>
          !query ||
          option.label.toLowerCase().includes(query) ||
          option.iri.toLowerCase().includes(query)
      )
      .slice(0, 50)
      .map((option) => ({
        id: option.iri,
        label: option.label,
        supportingText: option.iri,
      }));
  }, [options, search]);

  if (!options?.length) {
    return (
      <Input
        isRequired={isRequired ?? false}
        label={label}
        value={value}
        onChange={onChange}
      />
    );
  }

  return (
    <Select.ComboBox
      allowsCustomValue
      inputValue={search ?? selected?.label ?? value}
      isRequired={isRequired ?? false}
      items={items}
      label={label}
      selectedKey={selected?.iri ?? null}
      onBlur={() => setSearch(undefined)}
      onInputChange={(text) => {
        setSearch(text);
        if (text !== selected?.label) {
          onChange(text);
        }
      }}
      onSelectionChange={(key) => {
        const option = options.find((entry) => entry.iri === key);
        if (option) {
          onChange(option.iri);
          setSearch(undefined);
        }
      }}>
      {(item) => (
        <Select.Item
          id={item.id}
          supportingText={item.supportingText}
          textValue={item.label}>
          {item.label}
        </Select.Item>
      )}
    </Select.ComboBox>
  );
};

export default OntologyIriInput;
