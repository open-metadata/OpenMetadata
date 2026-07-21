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
  Cardinality,
  Category,
  Characteristic,
  CreateRelationshipType,
  EntityStatus,
  PaletteKey,
} from '../../generated/api/data/createRelationshipType';
import {
  Category as EntityCategory,
  Characteristic as EntityCharacteristic,
  EntityStatus as RelationshipEntityStatus,
  PaletteKey as EntityPaletteKey,
  RelationshipType,
} from '../../generated/entity/data/relationshipType';

export enum CardinalityPreset {
  Custom = 'CUSTOM',
  ManyToMany = 'MANY_TO_MANY',
  ManyToOne = 'MANY_TO_ONE',
  OneToMany = 'ONE_TO_MANY',
  OneToOne = 'ONE_TO_ONE',
}

export interface RelationshipTypeFormValues extends CreateRelationshipType {
  cardinalityPreset: CardinalityPreset;
}

export const DEFAULT_RELATIONSHIP_TYPE_FORM: RelationshipTypeFormValues = {
  cardinalityPreset: CardinalityPreset.ManyToMany,
  category: Category.Custom,
  characteristics: [],
  crossGlossaryAllowed: true,
  description: '',
  displayName: '',
  name: '',
  paletteKey: PaletteKey.Violet,
  rdfPredicate: '',
};

export const toRelationshipTypeForm = (
  relationshipType: RelationshipType
): RelationshipTypeFormValues => ({
  cardinality: relationshipType.cardinality,
  cardinalityPreset: deriveCardinalityPreset(relationshipType.cardinality),
  category: toRequestCategory(relationshipType.category),
  characteristics: relationshipType.characteristics.map(
    toRequestCharacteristic
  ),
  crossGlossaryAllowed: relationshipType.crossGlossaryAllowed,
  description: relationshipType.description,
  disjointWith: relationshipType.disjointWith?.map(toReferenceName),
  displayName: relationshipType.displayName,
  domain: relationshipType.domain,
  entityStatus: toRequestEntityStatus(relationshipType.entityStatus),
  inverse: relationshipType.inverse
    ? toReferenceName(relationshipType.inverse)
    : undefined,
  iri: relationshipType.iri,
  name: relationshipType.name,
  owners: relationshipType.owners,
  paletteKey: toRequestPalette(relationshipType.paletteKey),
  propertyChain: relationshipType.propertyChain?.map(toReferenceName),
  range: relationshipType.range,
  rdfPredicate: relationshipType.rdfPredicate,
  replacedBy: relationshipType.replacedBy
    ? toReferenceName(relationshipType.replacedBy)
    : undefined,
  reviewers: relationshipType.reviewers,
});

export const toRelationshipTypeRequest = (
  form: RelationshipTypeFormValues
): CreateRelationshipType => ({
  cardinality: cardinalityForPreset(form),
  category: form.category,
  characteristics: form.characteristics,
  crossGlossaryAllowed: form.crossGlossaryAllowed,
  description: form.description.trim(),
  disjointWith: form.disjointWith,
  displayName: form.displayName.trim(),
  domain: form.domain,
  entityStatus: form.entityStatus,
  inverse: form.inverse || undefined,
  iri: form.iri || undefined,
  name: form.name.trim(),
  owners: form.owners,
  paletteKey: form.paletteKey,
  propertyChain: form.propertyChain,
  range: form.range,
  rdfPredicate: form.rdfPredicate.trim(),
  replacedBy: form.replacedBy,
  reviewers: form.reviewers,
});

export const deriveCardinalityPreset = (
  cardinality: Cardinality | undefined
): CardinalityPreset => {
  const sourceMax = cardinality?.sourceMax;
  const targetMax = cardinality?.targetMax;
  let preset = CardinalityPreset.Custom;

  if (sourceMax === undefined && targetMax === undefined) {
    preset = CardinalityPreset.ManyToMany;
  } else if (sourceMax === 1 && targetMax === 1) {
    preset = CardinalityPreset.OneToOne;
  } else if (sourceMax === undefined && targetMax === 1) {
    preset = CardinalityPreset.OneToMany;
  } else if (sourceMax === 1 && targetMax === undefined) {
    preset = CardinalityPreset.ManyToOne;
  }

  return preset;
};

export const cardinalityForPreset = (
  form: RelationshipTypeFormValues
): Cardinality | undefined => {
  const cardinality = (() => {
    switch (form.cardinalityPreset) {
      case CardinalityPreset.OneToOne:
        return { sourceMax: 1, targetMax: 1 };
      case CardinalityPreset.OneToMany:
        return { targetMax: 1 };
      case CardinalityPreset.ManyToOne:
        return { sourceMax: 1 };
      case CardinalityPreset.Custom:
        return form.cardinality;
      case CardinalityPreset.ManyToMany:
        return undefined;
    }
  })();

  return cardinality;
};

const toRequestCategory = (category: EntityCategory): Category => {
  const requestCategory = (() => {
    switch (category) {
      case EntityCategory.Core:
        return Category.Core;
      case EntityCategory.OwlSkos:
        return Category.OwlSkos;
      case EntityCategory.Custom:
        return Category.Custom;
    }
  })();

  return requestCategory;
};

const toRequestPalette = (palette: EntityPaletteKey): PaletteKey => {
  const requestPalette = (() => {
    switch (palette) {
      case EntityPaletteKey.Amber:
        return PaletteKey.Amber;
      case EntityPaletteKey.Blue:
        return PaletteKey.Blue;
      case EntityPaletteKey.Gray:
        return PaletteKey.Gray;
      case EntityPaletteKey.Green:
        return PaletteKey.Green;
      case EntityPaletteKey.Indigo:
        return PaletteKey.Indigo;
      case EntityPaletteKey.Pink:
        return PaletteKey.Pink;
      case EntityPaletteKey.Purple:
        return PaletteKey.Purple;
      case EntityPaletteKey.Rose:
        return PaletteKey.Rose;
      case EntityPaletteKey.Teal:
        return PaletteKey.Teal;
      case EntityPaletteKey.Violet:
        return PaletteKey.Violet;
    }
  })();

  return requestPalette;
};

const toRequestCharacteristic = (
  characteristic: EntityCharacteristic
): Characteristic => {
  const requestCharacteristic = (() => {
    switch (characteristic) {
      case EntityCharacteristic.Asymmetric:
        return Characteristic.Asymmetric;
      case EntityCharacteristic.Functional:
        return Characteristic.Functional;
      case EntityCharacteristic.InverseFunctional:
        return Characteristic.InverseFunctional;
      case EntityCharacteristic.Irreflexive:
        return Characteristic.Irreflexive;
      case EntityCharacteristic.Reflexive:
        return Characteristic.Reflexive;
      case EntityCharacteristic.Symmetric:
        return Characteristic.Symmetric;
      case EntityCharacteristic.Transitive:
        return Characteristic.Transitive;
    }
  })();

  return requestCharacteristic;
};

const toReferenceName = (reference: {
  fullyQualifiedName?: string;
  name?: string;
}): string => reference.fullyQualifiedName ?? reference.name ?? '';

const toRequestEntityStatus = (
  status: RelationshipEntityStatus | undefined
): EntityStatus | undefined => {
  const requestStatus = (() => {
    switch (status) {
      case RelationshipEntityStatus.Approved:
        return EntityStatus.Approved;
      case RelationshipEntityStatus.Archived:
        return EntityStatus.Archived;
      case RelationshipEntityStatus.Deprecated:
        return EntityStatus.Deprecated;
      case RelationshipEntityStatus.Draft:
        return EntityStatus.Draft;
      case RelationshipEntityStatus.InReview:
        return EntityStatus.InReview;
      case RelationshipEntityStatus.Rejected:
        return EntityStatus.Rejected;
      case RelationshipEntityStatus.Unprocessed:
        return EntityStatus.Unprocessed;
      case undefined:
        return undefined;
    }
  })();

  return requestStatus;
};
