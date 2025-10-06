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

    // Contains Thai characters
    expect(ENTITY_NAME_REGEX.test('สวัสดีชาวโลก')).toEqual(true);
    expect(ENTITY_NAME_REGEX.test('สวัสดี')).toEqual(true);
    expect(ENTITY_NAME_REGEX.test('ที่อยู่')).toEqual(true);
    expect(ENTITY_NAME_REGEX.test('พยัญชนะ')).toEqual(true);
    expect(ENTITY_NAME_REGEX.test('ลูกค้า')).toEqual(true);

    // Contains Vietnamese characters
    expect(ENTITY_NAME_REGEX.test('Xin chào thế giới')).toEqual(true);
    expect(ENTITY_NAME_REGEX.test('Xin chào')).toEqual(true);

    // Contains Hindi characters
    expect(ENTITY_NAME_REGEX.test('नमस्ते दुनिया')).toEqual(true);
    expect(ENTITY_NAME_REGEX.test('नमस्ते')).toEqual(true);

    // Contains Tamil characters
    expect(ENTITY_NAME_REGEX.test('வணக்கம் உலகம்')).toEqual(true);
    expect(ENTITY_NAME_REGEX.test('வணக்கம்')).toEqual(true);

    // Contains Marathi characters
    expect(ENTITY_NAME_REGEX.test('नमस्कार जग')).toEqual(true);
    expect(ENTITY_NAME_REGEX.test('नमस्कार')).toEqual(true);

    // Contains Bengali characters
    expect(ENTITY_NAME_REGEX.test('ওহে বিশ্ব')).toEqual(true);
    expect(ENTITY_NAME_REGEX.test('ওহে')).toEqual(true);

    // Contains Gujarati characters
    expect(ENTITY_NAME_REGEX.test('નમસ્તે વિશ્વ')).toEqual(true);
    expect(ENTITY_NAME_REGEX.test('નમસ્તે')).toEqual(true);

    // Contains Kannada characters
    expect(ENTITY_NAME_REGEX.test('ಹಲೋ ವಿಶ್ವ')).toEqual(true);
    expect(ENTITY_NAME_REGEX.test('ಹಲೋ')).toEqual(true);

    // Contains Malayalam characters
    expect(ENTITY_NAME_REGEX.test('ഹലോ ലോകം')).toEqual(true);
    expect(ENTITY_NAME_REGEX.test('ഹലോ')).toEqual(true);

    // Contains Punjabi characters
    expect(ENTITY_NAME_REGEX.test('ਹੈਲੋ ਵਰਲਡ')).toEqual(true);
    expect(ENTITY_NAME_REGEX.test('ਹੈਲੋ')).toEqual(true);

    // Contains Telugu characters
    expect(ENTITY_NAME_REGEX.test('హలో ప్రపంచం')).toEqual(true);
    expect(ENTITY_NAME_REGEX.test('హలో')).toEqual(true);

    // Contains Nepali characters
    expect(ENTITY_NAME_REGEX.test('नमस्कार संसार')).toEqual(true);
    expect(ENTITY_NAME_REGEX.test('नमस्कार')).toEqual(true);

    // Contains Urdu characters
    expect(ENTITY_NAME_REGEX.test('ہیلو دنیا')).toEqual(true);
    expect(ENTITY_NAME_REGEX.test('ہیلو')).toEqual(true);

    // Contains Filipino characters
    expect(ENTITY_NAME_REGEX.test('Kamusta mundo')).toEqual(true);
    expect(ENTITY_NAME_REGEX.test('Kamusta')).toEqual(true);

    // Contains Indonesian characters
    expect(ENTITY_NAME_REGEX.test('Halo dunia')).toEqual(true);
    expect(ENTITY_NAME_REGEX.test('Halo')).toEqual(true);

    // Contains Malay characters
    expect(ENTITY_NAME_REGEX.test('Helo dunia')).toEqual(true);
    expect(ENTITY_NAME_REGEX.test('Helo')).toEqual(true);

    // Contains Turkish characters
    expect(ENTITY_NAME_REGEX.test('Merhaba dünya')).toEqual(true);
    expect(ENTITY_NAME_REGEX.test('Merhaba')).toEqual(true);

    // Contains Italian characters
    expect(ENTITY_NAME_REGEX.test('Ciao mondo')).toEqual(true);
    expect(ENTITY_NAME_REGEX.test('Ciao')).toEqual(true);
    expect(ENTITY_NAME_REGEX.test('àèéìíîòóùú')).toEqual(true);

    // Contains French characters
    expect(ENTITY_NAME_REGEX.test('Bonjour le monde')).toEqual(true);
    expect(ENTITY_NAME_REGEX.test('Bonjour')).toEqual(true);
    expect(ENTITY_NAME_REGEX.test('àâäéèêëîïôöùûüÿçœæ')).toEqual(true);

    // Contains German characters
    expect(ENTITY_NAME_REGEX.test('Hallo Welt')).toEqual(true);
    expect(ENTITY_NAME_REGEX.test('Hallo')).toEqual(true);
    expect(ENTITY_NAME_REGEX.test('äöüÄÖÜß')).toEqual(true);

    // Contains Portuguese characters
    expect(ENTITY_NAME_REGEX.test('Olá mundo')).toEqual(true);
    expect(ENTITY_NAME_REGEX.test('Olá')).toEqual(true);
  });

  it('EntityName regex should fail for the invalid entity name', () => {
    // conatines :: in the name should fail
    expect(ENTITY_NAME_REGEX.test('Hello::World')).toEqual(false);
  });

  describe('TAG_NAME_REGEX', () => {
    it('should match English letters', () => {
      expect(TAG_NAME_REGEX.test('Hello')).toEqual(true);
    });

    it('should match non-English letters', () => {
      expect(TAG_NAME_REGEX.test('こんにちは')).toEqual(true);
    });

    it('should match combined characters', () => {
      expect(TAG_NAME_REGEX.test('é')).toEqual(true);
    });

    it('should match numbers', () => {
      expect(TAG_NAME_REGEX.test('123')).toEqual(true);
    });

    it('should match underscores', () => {
      expect(TAG_NAME_REGEX.test('_')).toEqual(true);
    });

    it('should match hyphens', () => {
      expect(TAG_NAME_REGEX.test('-')).toEqual(true);
    });

    it('should match spaces', () => {
      expect(TAG_NAME_REGEX.test(' ')).toEqual(true);
    });

    it('should match periods', () => {
      expect(TAG_NAME_REGEX.test('.')).toEqual(true);
    });

    it('should match ampersands', () => {
      expect(TAG_NAME_REGEX.test('&')).toEqual(true);
    });

    it('should match parentheses', () => {
      expect(TAG_NAME_REGEX.test('()')).toEqual(true);
    });

    it('should not match other special characters', () => {
      expect(TAG_NAME_REGEX.test('$')).toEqual(false);
    });

    it('should not match empty string', () => {
      expect(TAG_NAME_REGEX.test('')).toEqual(false);
    });
  });

  describe('TEST_CASE_NAME_REGEX', () => {
    it('should reject names with forbidden characters', () => {
      expect(TEST_CASE_NAME_REGEX.test('test::case')).toEqual(false);
      expect(TEST_CASE_NAME_REGEX.test('test"case')).toEqual(false);
      expect(TEST_CASE_NAME_REGEX.test('test>case')).toEqual(false);
      expect(TEST_CASE_NAME_REGEX.test('test::case"name>invalid')).toEqual(
        false
      );
    });

    it('should accept names with allowed characters', () => {
      expect(TEST_CASE_NAME_REGEX.test('table_column_count_equals')).toEqual(
        true
      );
      expect(
        TEST_CASE_NAME_REGEX.test('shop_id.column_value_max_to_be_between')
      ).toEqual(true);
      expect(TEST_CASE_NAME_REGEX.test('test case with spaces')).toEqual(true);
      expect(TEST_CASE_NAME_REGEX.test('test_case_123')).toEqual(true);
      expect(TEST_CASE_NAME_REGEX.test('TestCase-WithHyphens')).toEqual(true);
      expect(TEST_CASE_NAME_REGEX.test('test.case.with.dots')).toEqual(true);
      expect(TEST_CASE_NAME_REGEX.test('test_case_!@#$%^&*()')).toEqual(true);
    });
  });
});
