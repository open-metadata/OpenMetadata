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

import { TFunction } from 'i18next';
import {
  Cardinality,
  Characteristic,
} from '../../generated/api/data/createRelationshipType';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import {
  RelationshipTypeFormValues,
  toRelationshipTypeRequest,
} from './RelationshipTypeForm.utils';

const ENTITY_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9]*$/;
const ABSOLUTE_IRI_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:.+/;

export const validateRelationshipTypeForm = (
  form: RelationshipTypeFormValues,
  editing: RelationshipType | undefined,
  relationshipTypes: RelationshipType[],
  t: TFunction
): Record<string, string> => {
  const errors = {
    ...validateIdentity(form, editing, relationshipTypes, t),
    ...validateCharacteristics(form, t),
  };

  return errors;
};

const validateIdentity = (
  form: RelationshipTypeFormValues,
  editing: RelationshipType | undefined,
  relationshipTypes: RelationshipType[],
  t: TFunction
): Record<string, string> => {
  const errors: Record<string, string> = {};
  if (!ENTITY_NAME_PATTERN.test(form.name)) {
    errors.name = t('message.must-start-with-letter-alphanumeric');
  }
  if (!form.displayName.trim()) {
    errors.displayName = t('label.field-required', {
      field: t('label.display-name'),
    });
  }
  if (!ABSOLUTE_IRI_PATTERN.test(form.rdfPredicate)) {
    errors.rdfPredicate = t('message.invalid-url');
  }
  const duplicate = findPredicateConflict(
    form.rdfPredicate,
    editing,
    relationshipTypes
  );
  if (duplicate) {
    errors.rdfPredicate = t('message.rdf-predicate-already-used', {
      name: duplicate.displayName,
    });
  }

  return errors;
};

const findPredicateConflict = (
  rdfPredicate: string,
  editing: RelationshipType | undefined,
  relationshipTypes: RelationshipType[]
): RelationshipType | undefined => {
  const normalizedPredicate = rdfPredicate.trim();
  const duplicate = relationshipTypes.find(
    (relationshipType) =>
      relationshipType.id !== editing?.id &&
      relationshipType.rdfPredicate === normalizedPredicate
  );

  return duplicate;
};

const validateCharacteristics = (
  form: RelationshipTypeFormValues,
  t: TFunction
): Record<string, string> => {
  const characteristics = new Set(form.characteristics ?? []);
  const cardinality = toRelationshipTypeRequest(form).cardinality;
  const violation = getCharacteristicViolation(characteristics, cardinality);
  const errors: Record<string, string> = {};
  if (violation) {
    errors.characteristics = t(violation);
  }

  return errors;
};

const getCharacteristicViolation = (
  characteristics: Set<Characteristic>,
  cardinality: Cardinality | undefined
): string | undefined => {
  const violation = (() => {
    switch (true) {
      case hasOpposingSymmetry(characteristics):
        return 'message.incompatible-relationship-characteristics';
      case characteristics.has(Characteristic.Functional) &&
        cardinality?.sourceMax !== 1:
        return 'message.functional-relationship-cardinality';
      case characteristics.has(Characteristic.InverseFunctional) &&
        cardinality?.targetMax !== 1:
        return 'message.inverse-functional-relationship-cardinality';
      default:
        return undefined;
    }
  })();

  return violation;
};

const hasOpposingSymmetry = (characteristics: Set<Characteristic>): boolean =>
  characteristics.has(Characteristic.Symmetric) &&
  characteristics.has(Characteristic.Asymmetric);
