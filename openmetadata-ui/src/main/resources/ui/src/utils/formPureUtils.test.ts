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
import { RJSFValidationError } from '@rjsf/utils';
import { transformErrors } from './formPureUtils';

const makeError = (
  name: string,
  property: string,
  params: Record<string, unknown>,
  message = 'default message'
): RJSFValidationError =>
  ({
    name,
    property,
    params,
    message,
    stack: message,
  } as unknown as RJSFValidationError);

const addDomElement = (id: string) => {
  const el = document.createElement('div');
  el.id = id;

  return document.body.appendChild(el);
};

describe('transformErrors', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('known error types — field present in DOM', () => {
    it('transforms the message for a minimum error when the field is in the DOM', () => {
      addDomElement('root/sampleDataCount');

      const errors = [makeError('minimum', '.sampleDataCount', { limit: 1 })];

      const result = transformErrors(errors);

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe('message.value-must-be-greater-than');
    });

    it('transforms the message for a maximum error when the field is in the DOM', () => {
      addDomElement('root/sampleDataCount');

      const errors = [
        makeError('maximum', '.sampleDataCount', { limit: 1000 }),
      ];

      const result = transformErrors(errors);

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe(
        'message.value-must-be-less-than-or-equal'
      );
    });

    // RJSF sets property to the missing property name for required errors
    // (see @rjsf/validator-ajv8 processRawValidationErrors.js line 61):
    //   property = property ? `${property}.${missingProperty}` : missingProperty
    it('transforms the message for a required error when the field is in the DOM', () => {
      addDomElement('root/name');

      const errors = [
        makeError('required', 'name', { missingProperty: 'name' }),
      ];

      const result = transformErrors(errors);

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe('message.field-text-is-required');
    });
  });

  describe('known error types — field NOT present in DOM (collapsed section)', () => {
    it('keeps a minimum error even when the field element is absent from the DOM', () => {
      // No element with id 'root/sampleDataCount' in the DOM
      expect(document.getElementById('root/sampleDataCount')).toBeNull();

      const errors = [makeError('minimum', '.sampleDataCount', { limit: 1 })];

      const result = transformErrors(errors);

      // The error must NOT be dropped — this is the hardening that prevents
      // collapsed sections from bypassing validation.
      expect(result).toHaveLength(1);
      // Message is not customised (field not in DOM) but the error is kept
      expect(result[0].message).toBe('default message');
    });

    it('keeps a maximum error even when the field element is absent from the DOM', () => {
      expect(document.getElementById('root/sampleDataCount')).toBeNull();

      const errors = [
        makeError('maximum', '.sampleDataCount', { limit: 1000 }),
      ];

      const result = transformErrors(errors);

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe('default message');
    });

    it('keeps a required error even when the field element is absent from the DOM', () => {
      expect(document.getElementById('root/name')).toBeNull();

      const errors = [
        makeError('required', 'name', { missingProperty: 'name' }),
      ];

      const result = transformErrors(errors);

      expect(result).toHaveLength(1);
    });
  });

  describe('unknown error types', () => {
    it('drops errors for unknown error types even when the field is in the DOM', () => {
      addDomElement('root/someField');

      const errors = [makeError('type', '.someField', { type: 'string' })];

      const result = transformErrors(errors);

      expect(result).toHaveLength(0);
    });

    it('drops errors for unknown error types when the field is not in the DOM', () => {
      const errors = [
        makeError('pattern', '.someField', { pattern: '^[a-z]+$' }),
      ];

      const result = transformErrors(errors);

      expect(result).toHaveLength(0);
    });
  });

  describe('mixed errors', () => {
    it('keeps known errors and drops unknown errors in the same batch', () => {
      addDomElement('root/confidence');

      const errors = [
        makeError('maximum', '.confidence', { limit: 1 }),
        makeError('type', '.confidence', { type: 'number' }),
        makeError('minimum', '.sampleDataCount', { limit: 1 }),
      ];

      const result = transformErrors(errors);

      // maximum (known, field in DOM) → kept with customised message
      // type (unknown) → dropped
      // minimum (known, field NOT in DOM) → kept with default message
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('maximum');
      expect(result[1].name).toBe('minimum');
    });
  });

  describe('nested property paths', () => {
    it('resolves the DOM id for nested properties starting with a dot', () => {
      addDomElement('root/nested/field');

      const errors = [makeError('minimum', '.nested.field', { limit: 0 })];

      const result = transformErrors(errors);

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe('message.value-must-be-greater-than');
    });

    it('keeps nested-property errors even when the field is not in the DOM', () => {
      const errors = [makeError('maximum', '.nested.field', { limit: 100 })];

      const result = transformErrors(errors);

      expect(result).toHaveLength(1);
    });
  });
});
