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
import {
  ENTITY_NAME_REGEX,
  TAG_NAME_REGEX,
  TEST_CASE_NAME_REGEX,
} from './regex.constants';

describe('Test Regex', () => {
  it('EntityName regex should pass for the valid entity name', () => {
    // Contains letters, numbers, and no special characters.
    expect(ENTITY_NAME_REGEX.test('HelloWorld123')).toBe(true);

    // Contains letters, an underscore, and no special characters.
    expect(ENTITY_NAME_REGEX.test('Cypress_Test')).toBe(true);

    // Contains letters and a hyphen.
    expect(ENTITY_NAME_REGEX.test('My-Website')).toBe(true);

    // Contains letters, a period, and an uppercase letter.
    expect(ENTITY_NAME_REGEX.test('Open.AI')).toBe(true);

    // Contains letters, a space, and an apostrophe.
    expect(ENTITY_NAME_REGEX.test("John's Cafe")).toBe(true);

    // Contains letters, a space, an ampersand, and a period.
    expect(ENTITY_NAME_REGEX.test('ACME & Co.')).toBe(true);

    // Contains letters, spaces, opening and closing parentheses.
    expect(ENTITY_NAME_REGEX.test('This (is) a test')).toBe(true);

    // Contains Spanish characters
    expect(ENTITY_NAME_REGEX.test('Buenos días')).toBe(true);
    expect(ENTITY_NAME_REGEX.test('Cómo estás')).toBe(true);
    expect(ENTITY_NAME_REGEX.test('Háblame en español')).toBe(true);
    expect(ENTITY_NAME_REGEX.test('Gracias')).toBe(true);
    expect(ENTITY_NAME_REGEX.test('Hola mundo')).toBe(true);
    expect(ENTITY_NAME_REGEX.test('áéíóú ÁÉÍÓÚ')).toBe(true);

    // Contains Russian characters
    expect(ENTITY_NAME_REGEX.test('Привет мир')).toBe(true);

    // Contains Greek characters
    expect(ENTITY_NAME_REGEX.test('Γειά σου κόσμε')).toBe(true);

    // Contains Arabic characters
    expect(ENTITY_NAME_REGEX.test('مرحبا العالم')).toBe(true);

    // Contains Hebrew characters
    expect(ENTITY_NAME_REGEX.test('שלום עולם')).toBe(true);

    // Contains Chinese characters
    expect(ENTITY_NAME_REGEX.test('你好世界')).toBe(true);

    // Contains Korean characters
    expect(ENTITY_NAME_REGEX.test('안녕하세요 세상')).toBe(true);

    // Contains Japanese characters
    expect(ENTITY_NAME_REGEX.test('こんにちは世界')).toBe(true);

    // Contains Thai characters
    expect(ENTITY_NAME_REGEX.test('สวัสดีชาวโลก')).toBe(true);
    expect(ENTITY_NAME_REGEX.test('สวัสดี')).toBe(true);
    expect(ENTITY_NAME_REGEX.test('ที่อยู่')).toBe(true);
    expect(ENTITY_NAME_REGEX.test('พยัญชนะ')).toBe(true);
    expect(ENTITY_NAME_REGEX.test('ลูกค้า')).toBe(true);

    // Contains Vietnamese characters
    expect(ENTITY_NAME_REGEX.test('Xin chào thế giới')).toBe(true);
    expect(ENTITY_NAME_REGEX.test('Xin chào')).toBe(true);

    // Contains Hindi characters
    expect(ENTITY_NAME_REGEX.test('नमस्ते दुनिया')).toBe(true);
    expect(ENTITY_NAME_REGEX.test('नमस्ते')).toBe(true);

    // Contains Tamil characters
    expect(ENTITY_NAME_REGEX.test('வணக்கம் உலகம்')).toBe(true);
    expect(ENTITY_NAME_REGEX.test('வணக்கம்')).toBe(true);

    // Contains Marathi characters
    expect(ENTITY_NAME_REGEX.test('नमस्कार जग')).toBe(true);
    expect(ENTITY_NAME_REGEX.test('नमस्कार')).toBe(true);

    // Contains Bengali characters
    expect(ENTITY_NAME_REGEX.test('ওহে বিশ্ব')).toBe(true);
    expect(ENTITY_NAME_REGEX.test('ওহে')).toBe(true);

    // Contains Gujarati characters
    expect(ENTITY_NAME_REGEX.test('નમસ્તે વિશ્વ')).toBe(true);
    expect(ENTITY_NAME_REGEX.test('નમસ્તે')).toBe(true);

    // Contains Kannada characters
    expect(ENTITY_NAME_REGEX.test('ಹಲೋ ವಿಶ್ವ')).toBe(true);
    expect(ENTITY_NAME_REGEX.test('ಹಲೋ')).toBe(true);

    // Contains Malayalam characters
    expect(ENTITY_NAME_REGEX.test('ഹലോ ലോകം')).toBe(true);
    expect(ENTITY_NAME_REGEX.test('ഹലോ')).toBe(true);

    // Contains Punjabi characters
    expect(ENTITY_NAME_REGEX.test('ਹੈਲੋ ਵਰਲਡ')).toBe(true);
    expect(ENTITY_NAME_REGEX.test('ਹੈਲੋ')).toBe(true);

    // Contains Telugu characters
    expect(ENTITY_NAME_REGEX.test('హలో ప్రపంచం')).toBe(true);
    expect(ENTITY_NAME_REGEX.test('హలో')).toBe(true);

    // Contains Nepali characters
    expect(ENTITY_NAME_REGEX.test('नमस्कार संसार')).toBe(true);
    expect(ENTITY_NAME_REGEX.test('नमस्कार')).toBe(true);

    // Contains Urdu characters
    expect(ENTITY_NAME_REGEX.test('ہیلو دنیا')).toBe(true);
    expect(ENTITY_NAME_REGEX.test('ہیلو')).toBe(true);

    // Contains Filipino characters
    expect(ENTITY_NAME_REGEX.test('Kamusta mundo')).toBe(true);
    expect(ENTITY_NAME_REGEX.test('Kamusta')).toBe(true);

    // Contains Indonesian characters
    expect(ENTITY_NAME_REGEX.test('Halo dunia')).toBe(true);
    expect(ENTITY_NAME_REGEX.test('Halo')).toBe(true);

    // Contains Malay characters
    expect(ENTITY_NAME_REGEX.test('Helo dunia')).toBe(true);
    expect(ENTITY_NAME_REGEX.test('Helo')).toBe(true);

    // Contains Turkish characters
    expect(ENTITY_NAME_REGEX.test('Merhaba dünya')).toBe(true);
    expect(ENTITY_NAME_REGEX.test('Merhaba')).toBe(true);

    // Contains Italian characters
    expect(ENTITY_NAME_REGEX.test('Ciao mondo')).toBe(true);
    expect(ENTITY_NAME_REGEX.test('Ciao')).toBe(true);
    expect(ENTITY_NAME_REGEX.test('àèéìíîòóùú')).toBe(true);

    // Contains French characters
    expect(ENTITY_NAME_REGEX.test('Bonjour le monde')).toBe(true);
    expect(ENTITY_NAME_REGEX.test('Bonjour')).toBe(true);
    expect(ENTITY_NAME_REGEX.test('àâäéèêëîïôöùûüÿçœæ')).toBe(true);

    // Contains German characters
    expect(ENTITY_NAME_REGEX.test('Hallo Welt')).toBe(true);
    expect(ENTITY_NAME_REGEX.test('Hallo')).toBe(true);
    expect(ENTITY_NAME_REGEX.test('äöüÄÖÜß')).toBe(true);

    // Contains Portuguese characters
    expect(ENTITY_NAME_REGEX.test('Olá mundo')).toBe(true);
    expect(ENTITY_NAME_REGEX.test('Olá')).toBe(true);
  });

  it('EntityName regex should fail for the invalid entity name', () => {
    // conatines :: in the name should fail
    expect(ENTITY_NAME_REGEX.test('Hello::World')).toBe(false);
  });

  describe('TAG_NAME_REGEX', () => {
    it('should match English letters', () => {
      expect(TAG_NAME_REGEX.test('Hello')).toBe(true);
    });

    it('should match non-English letters', () => {
      expect(TAG_NAME_REGEX.test('こんにちは')).toBe(true);
    });

    it('should match combined characters', () => {
      expect(TAG_NAME_REGEX.test('é')).toBe(true);
    });

    it('should match numbers', () => {
      expect(TAG_NAME_REGEX.test('123')).toBe(true);
    });

    it('should match underscores', () => {
      expect(TAG_NAME_REGEX.test('_')).toBe(true);
    });

    it('should match hyphens', () => {
      expect(TAG_NAME_REGEX.test('-')).toBe(true);
    });

    it('should match spaces', () => {
      expect(TAG_NAME_REGEX.test(' ')).toBe(true);
    });

    it('should match periods', () => {
      expect(TAG_NAME_REGEX.test('.')).toBe(true);
    });

    it('should match ampersands', () => {
      expect(TAG_NAME_REGEX.test('&')).toBe(true);
    });

    it('should match parentheses', () => {
      expect(TAG_NAME_REGEX.test('()')).toBe(true);
    });

    it('should not match other special characters', () => {
      expect(TAG_NAME_REGEX.test('$')).toBe(false);
    });

    it('should not match empty string', () => {
      expect(TAG_NAME_REGEX.test('')).toBe(false);
    });
  });

  describe('TEST_CASE_NAME_REGEX', () => {
    it('should reject names with forbidden characters', () => {
      expect(TEST_CASE_NAME_REGEX.test('test::case')).toBe(false);
      expect(TEST_CASE_NAME_REGEX.test('test"case')).toBe(false);
      expect(TEST_CASE_NAME_REGEX.test('test>case')).toBe(false);
      expect(TEST_CASE_NAME_REGEX.test('test::case"name>invalid')).toBe(false);
    });

    it('should accept names with allowed characters', () => {
      expect(TEST_CASE_NAME_REGEX.test('table_column_count_equals')).toBe(true);
      expect(
        TEST_CASE_NAME_REGEX.test('shop_id.column_value_max_to_be_between')
      ).toBe(true);
      expect(TEST_CASE_NAME_REGEX.test('test case with spaces')).toBe(true);
      expect(TEST_CASE_NAME_REGEX.test('test_case_123')).toBe(true);
      expect(TEST_CASE_NAME_REGEX.test('TestCase-WithHyphens')).toBe(true);
      expect(TEST_CASE_NAME_REGEX.test('test.case.with.dots')).toBe(true);
      expect(TEST_CASE_NAME_REGEX.test('test_case_!@#$%^&*()')).toBe(true);
    });
  });
});
