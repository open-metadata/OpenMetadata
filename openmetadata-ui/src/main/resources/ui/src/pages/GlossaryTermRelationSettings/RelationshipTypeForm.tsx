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

import {
  Checkbox,
  Input,
  Select,
  SelectItemType,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { Key, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Category,
  Characteristic,
  PaletteKey,
} from '../../generated/api/data/createRelationshipType';
import {
  CardinalityPreset,
  RelationshipTypeFormValues,
} from './RelationshipTypeForm.utils';

interface RelationshipTypeFormProps {
  errors: Record<string, string>;
  isEditing: boolean;
  values: RelationshipTypeFormValues;
  onChange: (values: RelationshipTypeFormValues) => void;
}

interface CharacteristicOption {
  id: Characteristic;
  label: string;
}

const RelationshipTypeForm = ({
  errors,
  isEditing,
  values,
  onChange,
}: RelationshipTypeFormProps) => {
  const { t } = useTranslation();

  const update = useCallback(
    <Field extends keyof RelationshipTypeFormValues>(
      field: Field,
      value: RelationshipTypeFormValues[Field]
    ) => onChange({ ...values, [field]: value }),
    [onChange, values]
  );

  const categoryOptions = useMemo<SelectItemType[]>(
    () => [
      { id: Category.Core, label: t('label.core') },
      { id: Category.OwlSkos, label: t('label.owl-skos') },
      { id: Category.Custom, label: t('label.custom-admin-defined') },
    ],
    [t]
  );

  const cardinalityOptions = useMemo<SelectItemType[]>(
    () => [
      { id: CardinalityPreset.OneToOne, label: t('label.one-to-one') },
      { id: CardinalityPreset.OneToMany, label: t('label.one-to-many') },
      { id: CardinalityPreset.ManyToOne, label: t('label.many-to-one') },
      { id: CardinalityPreset.ManyToMany, label: t('label.many-to-many') },
      { id: CardinalityPreset.Custom, label: t('label.custom') },
    ],
    [t]
  );

  const paletteOptions = useMemo<SelectItemType[]>(
    () => [
      { id: PaletteKey.Amber, label: t('label.color-yellow') },
      { id: PaletteKey.Blue, label: t('label.color-blue') },
      { id: PaletteKey.Gray, label: t('label.color-gray') },
      { id: PaletteKey.Green, label: t('label.color-green') },
      { id: PaletteKey.Indigo, label: t('label.color-dark-blue') },
      { id: PaletteKey.Pink, label: t('label.color-pink') },
      { id: PaletteKey.Purple, label: t('label.color-purple') },
      { id: PaletteKey.Rose, label: t('label.color-rose') },
      { id: PaletteKey.Teal, label: t('label.color-teal') },
      { id: PaletteKey.Violet, label: t('label.color-violet') },
    ],
    [t]
  );

  const characteristicOptions = useMemo<CharacteristicOption[]>(
    () => [
      { id: Characteristic.Symmetric, label: t('label.symmetric') },
      { id: Characteristic.Asymmetric, label: t('label.asymmetric') },
      { id: Characteristic.Transitive, label: t('label.transitive') },
      { id: Characteristic.Functional, label: t('label.functional') },
      {
        id: Characteristic.InverseFunctional,
        label: t('label.inverse-functional'),
      },
      { id: Characteristic.Reflexive, label: t('label.reflexive') },
      { id: Characteristic.Irreflexive, label: t('label.irreflexive') },
    ],
    [t]
  );

  const toggleCharacteristic = useCallback(
    (characteristic: Characteristic, selected: boolean) => {
      const current = values.characteristics ?? [];
      const characteristics = selected
        ? [...current, characteristic]
        : current.filter((value) => value !== characteristic);
      update('characteristics', characteristics);
    },
    [update, values.characteristics]
  );

  const updateCardinalityLimit = useCallback(
    (field: 'sourceMax' | 'targetMax', value: string) => {
      const parsedValue = value === '' ? undefined : Number(value);
      update('cardinality', {
        ...values.cardinality,
        [field]: parsedValue,
      });
    },
    [update, values.cardinality]
  );

  return (
    <div
      className="tw:flex tw:flex-col tw:gap-6"
      data-testid="relation-type-form">
      <Input
        data-testid="name-input"
        hint={errors.name}
        isDisabled={isEditing}
        isInvalid={Boolean(errors.name)}
        label={t('label.name')}
        value={values.name}
        onChange={(value) => update('name', value)}
      />
      <Input
        data-testid="display-name-input"
        hint={errors.displayName}
        isInvalid={Boolean(errors.displayName)}
        label={t('label.display-name')}
        value={values.displayName}
        onChange={(value) => update('displayName', value)}
      />
      <TextArea
        data-testid="description-input"
        label={t('label.description')}
        rows={3}
        value={values.description}
        onChange={(value) => update('description', value)}
      />
      <Select
        data-testid="category-select"
        items={categoryOptions}
        label={t('label.category')}
        value={values.category}
        onChange={(key: Key | null) => {
          const category = parseCategory(key);
          category && update('category', category);
        }}>
        {(item) => <Select.Item {...item} />}
      </Select>
      <Input
        data-testid="inverse-relation-input"
        label={t('label.inverse-relation')}
        tooltip={t('message.inverse-relation-tooltip')}
        value={values.inverse ?? ''}
        onChange={(value) => update('inverse', value || undefined)}
      />
      <Input
        data-testid="rdf-predicate-input"
        hint={errors.rdfPredicate}
        isInvalid={Boolean(errors.rdfPredicate)}
        label={t('label.rdf-predicate')}
        value={values.rdfPredicate}
        onChange={(value) => update('rdfPredicate', value)}
      />
      <Select
        data-testid="cardinality-select"
        items={cardinalityOptions}
        label={t('label.cardinality')}
        value={values.cardinalityPreset}
        onChange={(key: Key | null) => {
          const preset = parseCardinalityPreset(key);
          preset && update('cardinalityPreset', preset);
        }}>
        {(item) => <Select.Item {...item} />}
      </Select>
      {values.cardinalityPreset === CardinalityPreset.Custom ? (
        <div className="tw:grid tw:grid-cols-2 tw:gap-4">
          <Input
            data-testid="source-max-input"
            label={`${t('label.source')} ${t('label.max')}`}
            type="number"
            value={String(values.cardinality?.sourceMax ?? '')}
            onChange={(value) => updateCardinalityLimit('sourceMax', value)}
          />
          <Input
            data-testid="target-max-input"
            label={`${t('label.target')} ${t('label.max')}`}
            type="number"
            value={String(values.cardinality?.targetMax ?? '')}
            onChange={(value) => updateCardinalityLimit('targetMax', value)}
          />
        </div>
      ) : null}
      <Select
        data-testid="color-select"
        items={paletteOptions}
        label={t('label.color')}
        value={values.paletteKey}
        onChange={(key: Key | null) => {
          const palette = parsePaletteKey(key);
          palette && update('paletteKey', palette);
        }}>
        {(item) => <Select.Item {...item} />}
      </Select>
      <div className="tw:grid tw:grid-cols-2 tw:gap-3">
        {characteristicOptions.map((option) => (
          <Checkbox
            data-testid={`characteristic-${option.id}`}
            isSelected={values.characteristics?.includes(option.id)}
            key={option.id}
            label={option.label}
            size="sm"
            onChange={(selected) => toggleCharacteristic(option.id, selected)}
          />
        ))}
      </div>
      {errors.characteristics ? (
        <Typography className="tw:text-error-primary" size="text-xs">
          {errors.characteristics}
        </Typography>
      ) : null}
      <Checkbox
        data-testid="cross-glossary-switch"
        isSelected={values.crossGlossaryAllowed}
        label={t('label.cross-glossary')}
        size="sm"
        onChange={(selected) => update('crossGlossaryAllowed', selected)}
      />
    </div>
  );
};

const parseCategory = (key: Key | null): Category | undefined => {
  const value = String(key ?? '');
  const category = (() => {
    switch (value) {
      case Category.Core:
        return Category.Core;
      case Category.Custom:
        return Category.Custom;
      case Category.OwlSkos:
        return Category.OwlSkos;
      default:
        return undefined;
    }
  })();

  return category;
};

const parseCardinalityPreset = (
  key: Key | null
): CardinalityPreset | undefined => {
  const value = String(key ?? '');
  const preset = (() => {
    switch (value) {
      case CardinalityPreset.Custom:
        return CardinalityPreset.Custom;
      case CardinalityPreset.ManyToMany:
        return CardinalityPreset.ManyToMany;
      case CardinalityPreset.ManyToOne:
        return CardinalityPreset.ManyToOne;
      case CardinalityPreset.OneToMany:
        return CardinalityPreset.OneToMany;
      case CardinalityPreset.OneToOne:
        return CardinalityPreset.OneToOne;
      default:
        return undefined;
    }
  })();

  return preset;
};

const parsePaletteKey = (key: Key | null): PaletteKey | undefined => {
  const value = String(key ?? '');
  const palette = (() => {
    switch (value) {
      case PaletteKey.Amber:
        return PaletteKey.Amber;
      case PaletteKey.Blue:
        return PaletteKey.Blue;
      case PaletteKey.Gray:
        return PaletteKey.Gray;
      case PaletteKey.Green:
        return PaletteKey.Green;
      case PaletteKey.Indigo:
        return PaletteKey.Indigo;
      case PaletteKey.Pink:
        return PaletteKey.Pink;
      case PaletteKey.Purple:
        return PaletteKey.Purple;
      case PaletteKey.Rose:
        return PaletteKey.Rose;
      case PaletteKey.Teal:
        return PaletteKey.Teal;
      case PaletteKey.Violet:
        return PaletteKey.Violet;
      default:
        return undefined;
    }
  })();

  return palette;
};

export default RelationshipTypeForm;
