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
    const markdown = ['```sql', 'SELECT * FROM t WHERE price > 0 AND id < 10', '```'].join(
      '\n'
    );

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
  ])('should be stable when re-converted: %s', (_name, markdown) => {
    const formatted = formatClientContent(markdown);

    expect(getHtmlStringFromMarkdownString(formatted)).toBe(formatted);
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
    const result = formatClientContent('<a href="javascript:alert(1)">click</a>');

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

  it('should keep mention label when content is already HTML', () => {
    const input =
      '<p>This <a data-type="mention" data-label="Infrastructure" href="http://localhost:3000/settings/members/teams/Infrastructure" data-entitytype="team" data-fqn="Infrastructure">@Infrastructure</a> team</p>';

    const result = formatClientContent(input);

    expect(result).toContain('@Infrastructure');
    expect(result.match(/@Infrastructure/g) ?? []).toHaveLength(1);
  });
});
