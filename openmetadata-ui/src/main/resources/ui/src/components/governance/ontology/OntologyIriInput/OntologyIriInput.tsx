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
import { KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isAbsoluteOntologyIri } from '../../../../utils/governance/ontology/OntologyAuthoring.utils';
import { OntologyIriOption } from './OntologyIriInput.types';
import {
  comboBoxLabelProps,
  fieldLabelProps,
  optionSupportingText,
} from './OntologyIriInput.utils';

interface OntologyIriInputProps {
  label: string;
  /** For a field in a row whose section heading already names it; the label stays as its accessible name. */
  hideLabel?: boolean;
  /** Options show only their name, not the context and IRI under it. */
  isNameOnly?: boolean;
  value: string;
  options?: ReadonlyArray<OntologyIriOption>;
  isRequired?: boolean;
  isDisabled?: boolean;
  hint?: string;
  error?: string;
  testId?: string;
  /** Options are still arriving; the list says so instead of looking empty. */
  isLoading?: boolean;
  onChange: (iri: string) => void;
  /** Enter with no option focused on an absolute IRI or a picked or resolved option. */
  onSubmit?: () => void;
  /** Enter or blur on text that is neither an option nor an absolute IRI, so a caller can show its error only now. */
  onInvalidCommit?: () => void;
}

const LOADING_KEY = '\u0000loading';

const OntologyIriInput = ({
  label,
  hideLabel,
  isNameOnly,
  value,
  options,
  isRequired,
  isDisabled,
  hint,
  error,
  testId,
  isLoading,
  onChange,
  onSubmit,
  onInvalidCommit,
}: OntologyIriInputProps) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState<string>();
  useEffect(() => {
    if (!value) {
      setSearch(undefined);
    }
  }, [value]);
  const selected = options?.find((option) => option.iri === value);
  const items = useMemo(() => {
    const query = search?.toLowerCase() ?? '';

    const matches = (options ?? [])
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
        supportingText: isNameOnly ? undefined : optionSupportingText(option),
      }));

    return isLoading
      ? [
          ...matches,
          { id: LOADING_KEY, label: t('label.loading'), supportingText: '' },
        ]
      : matches;
  }, [options, search, isLoading, isNameOnly, t]);
  const submitOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (
      event.key !== 'Enter' ||
      event.currentTarget.getAttribute('aria-activedescendant')
    ) {
      return;
    }
    const text = event.currentTarget.value.trim();
    if (text && !isAbsoluteOntologyIri(text) && !selected) {
      onInvalidCommit?.();

      return;
    }
    if (!onSubmit || !(selected || isAbsoluteOntologyIri(text))) {
      return;
    }
    event.preventDefault();
    onSubmit();
  };

  if (!options) {
    return (
      <Input
        {...fieldLabelProps(label, hideLabel)}
        data-testid={testId}
        hideRequiredIndicator={!isRequired}
        hint={error ?? hint}
        isDisabled={isDisabled}
        isInvalid={Boolean(error)}
        isRequired={isRequired ?? false}
        value={value}
        onChange={onChange}
      />
    );
  }

  return (
    <Select.ComboBox
      allowsCustomValue
      {...comboBoxLabelProps(label, hideLabel)}
      // The empty list tells an opened field there is nothing to pick; once the person types their
      // own IRI, "no match" is noise over the fields below, so the list closes instead.
      allowsEmptyCollection={!search}
      data-testid={testId}
      disabledKeys={isLoading ? [LOADING_KEY] : undefined}
      hint={error ?? hint}
      inputValue={search ?? selected?.label ?? value}
      isDisabled={isDisabled}
      isInvalid={Boolean(error)}
      isRequired={isRequired ?? false}
      items={items}
      selectedKey={selected?.iri ?? null}
      shortcut={false}
      onBlur={() => {
        setSearch(undefined);
        if (value.trim() && !selected && !isAbsoluteOntologyIri(value.trim())) {
          onInvalidCommit?.();
        }
      }}
      onInputChange={(text) => {
        setSearch(text);
        if (text === selected?.label) {
          return;
        }
        const label = text.trim().toLowerCase();
        const matches = (options ?? []).filter(
          (option) => option.label.toLowerCase() === label
        );
        onChange(matches.length === 1 ? matches[0].iri : text);
      }}
      onKeyDown={submitOnEnter}
      onSelectionChange={(key) => {
        const option = options?.find((entry) => entry.iri === key);
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
