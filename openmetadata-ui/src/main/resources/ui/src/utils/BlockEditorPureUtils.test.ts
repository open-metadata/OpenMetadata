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
  formatClientContent,
  getHtmlStringFromMarkdownString,
  isHTMLString,
} from './BlockEditorPureUtils';

describe('formatClientContent: markdown special characters', () => {
  it('should preserve > inside a code span instead of double-escaping it', () => {
    const markdown = 'Use `>` to compare';

    const result = formatClientContent(markdown);

    // The rendered output must carry a real ">" character, not a literal "&gt;"
    // that the user can see. `&amp;gt;` is the double-escape bug.
    expect(result).not.toContain('&amp;gt;');
    expect(result).toContain('<code>&gt;</code>');
  });

  it('should preserve < inside a code span', () => {
    const markdown = 'Use `<` to compare';

    const result = formatClientContent(markdown);

    expect(result).not.toContain('&amp;lt;');
    expect(result).toContain('<code>&lt;</code>');
  });

  it('should preserve operators in the TestCaseForm operator documentation', () => {
    const markdown =
      '- **Operator** (STRING, Optional) - `==` (equals), `>` (greater than), `>=` (greater or equal), `<` (less than)';

    const result = formatClientContent(markdown);

    expect(result).not.toContain('&amp;gt;');
    expect(result).not.toContain('&amp;lt;');
    expect(result).toContain('<code>&gt;</code>');
    expect(result).toContain('<code>&gt;=</code>');
    expect(result).toContain('<code>&lt;</code>');
  });

  it('should preserve > and < inside a fenced code block', () => {
    const markdown = [
      '```sql',
      'SELECT * FROM t WHERE price > 0 AND id < 10',
      '```',
    ].join('\n');

    const result = formatClientContent(markdown);

    expect(result).not.toContain('&amp;gt;');
    expect(result).not.toContain('&amp;lt;');
    // Must be a real rendered code block, not raw markdown that merely
    // happens to contain the entity text.
    expect(result).toContain('<pre>');
    expect(result).toContain('price &gt; 0 AND id &lt; 10');
  });

  it('should still render standard markdown structure', () => {
    const result = formatClientContent('# Title\n\n- item one\n- item two');

    expect(result).toContain('<h1');
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>item one</li>');
  });
});

const NESTED_LIST_DESCRIPTION =
  '<p><strong>Discontinued UEs:</strong></p>' +
  '<ol class="om-list-decimal">' +
  '<li class="om-leading-normal"><p>High Definition Media UEs</p>' +
  '<ul class="om-list-disc">' +
  '<li class="om-leading-normal"><p>HD: Capable</p></li>' +
  '<li class="om-leading-normal"><p>HD: Display Capable</p></li>' +
  '<li class="om-leading-normal"><p>HD: NO</p></li>' +
  '<li class="om-leading-normal"><p>HD: Receivable</p></li>' +
  '</ul></li>' +
  '<li class="om-leading-normal"><p>VCR and Analog UEs</p>' +
  '<ul class="om-list-disc">' +
  '<li class="om-leading-normal"><p>AnalogCableOnlyWithPay</p></li>' +
  '<li class="om-leading-normal"><p>PresVCRYes</p></li>' +
  '<li class="om-leading-normal"><p>PresVCRNo</p></li>' +
  '</ul></li>' +
  '<li class="om-leading-normal"><p>Cable UE</p>' +
  '<ul class="om-list-disc">' +
  '<li class="om-leading-normal"><p>CableNotADS</p></li>' +
  '<li class="om-leading-normal"><p>CableAndADS</p></li>' +
  '</ul></li>' +
  '</ol>';

// Showdown's `unhashHTMLSpans` gives up after 10 levels of nesting and leaves
// its `¨C<n>C` span placeholders in the output. Any content that reaches the
// rendered page carrying one has been round-tripped through the markdown
// converter when it should not have been.
const SHOWDOWN_SPAN_PLACEHOLDER = /\u00a8C\d+C/;

describe('isHTMLString: already-rendered HTML', () => {
  it('should treat a nested ordered/unordered list as HTML', () => {
    expect(isHTMLString(NESTED_LIST_DESCRIPTION)).toBe(true);
  });

  it('should treat a nested list as HTML even when its prose looks markdown', () => {
    expect(
      isHTMLString(`Legacy notes: **see wiki** ${NESTED_LIST_DESCRIPTION}`)
    ).toBe(true);
  });

  it('should not misread markdown characters in attributes as markdown', () => {
    expect(
      isHTMLString('<p><a href="https://x.dev/a__b__c">link</a></p>')
    ).toBe(true);
  });

  it('should still treat inline HTML mixed with markdown as markdown', () => {
    expect(isHTMLString('<span>x</span> and **bold** text')).toBe(false);
  });
});

describe('formatClientContent: nested lists', () => {
  it('should not leak markdown-converter span placeholders', () => {
    const result = formatClientContent(
      `Legacy notes: **see wiki** ${NESTED_LIST_DESCRIPTION}`
    );

    expect(result).not.toMatch(SHOWDOWN_SPAN_PLACEHOLDER);
    expect(result).toContain('AnalogCableOnlyWithPay');
    expect(result).toContain('CableAndADS');
  });
});

describe('isHTMLString: parser failure', () => {
  it('should fall back to treating content as markdown when parsing throws', () => {
    const spy = jest
      .spyOn(DOMParser.prototype, 'parseFromString')
      .mockImplementation(() => {
        throw new Error('parser exploded');
      });

    try {
      // Passes the tag pre-check, so the parser is reached and throws.
      // Falling back to `false` routes content down the markdown path, which
      // still sanitises; the reverse default would trust unparsed input.
      expect(isHTMLString('<p>hello</p>')).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('getHtmlStringFromMarkdownString', () => {
  it('should convert markdown to HTML', () => {
    expect(getHtmlStringFromMarkdownString('# Title')).toContain('<h1');
  });

  it('should keep > and < inside code spans as entities, not double-escape them', () => {
    const result = getHtmlStringFromMarkdownString('Use `>` and `<`');

    expect(result).toContain('<code>&gt;</code>');
    expect(result).toContain('<code>&lt;</code>');
    expect(result).not.toContain('&amp;gt;');
  });

  it('should return HTML input untouched', () => {
    const html = '<p>already html</p>';

    expect(getHtmlStringFromMarkdownString(html)).toBe(html);
  });

  it('should return an empty string unchanged', () => {
    expect(getHtmlStringFromMarkdownString('')).toBe('');
  });
});

describe('formatClientContent: idempotency', () => {
  // The BlockEditor runs getHtmlStringFromMarkdownString over this output
  // again. Converting a second time must be a no-op, otherwise content is
  // mangled downstream.
  it.each([
    ['code span', 'Use `>` to compare'],
    ['list', '- a\n- b'],
    ['horizontal rule', 'above\n\n---\n\nbelow'],
    ['underscores in a code block', '```\nfoo ___ bar\n```'],
    ['asterisks in a code block', '```\nfoo *** bar\n```'],
    // A rendered code block whose body contains lines that look like markdown
    // (a heading, a bold marker) must not be re-parsed into new structure when
    // getHtmlStringFromMarkdownString runs over the already-rendered HTML.
    ['heading line in a code block', '```\n# heading\nSELECT 1\n```'],
    ['bold marker in a code block', '```\nfoo **bar** baz\n```'],
    ['heading and list in a code block', '```\n# note\n- item\n```'],
  ])('should be stable when re-converted: %s', (_name, markdown) => {
    const formatted = formatClientContent(markdown);

    expect(getHtmlStringFromMarkdownString(formatted)).toBe(formatted);
  });

  it('should keep a heading line inside a code block as literal text', () => {
    const result = formatClientContent('```\n# heading\nSELECT 1\n```');

    // The `#` must survive as code content, not become an <h1>.
    expect(result).toContain('<pre><code>');
    expect(result).toContain('# heading');
    expect(result).not.toContain('<h1');
  });
});

describe('formatClientContent: XSS neutralisation', () => {
  it('should strip script tags', () => {
    const result = formatClientContent('<script>alert(1)</script>');

    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert(1)');
  });

  it('should strip script tags embedded in markdown', () => {
    const result = formatClientContent('# Title\n\n<script>alert(1)</script>');

    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert(1)');
  });

  it('should strip inline event handlers', () => {
    const result = formatClientContent('<img src=x onerror=alert(1)>');

    expect(result).not.toContain('onerror');
    expect(result).not.toContain('alert(1)');
  });

  it('should strip svg onload handlers', () => {
    const result = formatClientContent('<svg onload=alert(1)>');

    expect(result).not.toContain('onload');
    expect(result).not.toContain('alert(1)');
  });

  it('should strip iframes', () => {
    const result = formatClientContent('<iframe src="evil.com"></iframe>');

    expect(result).not.toContain('<iframe');
  });

  it('should strip javascript: hrefs from markdown links', () => {
    const result = formatClientContent('[click](javascript:alert(1))');

    expect(result).not.toContain('javascript:');
  });

  it('should strip javascript: hrefs from anchor tags', () => {
    const result = formatClientContent(
      '<a href="javascript:alert(1)">click</a>'
    );

    expect(result).not.toContain('javascript:');
  });
});

describe('formatClientContent: mentions and hashtags', () => {
  it('should rewrite a user mention into an anchor with the @label', () => {
    const markdown = 'Hello [@john](http://localhost:3000/users/john) welcome';

    const result = formatClientContent(markdown);

    expect(result).toContain('data-type="mention"');
    expect(result).toContain('@john');
    expect(result.match(/@john/g) ?? []).toHaveLength(1);
  });

  it('should rewrite a team mention into an anchor with the @label', () => {
    const markdown =
      'Hello [@Infrastructure](http://localhost:3000/settings/members/teams/Infrastructure) team';

    const result = formatClientContent(markdown);

    expect(result).toContain('data-type="mention"');
    expect(result).toContain('@Infrastructure');
    expect(result.match(/@Infrastructure/g) ?? []).toHaveLength(1);
  });

  it('should rewrite a hashtag into an anchor with the #label', () => {
    const markdown =
      'See [#table](http://localhost:3000/table/sample_data.ecommerce) here';

    const result = formatClientContent(markdown);

    expect(result).toContain('data-type="hashtag"');
    // The rendered label is the entity FQN, not the display text.
    expect(result).toContain('#sample_data.ecommerce');
  });

  it('should rewrite every mention when several are present', () => {
    const markdown =
      'cc [@john](http://localhost:3000/users/john) and [@jane](http://localhost:3000/users/jane)';

    const result = formatClientContent(markdown);

    expect(result.match(/data-type="mention"/g) ?? []).toHaveLength(2);
    expect(result).toContain('@john');
    expect(result).toContain('@jane');
  });

  it('should rewrite every hashtag when several are present', () => {
    const markdown =
      'see [#a](http://localhost:3000/table/db.a) and [#b](http://localhost:3000/topic/db.b)';

    const result = formatClientContent(markdown);

    expect(result.match(/data-type="hashtag"/g) ?? []).toHaveLength(2);
    expect(result).toContain('#db.a');
    expect(result).toContain('#db.b');
  });

  it('should not build a mention link for an unsupported entity type', () => {
    // Only team and user are mention-able; a table link stays an ordinary link.
    const result = formatClientContent(
      'hi [@x](http://localhost:3000/table/db.foo)'
    );

    expect(result).not.toContain('data-type="mention"');
    expect(result).toContain('href="http://localhost:3000/table/db.foo"');
  });

  it('should keep mention label when content is already HTML', () => {
    const input =
      '<p>This <a data-type="mention" data-label="Infrastructure" href="http://localhost:3000/settings/members/teams/Infrastructure" data-entitytype="team" data-fqn="Infrastructure">@Infrastructure</a> team</p>';

    const result = formatClientContent(input);

    expect(result).toContain('@Infrastructure');
    expect(result.match(/@Infrastructure/g) ?? []).toHaveLength(1);
  });
});
