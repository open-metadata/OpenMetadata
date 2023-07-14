/*
 *  Copyright 2023 Collate.
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
import { ENTITY_NAME_REGEX } from './regex.constants';

describe('Test Regex', () => {
  it('EntityName regex should pass for the valid entity name', () => {
    // Contains letters, numbers, and no special characters.
    expect(ENTITY_NAME_REGEX.test('HelloWorld123')).toEqual(true);

    // Contains letters, an underscore, and no special characters.
    expect(ENTITY_NAME_REGEX.test('Cypress_Test')).toEqual(true);

    // Contains letters and a hyphen.
    expect(ENTITY_NAME_REGEX.test('My-Website')).toEqual(true);

    // Contains letters, a period, and an uppercase letter.
    expect(ENTITY_NAME_REGEX.test('Open.AI')).toEqual(true);

    // Contains letters, a space, and an apostrophe.
    expect(ENTITY_NAME_REGEX.test("John's Cafe")).toEqual(true);

    // Contains letters, a space, an ampersand, and a period.
    expect(ENTITY_NAME_REGEX.test('ACME & Co.')).toEqual(true);

    // Contains letters, spaces, opening and closing parentheses.
    expect(ENTITY_NAME_REGEX.test('This (is) a test')).toEqual(true);

    // Contains Spanish characters
    expect(ENTITY_NAME_REGEX.test('Buenos días')).toEqual(true);
    expect(ENTITY_NAME_REGEX.test('Cómo estás')).toEqual(true);
    expect(ENTITY_NAME_REGEX.test('Háblame en español')).toEqual(true);
    expect(ENTITY_NAME_REGEX.test('Gracias')).toEqual(true);
    expect(ENTITY_NAME_REGEX.test('Hola mundo')).toEqual(true);
    expect(ENTITY_NAME_REGEX.test('áéíóú ÁÉÍÓÚ')).toEqual(true);

    // Contains Russian characters
    expect(ENTITY_NAME_REGEX.test('Привет мир')).toEqual(true);

    // Contains Greek characters
    expect(ENTITY_NAME_REGEX.test('Γειά σου κόσμε')).toEqual(true);

    // Contains Arabic characters
    expect(ENTITY_NAME_REGEX.test('مرحبا العالم')).toEqual(true);

    // Contains Hebrew characters
    expect(ENTITY_NAME_REGEX.test('שלום עולם')).toEqual(true);

    // Contains Chinese characters
    expect(ENTITY_NAME_REGEX.test('你好世界')).toEqual(true);

    // Contains Korean characters
    expect(ENTITY_NAME_REGEX.test('안녕하세요 세상')).toEqual(true);

    // Contains Japanese characters
    expect(ENTITY_NAME_REGEX.test('こんにちは世界')).toEqual(true);
  });

  it('EntityName regex should fail for the invalid entity name', () => {
    // Contains letters, numbers, and # special characters.
    expect(ENTITY_NAME_REGEX.test('HelloWorld123#')).toEqual(false);

    // Contains letters, numbers, and $ special characters.
    expect(ENTITY_NAME_REGEX.test('HelloWorld123$')).toEqual(false);

    // Contains letters, numbers, and ! special characters.
    expect(ENTITY_NAME_REGEX.test('HelloWorld123!')).toEqual(false);

    // Contains letters, numbers, and @ special characters.
    expect(ENTITY_NAME_REGEX.test('HelloWorld123@')).toEqual(false);

    // Contains letters, numbers, and * special characters.
    expect(ENTITY_NAME_REGEX.test('HelloWorld123*')).toEqual(false);

    // Contains letters, numbers, and special characters.
    expect(ENTITY_NAME_REGEX.test('!@#$%^&*()')).toEqual(false);

    // Contains spanish characters and special characters.
    expect(ENTITY_NAME_REGEX.test('¡Buenos días!')).toEqual(false);
    expect(ENTITY_NAME_REGEX.test('¿Cómo estás?')).toEqual(false);
  });
});
