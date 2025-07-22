/*
 *  Copyright 2024 Collate.
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
import { getSanitizeContent } from './sanitize.utils';

describe('getSanitizeContent', () => {
  it('should sanitize the input 1', () => {
    const mockHtml = `<details/open/ontoggle=confirm('XSS')>`;
    const result = getSanitizeContent(mockHtml);

    expect(result).toBe(`<details open=""></details>`);
  });

  it('should sanitize the input 2', () => {
    const mockHtml = `<img src=x onerror=alert(1)//>`;
    const result = getSanitizeContent(mockHtml);

    expect(result).toBe(`<img src="x">`);
  });

  it('should sanitize the input 3', () => {
    const mockHtml = `<svg><g/onload=alert(2)//<p>`;
    const result = getSanitizeContent(mockHtml);

    expect(result).toBe(`<svg><g></g></svg>`);
  });

  it('should sanitize the input 4', () => {
    const mockHtml = `<p>abc<iframe//src=jAva&Tab;script:alert(3)>def</p>`;
    const result = getSanitizeContent(mockHtml);

    expect(result).toBe(`<p>abc</p>`);
  });

  describe('HTML Encoding Prevention', () => {
    it('should NOT encode entity links with HTML entities', () => {
      const input = '<#E::team::Accounting|@Accounting>';
      const result = getSanitizeContent(input);

      // Should NOT contain HTML encoded entities
      expect(result).not.toContain('&lt;');
      expect(result).not.toContain('&gt;');
      expect(result).not.toContain('&amp;');

      // Should contain the original entity link format
      expect(result).toBe('<#E::team::Accounting|@Accounting>');
    });

    it('should NOT encode multiple entity links with HTML entities', () => {
      const input =
        'Hello <#E::team::Accounting|@Accounting> and <#E::user::john.doe|@john.doe>';
      const result = getSanitizeContent(input);

      // Should NOT contain HTML encoded entities
      expect(result).not.toContain('&lt;');
      expect(result).not.toContain('&gt;');
      expect(result).not.toContain('&amp;');

      // Should contain the original entity link format
      expect(result).toBe(
        'Hello <#E::team::Accounting|@Accounting> and <#E::user::john.doe|@john.doe>'
      );
    });

    it('should NOT encode entity links even when mixed with HTML content', () => {
      const input =
        '<div>Hello</div><#E::team::Accounting|@Accounting><span>World</span>';
      const result = getSanitizeContent(input);

      // Should NOT contain HTML encoded entities for the entity link
      expect(result).not.toContain('&lt;#E::team::Accounting|@Accounting&gt;');
      expect(result).not.toContain(
        '&amp;lt;#E::team::Accounting|@Accounting&amp;gt;'
      );

      // Should contain the original entity link format
      expect(result).toContain('<#E::team::Accounting|@Accounting>');
    });
  });
});
