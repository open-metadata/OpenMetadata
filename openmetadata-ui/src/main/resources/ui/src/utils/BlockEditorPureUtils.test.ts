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
  getTrimmedHtmlContent,
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

  it('should treat a table as HTML even without a wrapping block tag', () => {
    // `table` has to be in the cheap tag pre-check too, or a bare table never
    // reaches the DOM query that would recognise it.
    expect(isHTMLString('<table><tr><td>**Value**</td></tr></table>')).toBe(
      true
    );
  });

  it('should not misread markdown characters in attributes as markdown', () => {
    expect(
      isHTMLString('<p><a href="https://x.dev/a__b__c">link</a></p>')
    ).toBe(true);
  });

  it('should treat a fenced HTML table example as markdown', () => {
    // The fence holds a code sample. `DOMParser` parses the `<table>` inside
    // it into a real element, so the structural check has to ignore code
    // regions or the example renders as a table instead of as code.
    const markdown = [
      'Example:',
      '',
      '```html',
      '<table><tr><td>Cell</td></tr></table>',
      '```',
    ].join('\n');

    expect(isHTMLString(markdown)).toBe(false);
  });

  it('should treat a fenced HTML list example as markdown', () => {
    const markdown = ['```html', '<ul><li>one</li></ul>', '```'].join('\n');

    expect(isHTMLString(markdown)).toBe(false);
  });

  it('should treat a list inside a code span as markdown', () => {
    expect(isHTMLString('Use `<ul><li>x</li></ul>` for a list')).toBe(false);
  });

  it('should still treat a real list beside a code example as HTML', () => {
    const content = `<ul><li>real</li></ul> and \`<ol><li>sample</li></ol>\``;

    expect(isHTMLString(content)).toBe(true);
  });

  it('should treat an indented HTML table example as markdown', () => {
    // Markdown's third code form. `DOMParser` parses the `<table>` into a real
    // element exactly as it does inside a fence, so the indented block has to
    // be recognised too.
    const markdown = [
      'Example:',
      '',
      '    <table><tr><td>Cell</td></tr></table>',
    ].join('\n');

    expect(isHTMLString(markdown)).toBe(false);
  });

  it('should treat a tab-indented HTML list example as markdown', () => {
    const markdown = ['Example:', '', '\t<ul><li>one</li></ul>'].join('\n');

    expect(isHTMLString(markdown)).toBe(false);
  });

  it('should treat an indented snippet with no prose around it as HTML', () => {
    // Ambiguous by construction: with nothing around it, a lone indented
    // block is equally a code example and pretty-printed markup, and no
    // amount of parsing separates the two. It resolves to HTML, like the
    // complex-HTML case above — a code example in a real description has
    // prose introducing it, and that prose is what marks the document as
    // markdown.
    expect(isHTMLString('    <ul><li>one</li></ul>')).toBe(true);
  });

  it('should treat a multi-line indented example as markdown', () => {
    // The block runs on through its own blank lines until a line that is
    // neither indented nor blank.
    const markdown = [
      'Example:',
      '',
      '    <ul>',
      '      <li>one</li>',
      '',
      '      <li>two</li>',
      '    </ul>',
    ].join('\n');

    expect(isHTMLString(markdown)).toBe(false);
  });

  it('should treat an indented block beside a top-level tag as HTML', () => {
    // Deliberate tie-break, not an oversight.
    //
    // This is the same shape as `should keep pretty-printed HTML as HTML when
    // an item holds a backtick` below: a tag at column zero, a blank line,
    // then indented structural markup, all at top level. Read as markdown the
    // indented part is a code example; read as HTML it is a pretty-printed
    // list. Nothing in the string separates the two, and the DOM shape is
    // identical — `p + table` here, `p + ol` there.
    //
    // It resolves to HTML, because the cost is asymmetric: calling a real
    // description an example renders a fenced-looking block of raw tags, and
    // calling an example a description renders one table that should have
    // been code.
    const content = [
      '<p>Example:</p>',
      '',
      '    <table><tr><td>Cell</td></tr></table>',
    ].join('\n');

    expect(isHTMLString(content)).toBe(true);
  });

  it('should treat a blockquoted indented example as markdown', () => {
    // A blockquote marker sits outside the indentation it quotes, so it has
    // to come off before the line is measured.
    const markdown = [
      'Example:',
      '',
      '>     <table><tr><td>Cell</td></tr></table>',
    ].join('\n');

    expect(isHTMLString(markdown)).toBe(false);
  });

  it('should treat a nested blockquoted indented example as markdown', () => {
    const markdown = ['Example:', '', '> >     <ul><li>one</li></ul>'].join(
      '\n'
    );

    expect(isHTMLString(markdown)).toBe(false);
  });

  it('should treat pretty-printed HTML as HTML, not as indented code', () => {
    // Indentation in serialized editor output is pretty printing. Reading it
    // as a code block would strip the document's own markup.
    const html = [
      '<div>',
      '',
      '    <ul>',
      '      <li>one</li>',
      '    </ul>',
      '',
      '</div>',
    ].join('\n');

    expect(isHTMLString(html)).toBe(true);
  });

  it('should keep pretty-printed HTML as HTML when an item looks markdown', () => {
    // The case above survives even a code-stripped structural query, because
    // its text holds nothing a markdown pattern matches. This one does not:
    // lose the indented `<ul>` and it falls through to the pattern check,
    // `**one**` matches, and a real list goes back to the converter.
    const html = [
      '<div>',
      '',
      '    <ul>',
      '      <li>**one**</li>',
      '    </ul>',
      '',
      '</div>',
    ].join('\n');

    expect(isHTMLString(html)).toBe(true);
  });

  it('should keep pretty-printed HTML as HTML when an item holds a backtick', () => {
    const html = [
      '<p><strong>Discontinued UEs:</strong></p>',
      '',
      '    <ol>',
      '      <li>use `x` here</li>',
      '      <li>VCR</li>',
      '    </ol>',
    ].join('\n');

    expect(isHTMLString(html)).toBe(true);
  });

  it('should treat an indented line continuing a paragraph as HTML', () => {
    // No blank line before it, so it is a continuation rather than a block.
    const html = ['<p>Intro</p>', '    <ul><li>one</li></ul>'].join('\n');

    expect(isHTMLString(html)).toBe(true);
  });

  it('should still treat inline HTML mixed with markdown as markdown', () => {
    expect(isHTMLString('<span>x</span> and **bold** text')).toBe(false);
  });
});

describe('formatClientContent: HTML code examples', () => {
  it('should render a fenced HTML table example as code, not as a table', () => {
    const markdown = [
      'Example:',
      '',
      '```html',
      '<table><tr><td>Cell</td></tr></table>',
      '```',
    ].join('\n');

    const result = formatClientContent(markdown);

    expect(result).toContain('<pre>');
    expect(result).toContain('&lt;table&gt;');
    expect(result).not.toContain('<table>');
  });
});

describe('formatClientContent: indented code examples', () => {
  it('should render an indented HTML table example as code, not as a table', () => {
    const markdown = [
      'Example:',
      '',
      '    <table><tr><td>Cell</td></tr></table>',
    ].join('\n');

    const result = formatClientContent(markdown);

    expect(result).toContain('<pre>');
    expect(result).toContain('&lt;table&gt;');
    expect(result).not.toContain('<table>');
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

  it('should preserve legacy link text when data-label is missing', () => {
    const input =
      '<p><a data-type="mention" href="https://example.com/docs">Legacy documentation</a></p>';

    const result = formatClientContent(input);

    expect(result).toContain('href="https://example.com/docs"');
    expect(result).toContain('Legacy documentation');
    expect(result).not.toContain('@null');
  });
});

describe('getTrimmedHtmlContent', () => {
  it('should return the content unchanged when it fits the limit', () => {
    const html = '<p>Short <strong>bold</strong> text</p>';

    expect(getTrimmedHtmlContent(html, 50)).toBe(html);
  });

  it('should keep more than three short blocks when the text fits the limit', () => {
    const html = '<p>a</p><p>b</p><p>c</p><p>d</p>';

    expect(getTrimmedHtmlContent(html, 350)).toBe(html);
  });

  it('should not cut a mention that ends the content', () => {
    const html = formatClientContent(
      'Intro [@Infrastructure](http://localhost:3000/settings/members/teams/Infrastructure)'
    );

    expect(getTrimmedHtmlContent(html, 10)).toBe(html);
  });

  it('should keep bold formatting that crosses the cut', () => {
    const html = formatClientContent(
      'Intro **bold words continue here** tail and some more text after it'
    );

    expect(getTrimmedHtmlContent(html, 20)).toBe(
      '<p>Intro <strong>bold words...</strong></p>'
    );
  });

  it('should keep a link whose label crosses the cut', () => {
    const html = formatClientContent(
      'See the [my long docs label](https://example.com/x) for details please'
    );

    expect(getTrimmedHtmlContent(html, 20)).toBe(
      '<p>See the <a href="https://example.com/x" rel="noopener noreferrer">my long...</a></p>'
    );
  });

  it('should count visible text, not markup, against the limit', () => {
    const html =
      '<p><a href="https://example.com/a/very/long/path">docs</a> and more words here</p>';

    expect(getTrimmedHtmlContent(html, 15)).toBe(
      '<p><a href="https://example.com/a/very/long/path">docs</a> and more...</p>'
    );
  });

  it('should keep a mention crossing the cut whole and put the ellipsis after it', () => {
    const html = formatClientContent(
      'Intro [@Infrastructure](http://localhost:3000/settings/members/teams/Infrastructure) tail text here'
    );
    const doc = new DOMParser().parseFromString(
      formatClientContent(getTrimmedHtmlContent(html, 10)),
      'text/html'
    );

    expect(doc.body.textContent).toBe('Intro @Infrastructure...');
    expect(doc.querySelector('a[data-type="mention"]')?.textContent).toBe(
      '@Infrastructure'
    );
  });

  it('should keep a hashtag crossing the cut whole and put the ellipsis after it', () => {
    const html = formatClientContent(
      'See [#table](http://localhost:3000/table/sample_data.ecommerce) here and more'
    );
    const doc = new DOMParser().parseFromString(
      formatClientContent(getTrimmedHtmlContent(html, 8)),
      'text/html'
    );

    expect(doc.body.textContent).toBe('See #sample_data.ecommerce...');
  });

  it('should put the ellipsis on a text node that exactly fills the limit', () => {
    const html =
      '<p>Hello<a href="https://example.com">Docs</a> tail</p><p>Next</p>';

    expect(getTrimmedHtmlContent(html, 5)).toBe('<p>Hello...</p>');
  });

  it('should keep at most three blocks in the preview', () => {
    const html = formatClientContent(
      '- item one\n- item two\n- item three\n- item four\n- item five'
    );

    expect(getTrimmedHtmlContent(html, 40)).toBe(
      '<ul>\n<li>item one</li>\n<li>item two</li>\n<li>item three...</li></ul>'
    );
  });

  it('should not count whitespace between blocks against the limit', () => {
    const html = formatClientContent('First paragraph\n\nSecond paragraph');

    expect(getTrimmedHtmlContent(html, 15)).toBe('<p>First paragraph...</p>');
  });

  it('should count spaces between inline formatted words', () => {
    const html = `<p>${Array(80).fill('<strong>word</strong>').join(' ')}</p>`;
    const trimmed = new DOMParser().parseFromString(
      getTrimmedHtmlContent(html, 350),
      'text/html'
    ).body.textContent;

    expect(trimmed).toMatch(/word\.\.\.$/);
    expect(trimmed?.length).toBeLessThanOrEqual(353);
  });

  it('should count a quoted section with two paragraphs as two blocks', () => {
    const html =
      '<blockquote>\n<p>First</p>\n<p>Second</p>\n</blockquote>\n<p>Third</p>\n<p>Fourth</p>';

    expect(getTrimmedHtmlContent(html, 20)).toBe(
      '<blockquote>\n<p>First</p>\n<p>Second</p>\n</blockquote>\n<p>Third...</p>'
    );
  });

  it('should count line breaks inside a paragraph as separate lines', () => {
    const html = formatClientContent('one\ntwo\nthree\nfour\nfive');

    expect(getTrimmedHtmlContent(html, 20)).toBe(
      '<p>one<br>\ntwo<br>\nthree...</p>'
    );
  });

  it('should count each table row as one block', () => {
    const html = formatClientContent(
      '| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |\n| 5 | 6 |'
    );
    const rows = new DOMParser()
      .parseFromString(getTrimmedHtmlContent(html, 7), 'text/html')
      .querySelectorAll('tr');

    expect(rows).toHaveLength(3);
    expect(rows[2].textContent?.trim()).toMatch(/^3\s+4\.\.\.$/);
  });

  it('should count an editor table row with paragraphs in its cells as one block', () => {
    const row = (left: string, right: string) =>
      `<tr><td><p>${left}</p></td><td><p>${right}</p></td></tr>`;
    const html = `<table><tbody>${row('a', 'b')}${row('c', 'd')}${row(
      'e',
      'f'
    )}${row('g', 'h')}</tbody></table>`;

    expect(getTrimmedHtmlContent(html, 7)).toBe(
      `<table><tbody>${row('a', 'b')}${row('c', 'd')}${row(
        'e',
        'f...'
      )}</tbody></table>`
    );
  });

  it('should return the content unchanged when only a trailing line break follows the limit', () => {
    const html = '<p>Hello<br></p>';

    expect(getTrimmedHtmlContent(html, 5)).toBe(html);
  });

  it('should count each line of a code block as one line', () => {
    const html =
      '<pre><code>line one\nline two\nline three\nline four\n</code></pre>';

    expect(getTrimmedHtmlContent(html, 35)).toBe(
      '<pre><code>line one\nline two\nline three...</code></pre>'
    );
  });

  it('should drop every block after the cut', () => {
    const html = '<p>First paragraph text</p><ul><li>item one</li></ul>';

    expect(getTrimmedHtmlContent(html, 10)).toBe('<p>First...</p>');
  });
});

describe('getHtmlStringFromMarkdownString: CommonMark lists', () => {
  it.each([2, 4])(
    'preserves three list levels with %i-space indentation',
    (indent) => {
      const markdown = `- Parent item.\n${' '.repeat(
        indent
      )}- Pattern A\n${' '.repeat(indent * 2)}- Pattern B\n- Sibling`;
      const doc = new DOMParser().parseFromString(
        getHtmlStringFromMarkdownString(markdown),
        'text/html'
      );

      expect(
        doc.querySelector('ul > li > ul > li > ul > li')?.textContent
      ).toBe('Pattern B');
      expect(doc.querySelectorAll('body > ul > li')).toHaveLength(2);
    }
  );

  it('preserves ordered and mixed nested lists', () => {
    const doc = new DOMParser().parseFromString(
      getHtmlStringFromMarkdownString(
        '1. Parent\n   - Child\n     1. Grandchild'
      ),
      'text/html'
    );

    expect(doc.querySelector('ol > li > ul > li > ol > li')?.textContent).toBe(
      'Grandchild'
    );
  });

  it('keeps list markers inside fenced code literal', () => {
    const doc = new DOMParser().parseFromString(
      getHtmlStringFromMarkdownString('```\n- Parent\n  - Child\n```'),
      'text/html'
    );

    expect(doc.querySelector('ul')).toBeNull();
    expect(doc.querySelector('code')?.textContent).toContain('  - Child');
  });

  it.each(['main.py', 'customer.id', 'orders.io'])(
    'does not turn the dotted name %s into a link',
    (content) => {
      const doc = new DOMParser().parseFromString(
        getHtmlStringFromMarkdownString(content),
        'text/html'
      );

      expect(doc.querySelector('a')).toBeNull();
      expect(doc.body.textContent).toBe(content);
    }
  );

  it('still autolinks explicit URLs, www hosts, and email addresses', () => {
    const doc = new DOMParser().parseFromString(
      getHtmlStringFromMarkdownString(
        'https://example.com www.example.com/path?q=1. admin@example.com'
      ),
      'text/html'
    );

    expect(
      Array.from(doc.querySelectorAll('a'), (link) => link.getAttribute('href'))
    ).toEqual([
      'https://example.com',
      'http://www.example.com/path?q=1',
      'mailto:admin@example.com',
    ]);
  });

  it.each(['https', 'http', 'ftp'])(
    'autolinks %s URLs immediately after a colon',
    (scheme) => {
      const url = `${scheme}://example.com`;
      const doc = new DOMParser().parseFromString(
        getHtmlStringFromMarkdownString(`Docs:${url}`),
        'text/html'
      );

      expect(doc.querySelector('a')?.getAttribute('href')).toBe(url);
      expect(doc.querySelector('a')?.textContent).toBe(url);
      expect(doc.body.textContent).toBe(`Docs:${url}`);
    }
  );

  it.each(['range ~10-~20 rows', '~5~ ms', 'PROGRA~1\\foo~2'])(
    'keeps single tildes literal in %s',
    (content) => {
      const doc = new DOMParser().parseFromString(
        getHtmlStringFromMarkdownString(content),
        'text/html'
      );

      expect(doc.querySelector('del')).toBeNull();
      expect(doc.body.textContent).toBe(content);
    }
  );

  it('parses nested formatting while keeping single tildes literal', () => {
    const doc = new DOMParser().parseFromString(
      getHtmlStringFromMarkdownString(
        '~**approximately**~ and ~~**deleted**~~'
      ),
      'text/html'
    );

    expect(doc.body.textContent).toBe('~approximately~ and deleted');
    expect(doc.querySelectorAll('del')).toHaveLength(1);
    expect(doc.querySelector('del > strong')?.textContent).toBe('deleted');
    expect(doc.querySelector('p > strong')?.textContent).toBe('approximately');
  });

  it('preserves escaped HTML surrounded by single tildes', () => {
    const doc = new DOMParser().parseFromString(
      getHtmlStringFromMarkdownString('~\\<img src=x onerror=alert(1)>~'),
      'text/html'
    );

    expect(doc.querySelector('img')).toBeNull();
    expect(doc.querySelector('del')).toBeNull();
    expect(doc.body.textContent).toBe('~<img src=x onerror=alert(1)>~');
  });

  it('preserves nested formatting inside underline', () => {
    expect(
      getHtmlStringFromMarkdownString('__underline with **bold**__')
    ).toContain('<u>underline with <strong>bold</strong></u>');
  });

  it.each([
    ['*italic* and _plain_', '<p><em>italic</em> and _plain_</p>'],
    ['_a **b**_', '<p>_a <strong>b</strong>_</p>'],
    ['*a _b_ c*', '<p><em>a _b_ c</em></p>'],
    ['___x___', '<p><u>x</u></p>'],
    ['___x__ y_', '<p>_<u>x</u> y_</p>'],
  ])('keeps single underscores literal in %s', (markdown, expected) => {
    expect(getHtmlStringFromMarkdownString(markdown)).toBe(expected);
  });

  it('leaves unknown and escaped emoji shortcodes as text', () => {
    expect(getHtmlStringFromMarkdownString('\\:smile: :not_an_emoji:')).toBe(
      '<p>:smile: :not_an_emoji:</p>'
    );
  });

  it('leaves emoji shortcodes inside code literal', () => {
    const doc = new DOMParser().parseFromString(
      getHtmlStringFromMarkdownString('`:smile:`\n\n```\n:smile:\n```'),
      'text/html'
    );

    expect(
      Array.from(doc.querySelectorAll('code'), (code) =>
        code.textContent?.trim()
      )
    ).toEqual([':smile:', ':smile:']);
  });

  it('preserves supported inline formatting and links', () => {
    const html = getHtmlStringFromMarkdownString(
      '**bold** __underline__ ~~deleted~~ :smile: https://example.com'
    );

    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<u>underline</u>');
    expect(html).toContain('<del>deleted</del>');
    expect(html).toContain('😄');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
