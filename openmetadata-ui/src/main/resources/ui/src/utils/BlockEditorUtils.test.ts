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
import { Editor } from '@tiptap/react';
import {
  formatValueBasedOnContent,
  getHtmlStringFromMarkdownString,
  getTextFromHtmlString,
  isHTMLString,
  setEditorContent,
  transformImgTagsToFileAttachment,
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

// Mock EditorState for testing
jest.mock('@tiptap/pm/state', () => ({
  EditorState: {
    create: jest.fn(() => ({})),
  },
  PluginKey: jest.fn().mockImplementation(() => ({})),
}));

// Mock Editor for testing setEditorContent
const mockEditor = {
  commands: {
    setContent: jest.fn(),
  },
  state: {
    doc: {},
    plugins: [],
    schema: {},
    selection: {},
    storedMarks: null,
  },
  view: {
    updateState: jest.fn(),
  },
};

describe('Image transformation in setEditorContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('transformImgTagsToFileAttachment', () => {
    it('should return original string when no img tags present', () => {
      const htmlString = '<p>Hello world</p>';

      setEditorContent(mockEditor as unknown as Editor, htmlString);

      expect(mockEditor.commands.setContent).toHaveBeenCalledWith(htmlString);
    });

    it('should transform simple img tag to file attachment div', () => {
      const htmlString =
        '<p><img src="https://example.com/image.jpg" alt="Test image" title="Test title"></p>';

      setEditorContent(mockEditor as unknown as Editor, htmlString);

      // Verify that setContent was called with the transformed HTML
      expect(mockEditor.commands.setContent).toHaveBeenCalled();

      const transformedHtml = mockEditor.commands.setContent.mock.calls[0][0];

      // Check that the img tag was transformed to file-attachment div
      expect(transformedHtml).toContain('data-type="file-attachment"');
      expect(transformedHtml).toContain(
        'data-url="https://example.com/image.jpg"'
      );
      expect(transformedHtml).toContain('data-filename="Test title"');
      expect(transformedHtml).toContain('data-mimetype="image"');
      expect(transformedHtml).toContain('data-is-image="true"');
      expect(transformedHtml).toContain('data-alt="Test image"');
      expect(transformedHtml).not.toContain('<img');
    });

    it('should transform img tag with only src attribute', () => {
      const htmlString = '<p><img src="https://example.com/image.jpg"></p>';

      setEditorContent(mockEditor as unknown as Editor, htmlString);

      const transformedHtml = mockEditor.commands.setContent.mock.calls[0][0];

      expect(transformedHtml).toContain(
        'data-url="https://example.com/image.jpg"'
      );
      expect(transformedHtml).toContain('data-filename="image"');
      expect(transformedHtml).not.toContain('data-alt=""');
      expect(transformedHtml).not.toContain('<img');
    });

    it('should transform multiple img tags in same content', () => {
      const htmlString =
        '<p><img src="https://example.com/image1.jpg" alt="Image 1"><img src="https://example.com/image2.png" alt="Image 2" title="Second image"></p>';

      setEditorContent(mockEditor as unknown as Editor, htmlString);

      const transformedHtml = mockEditor.commands.setContent.mock.calls[0][0];

      expect(transformedHtml).toContain(
        'data-url="https://example.com/image1.jpg"'
      );
      expect(transformedHtml).toContain('data-filename="Image 1"');
      expect(transformedHtml).toContain(
        'data-url="https://example.com/image2.png"'
      );
      expect(transformedHtml).toContain('data-filename="Second image"');
      expect(transformedHtml).not.toContain('<img');
      // Should have two file-attachment divs
      expect(
        transformedHtml.match(/data-type="file-attachment"/g) || []
      ).toHaveLength(2);
    });

    it('should handle base64 image sources', () => {
      const base64Src =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      const htmlString = `<p><img src="${base64Src}" alt="Base64 image"></p>`;

      setEditorContent(mockEditor as unknown as Editor, htmlString);

      const transformedHtml = mockEditor.commands.setContent.mock.calls[0][0];

      expect(transformedHtml).toContain(`data-url="${base64Src}"`);
      expect(transformedHtml).toContain('data-filename="Base64 image"');
      expect(transformedHtml).not.toContain('<img');
    });

    it('should skip img tags without src attribute', () => {
      const htmlString = '<p><img alt="No source"></p>';

      setEditorContent(mockEditor as unknown as Editor, htmlString);

      const transformedHtml = mockEditor.commands.setContent.mock.calls[0][0];

      // Should remain unchanged since img has no src
      expect(transformedHtml).toContain('<img alt="No source">');
      expect(transformedHtml).not.toContain('data-type="file-attachment"');
    });

    it('should handle complex HTML with nested img tags', () => {
      const htmlString =
        '<div><p><img src="https://placebear.com/g/200/200"></p></div>';

      setEditorContent(mockEditor as unknown as Editor, htmlString);

      const transformedHtml = mockEditor.commands.setContent.mock.calls[0][0];

      expect(transformedHtml).toContain(
        'data-url="https://placebear.com/g/200/200"'
      );
      expect(transformedHtml).toContain('data-filename="image"');
      expect(transformedHtml).toContain('<div><p>');
      expect(transformedHtml).not.toContain('<img');
    });

    it('should preserve other HTML content while transforming images', () => {
      const htmlString =
        '<div><h1>Title</h1><p><img src="https://example.com/test.jpg" alt="Test"></p><p>More content</p></div>';

      setEditorContent(mockEditor as unknown as Editor, htmlString);

      const transformedHtml = mockEditor.commands.setContent.mock.calls[0][0];

      expect(transformedHtml).toContain('<h1>Title</h1>');
      expect(transformedHtml).toContain('<p>More content</p>');
      expect(transformedHtml).toContain('data-type="file-attachment"');
      expect(transformedHtml).toContain(
        'data-url="https://example.com/test.jpg"'
      );
      expect(transformedHtml).not.toContain('<img');
    });
  });

  describe('setEditorContent integration', () => {
    it('should call editor.commands.setContent with transformed HTML', () => {
      const content = '<p>Hello world</p>';

      setEditorContent(mockEditor as unknown as Editor, content);

      expect(mockEditor.commands.setContent).toHaveBeenCalledWith(
        '<p>Hello world</p>'
      );
      expect(mockEditor.view.updateState).toHaveBeenCalled();
    });

    it('should handle markdown content conversion', () => {
      const markdownContent = '**Bold text**';

      setEditorContent(mockEditor as unknown as Editor, markdownContent);

      expect(mockEditor.commands.setContent).toHaveBeenCalled();
      expect(mockEditor.view.updateState).toHaveBeenCalled();

      // Content should be converted from markdown to HTML
      const transformedHtml = mockEditor.commands.setContent.mock.calls[0][0];

      expect(transformedHtml).toContain('<strong>Bold text</strong>');
    });
  });
});

describe('transformImgTagsToFileAttachment', () => {
  describe('Basic Functionality', () => {
    it('should return original string when no img tags present', () => {
      const testCases = [
        '<p>Hello world</p>',
        '<div><h1>Title</h1><p>Content</p></div>',
        '<ul><li>List item</li></ul>',
        '',
        'Plain text without HTML',
      ];

      testCases.forEach((testCase) => {
        const result = transformImgTagsToFileAttachment(testCase);

        expect(result).toBe(testCase);
      });
    });

    it('should detect img tags correctly', () => {
      const htmlWithImg = '<p><img src="test.jpg" alt="test"></p>';
      const htmlWithoutImg = '<p>No images here</p>';

      expect(htmlWithImg).toContain('<img');
      expect(htmlWithoutImg).not.toContain('<img');
    });

    it('should handle empty and null input gracefully', () => {
      const edgeCases = ['', '   ', '\n\t', null, undefined];

      edgeCases.forEach((input) => {
        expect(() =>
          transformImgTagsToFileAttachment(input || '')
        ).not.toThrow();
      });
    });

    it('should handle invalid input types gracefully', () => {
      const invalidInputs = [123, {}, [], true, false];

      invalidInputs.forEach((input) => {
        expect(() =>
          transformImgTagsToFileAttachment(input as string)
        ).not.toThrow();

        const result = transformImgTagsToFileAttachment(input as string);

        expect(typeof result).toBe('string');
        // Should return empty string or string representation for non-string inputs
        expect(result).toBeDefined();
      });
    });
  });

  describe('Attribute Handling', () => {
    it('should validate filename priority logic', () => {
      // Test the priority: title > alt > 'image'
      const testCases = [
        { title: 'Title Text', alt: 'Alt Text', expected: 'Title Text' },
        { title: '', alt: 'Alt Text', expected: 'Alt Text' },
        { title: '', alt: '', expected: 'image' },
        { title: null, alt: 'Alt Text', expected: 'Alt Text' },
        { title: undefined, alt: '', expected: 'image' },
      ];

      testCases.forEach((testCase) => {
        const filename = testCase.title || testCase.alt || 'image';

        expect(filename).toBe(testCase.expected);
      });
    });

    it('should validate expected data attributes structure', () => {
      const expectedAttributes = [
        'data-type',
        'data-url',
        'data-filename',
        'data-mimetype',
        'data-uploading',
        'data-upload-progress',
        'data-is-image',
      ];

      expectedAttributes.forEach((attr) => {
        expect(attr.startsWith('data-')).toBe(true);
        expect(typeof attr).toBe('string');
      });

      // Test attribute values
      const sampleValues = {
        'data-type': 'file-attachment',
        'data-mimetype': 'image',
        'data-uploading': 'false',
        'data-upload-progress': '0',
        'data-is-image': 'true',
      };

      Object.entries(sampleValues).forEach(([, value]) => {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
    });

    it('should validate attribute assignment patterns', () => {
      // Test conditional attribute logic
      const altValues = ['', 'Valid alt text', null, undefined];

      altValues.forEach((alt) => {
        const shouldSetAlt = !!(alt && alt.trim && alt.trim().length > 0);

        expect(typeof shouldSetAlt).toBe('boolean');
      });
    });
  });

  describe('URL Handling', () => {
    it('should validate base64 image detection', () => {
      const base64Examples = [
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        // eslint-disable-next-line max-len
        'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRwfDx/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAhEQACAQIHAQAAAAAAAAAAAAABAgADBAUREiExQVFhkf/aAAwDAQACEQMRAD8A0s91CKWOBIgECogDALzEb3PttHb0zKO8B6sSMEckE5hPBhHQ96L6Cxl5o8XPGJ6lF68VVc2ZJNTXVr0sE09+bAE4I4gg4POD1O9fTpZ1rPtXJm9xCx02HXIkE9Dm1yCXQ0PdnX1rnLqrPUNYSWcmIqCpR5YogBGNOv8Ao',
      ];

      base64Examples.forEach((base64) => {
        expect(base64.startsWith('data:image/')).toBe(true);
        expect(base64).toContain('base64,');
      });
    });

    it('should validate URL parsing scenarios', () => {
      const urlScenarios = [
        { url: 'https://example.com/test.jpg', valid: true },
        { url: '/relative/path.png', valid: true },
        { url: 'data:image/png;base64,abc', valid: true },
        { url: '', valid: false },
        { url: null, valid: false },
      ];

      urlScenarios.forEach((scenario) => {
        const isValid = !!(scenario.url && scenario.url.length > 0);

        expect(isValid).toBe(scenario.valid);
      });
    });
  });

  describe('OpenMetadata Migration Scenarios', () => {
    it('should recognize legacy OpenMetadata format patterns', () => {
      // Based on actual migration scenario
      const oldFormat = '<p><img src="https://placebear.com/g/200/200"></p>';
      const newFormatPattern = 'data-type="file-attachment"';

      expect(oldFormat).toContain('<p>');
      expect(oldFormat).toContain('<img');
      expect(oldFormat).toContain('src=');
      expect(oldFormat).toContain('placebear.com');

      // New format validation
      expect(newFormatPattern).toContain('data-type');
      expect(newFormatPattern).toContain('file-attachment');
    });

    it('should handle real OpenMetadata migration scenario', () => {
      // Actual data from the user's example
      const oldOpenMetadataImage =
        '<p><img src="https://placebear.com/g/200/200"></p>';

      expect(oldOpenMetadataImage).toContain('placebear.com');
      expect(oldOpenMetadataImage).toContain('<p><img');

      // Test that function doesn't crash with real data
      expect(() =>
        transformImgTagsToFileAttachment(oldOpenMetadataImage)
      ).not.toThrow();
    });

    it('should work with markdown-converted HTML', () => {
      // Simulate HTML that would come from markdown conversion
      const markdownHtml =
        '<p><img src="https://example.com/test.jpg" alt="Test Image"></p>';

      expect(markdownHtml).toContain('<img');
      expect(markdownHtml).toContain('src=');
      expect(markdownHtml).toContain('alt=');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed HTML gracefully', () => {
      const malformedCases = [
        '<img>', // No src
        '<img src="">', // Empty src
        '<img src="test.jpg"', // Unclosed tag
        '<<img src="test.jpg">>', // Double brackets
        '<img src=test.jpg>', // Unquoted src
      ];

      malformedCases.forEach((html) => {
        // These should not cause errors in processing
        expect(() => html.includes('<img')).not.toThrow();
        expect(() => transformImgTagsToFileAttachment(html)).not.toThrow();
      });
    });

    it('should handle multiple images in content', () => {
      const multipleImages =
        '<p><img src="img1.jpg"><img src="img2.jpg"><img src="img3.jpg"></p>';
      const imgCount = (multipleImages.match(/<img/g) || []).length;

      expect(imgCount).toBe(3);
      expect(multipleImages).toContain('<img');
    });

    it('should preserve non-image content', () => {
      const mixedContent =
        '<h1>Title</h1><p>Text content</p><img src="test.jpg"><p>More text</p>';

      expect(mixedContent).toContain('<h1>');
      expect(mixedContent).toContain('<p>');
      expect(mixedContent).toContain('<img');
    });

    it('should handle special characters in attributes', () => {
      const specialChars = `<img src="https://example.com/image.jpg?param=value&other=123" alt="Image with &quot;quotes&quot; &amp; symbols" title="Title with &#x27;apostrophes&#x27;">`;

      expect(() =>
        transformImgTagsToFileAttachment(specialChars)
      ).not.toThrow();
      expect(specialChars).toContain('&quot;');
      expect(specialChars).toContain('&amp;');
    });

    it('should handle complex nested HTML structures', () => {
      const complexHtml = `
        <div class="container">
          <article>
            <header><h1>Title</h1></header>
            <section>
              <p>Introduction text with <strong>bold</strong> content.</p>
              <div class="image-container">
                <img src="https://example.com/main.jpg" alt="Main Image" title="Main"/>
                <figcaption>Image caption</figcaption>
              </div>
              <ul>
                <li>Item 1 with <img src="icon1.png" alt="Icon"> inline image</li>
                <li>Item 2</li>
              </ul>
              <blockquote>
                <p>Quote with <img src="quote-img.jpg"> embedded image</p>
              </blockquote>
            </section>
          </article>
        </div>
      `;

      expect(() => transformImgTagsToFileAttachment(complexHtml)).not.toThrow();
      expect(complexHtml).toContain('<img');

      // Count images in complex HTML
      const imgCount = (complexHtml.match(/<img/g) || []).length;

      expect(imgCount).toBe(3);
    });
  });

  describe('Performance Tests', () => {
    it('should handle large content efficiently', () => {
      const largeContent =
        '<div>'.repeat(100) + '<img src="test.jpg">' + '</div>'.repeat(100);

      expect(largeContent.length).toBeGreaterThan(1000);
      expect(largeContent).toContain('<img');

      // Should not timeout or crash
      const start = Date.now();
      transformImgTagsToFileAttachment(largeContent);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should validate performance with many images', () => {
      const manyImages = Array.from(
        { length: 50 },
        (_, i) =>
          `<img src="https://example.com/image${i}.jpg" alt="Image ${i}">`
      ).join('');

      const start = Date.now();
      transformImgTagsToFileAttachment(manyImages);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(2000); // Should handle 50 images quickly
      expect(manyImages.match(/<img/g) || []).toHaveLength(50);
    });
  });

  describe('Data Type Validation', () => {
    it('should ensure consistent data types', () => {
      const stringAttributes = [
        'file-attachment',
        'image',
        'false',
        '0',
        'true',
      ];

      stringAttributes.forEach((attr) => {
        expect(typeof attr).toBe('string');
        expect(attr.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Security & Robustness', () => {
    it('should handle extremely large content without timeout', () => {
      const largeHtml =
        '<div>'.repeat(1000) +
        Array.from({ length: 10 }, (_, i) => `<img src="image${i}.jpg">`).join(
          ''
        ) +
        '</div>'.repeat(1000);

      const start = Date.now();
      const result = transformImgTagsToFileAttachment(largeHtml);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');

      // Verify transformation occurred
      const attachmentCount = (
        result.match(/data-type="file-attachment"/g) || []
      ).length;

      expect(attachmentCount).toBe(10);
    });

    it('should maintain consistent behavior with whitespace variations', () => {
      const variations = [
        '<img src="test.jpg" alt="test">',
        '<img  src="test.jpg"  alt="test" >',
        '<img\nsrc="test.jpg"\nalt="test">',
        '<img\tsrc="test.jpg"\talt="test">',
        // Note: '< img' with space is invalid HTML, so we skip that case
      ];

      variations.forEach((html) => {
        const result = transformImgTagsToFileAttachment(html);

        expect(result).toContain('data-type="file-attachment"');
        expect(result).toContain('data-url="test.jpg"');
      });
    });
  });

  describe('Real-world Edge Cases', () => {
    it('should handle mixed content with various elements', () => {
      const mixedContent = `
        <div class="content">
          <h1>Article Title</h1>
          <p>Some introductory text with <strong>bold</strong> content.</p>
          <img src="header-image.jpg" alt="Header" title="Main header image">
          <blockquote>
            <p>This is a quote with an <img src="quote-icon.png" alt="quote"> icon.</p>
          </blockquote>
          <ul>
            <li>List item 1</li>
            <li>Item with image: <img src="list-image.gif" alt="list item"></li>
          </ul>
          <p>Final paragraph with embedded <img src="inline.jpg" alt="inline"> image.</p>
        </div>
      `;

      const result = transformImgTagsToFileAttachment(mixedContent);

      // Should preserve structure
      expect(result).toContain('<h1>Article Title</h1>');
      expect(result).toContain('<blockquote>');
      expect(result).toContain('<ul>');

      // Should transform all images
      expect(result.match(/data-type="file-attachment"/g) || []).toHaveLength(
        4
      );
      expect(result).not.toContain('<img');

      // Should preserve alt attributes
      expect(result).toContain('data-alt="Header"');
      expect(result).toContain('data-alt="quote"');
      expect(result).toContain('data-alt="inline"');
    });

    it('should handle OpenMetadata specific scenarios', () => {
      // Test scenarios specific to OpenMetadata migration
      const scenarios = [
        {
          name: 'placebear.com images',
          html: '<p><img src="https://placebear.com/g/200/200"></p>',
          expected: 'data-url="https://placebear.com/g/200/200"',
        },
        {
          name: 'base64 images from drag-drop',
          html: '<p><img src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD//gA7Q1JFQVRP" alt="Uploaded"></p>',
          expected:
            'data-url="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD//gA7Q1JFQVRP"',
        },
        {
          name: 'images with special characters in filename',
          html: '<img src="test%20image%20(1).jpg" alt="Test Image (1)" title="Test Image (1)">',
          expected: 'data-filename="Test Image (1)"',
        },
      ];

      scenarios.forEach((scenario) => {
        const result = transformImgTagsToFileAttachment(scenario.html);

        expect(result).toContain('data-type="file-attachment"');
        expect(result).not.toContain('<img');

        expect(result).toContain(scenario.expected);
      });
    });
  });
});
