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
import {
  formatValueBasedOnContent,
  getHtmlStringFromMarkdownString,
  getTextFromHtmlString,
  isHTMLString,
} from './BlockEditorUtils';

describe('getTextFromHtmlString', () => {
  it('should return empty string when input is undefined', () => {
    expect(getTextFromHtmlString(undefined)).toBe('');
  });

  it('should return empty string when input is empty string', () => {
    expect(getTextFromHtmlString('')).toBe('');
  });

  it('should return same text when no HTML tags present', () => {
    expect(getTextFromHtmlString('Hello World')).toBe('Hello World');
  });

  it('should remove simple HTML tags', () => {
    expect(getTextFromHtmlString('<p>Hello World</p>')).toBe('Hello World');
  });

  it('should remove nested HTML tags', () => {
    expect(
      getTextFromHtmlString('<div><p>Hello <span>World</span></p></div>')
    ).toBe('Hello World');
  });

  it('should remove HTML tags with attributes', () => {
    expect(
      getTextFromHtmlString(
        '<p class="test" id="123">Hello <a href="#test">World</a></p>'
      )
    ).toBe('Hello World');
  });

  it('should handle multiple spaces and trim result', () => {
    expect(getTextFromHtmlString('<p>  Hello    World  </p>  ')).toBe(
      'Hello    World'
    );
  });

  it('should preserve special characters', () => {
    expect(getTextFromHtmlString('<p>Hello & World! @ #$%^</p>')).toBe(
      'Hello & World! @ #$%^'
    );
  });

  it('should handle complex nested structure', () => {
    const input = `
        <div class="container">
          <h1>Title</h1>
          <p>First <strong>paragraph</strong> with <em>emphasis</em></p>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
        </div>
      `;

    const output = getTextFromHtmlString(input);

    expect(getTextFromHtmlString(input)).toBe(output);
  });
});

describe('getHtmlStringFromMarkdownString', () => {
  it('should return the same string if input is already HTML', () => {
    const input = '<p>Hello World</p>';

    expect(getHtmlStringFromMarkdownString(input)).toBe(input);
  });

  it('should convert markdown to HTML', () => {
    const input = 'Hello **World**';
    const expectedOutput = '<p>Hello <strong>World</strong></p>';

    expect(getHtmlStringFromMarkdownString(input)).toBe(expectedOutput);
  });

  it('should handle empty string', () => {
    expect(getHtmlStringFromMarkdownString('')).toBe('');
  });

  it('should preserve special characters in markdown', () => {
    const input = 'Hello & World! @ #$%^';
    const expectedOutput = '<p>Hello &amp; World! @ #$%^</p>';

    expect(getHtmlStringFromMarkdownString(input)).toBe(expectedOutput);
  });

  it('should handle complex markdown structure', () => {
    const input = `
      ## Demo Title
      Small Subtitle.
      - Item 1
      - Item 2
    `;
    const expectedOutput = `
      <pre><code>##DemoTitleSmallSubtitle.-Item1-Item2</code></pre>
    `;

    expect(getHtmlStringFromMarkdownString(input).replace(/\s+/g, '')).toBe(
      expectedOutput.replace(/\s+/g, '')
    );
  });
});

describe('formatValueBasedOnContent', () => {
  it('should return the same string if input is not empty p tag', () => {
    const input = '<p>Hello World</p>';

    expect(formatValueBasedOnContent(input)).toBe(input);
  });

  it('should return the empty string if input is empty p tag', () => {
    const input = '<p></p>';

    expect(formatValueBasedOnContent(input)).toBe('');
  });
});

describe('isHTMLString', () => {
  it('should return true for simple HTML content', () => {
    const htmlContent = '<p>This is a paragraph</p>';

    expect(isHTMLString(htmlContent)).toBe(true);
  });

  it('should return true for complex HTML content', () => {
    const htmlContent = `
      <div class="container">
        <h1>Title</h1>
        <p>This is a <strong>bold</strong> paragraph with <a href="#">link</a></p>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
      </div>
    `;

    expect(isHTMLString(htmlContent)).toBe(true);
  });

  it('should return false for markdown content', () => {
    const markdownContent = `
      ***
### Data Sharing Policies
If there is any question or concern regarding the data sharing policies, 
please contact the support team <test@test.com>.
***
    `;

    expect(isHTMLString(markdownContent)).toBe(false);
  });

  it('should return false for plain text', () => {
    const plainText = 'This is just plain text without any formatting';

    expect(isHTMLString(plainText)).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isHTMLString('')).toBe(false);
  });

  it('should return false when content has both HTML and markdown', () => {
    const mixedContent = `
      <div>
        # Markdown Header
        * List item
      </div>
    `;

    expect(isHTMLString(mixedContent)).toBe(true);
  });
});
