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
import { MarkdownToHTMLConverter } from './FeedUtilsPure';
import { getSanitizeContent } from './sanitize.utils';

const parseFeedMarkdown = (markdown: string) =>
  new DOMParser().parseFromString(
    MarkdownToHTMLConverter.makeHtml(markdown),
    'text/html'
  );

describe('MarkdownToHTMLConverter', () => {
  it('keeps three levels of two-space-indented feed lists', () => {
    const doc = parseFeedMarkdown(
      '- Parent\n  - Child\n    - Grandchild\n- Sibling'
    );

    expect(doc.querySelector('ul > li > ul > li > ul > li')?.textContent).toBe(
      'Grandchild'
    );
    expect(doc.querySelectorAll('body > ul > li')).toHaveLength(2);
  });

  it('preserves paragraphs, line breaks, bold, emphasis, and double-tilde deletion', () => {
    const doc = parseFeedMarkdown(
      '**bold** __also bold__ *emphasis* ~literal~ ~~deleted~~\nnext line'
    );

    expect(doc.querySelectorAll('strong')).toHaveLength(2);
    expect(doc.querySelector('em')?.textContent).toBe('emphasis');
    expect(doc.querySelector('del')?.textContent).toBe('deleted');
    expect(doc.querySelectorAll('del')).toHaveLength(1);
    expect(doc.querySelectorAll('br')).toHaveLength(1);
    expect(doc.body.textContent).toContain('~literal~');
  });

  it('retains disabled task checkboxes and the existing task-list class', () => {
    const doc = parseFeedMarkdown('- [x] done\n- [ ] todo');
    const inputs = Array.from(doc.querySelectorAll('input'));

    expect(doc.querySelectorAll('li.task-list-item')).toHaveLength(2);
    expect(inputs.map((input) => input.disabled)).toEqual([true, true]);
    expect(inputs.map((input) => input.checked)).toEqual([true, false]);
  });

  it('keeps tables and alignment', () => {
    const doc = parseFeedMarkdown(
      '| Name | Count |\n| :--- | ---: |\n| Orders | 10 |'
    );

    expect(doc.querySelector('thead th')?.textContent).toBe('Name');
    expect(doc.querySelector('tbody td')?.textContent).toBe('Orders');
    expect(doc.querySelector('tbody tr')?.children).toHaveLength(2);
    expect(
      doc.querySelector<HTMLTableCellElement>('tbody td:last-child')?.style
        .textAlign
    ).toBe('right');
  });

  it('preserves heading anchors and resets duplicate IDs for each document', () => {
    const markdown = '# Hello, world!\n\n# Hello, world!';

    for (let index = 0; index < 2; index++) {
      const doc = parseFeedMarkdown(markdown);

      expect(
        Array.from(doc.querySelectorAll('h1'), (heading) => heading.id)
      ).toEqual(['helloworld', 'helloworld-1']);
    }
  });

  it('preserves existing anchor IDs for headings containing Markdown', () => {
    const doc = parseFeedMarkdown(
      '# **Hello** `there` [Docs](https://example.com)'
    );

    expect(doc.querySelector('h1')?.id).toBe('hellotheredocshttpsexamplecom');
    expect(doc.querySelector('h1 strong')?.textContent).toBe('Hello');
    expect(doc.querySelector('h1 a')?.getAttribute('href')).toBe(
      'https://example.com'
    );
  });

  it('keeps bare URLs and emoji as text while rendering explicit links', () => {
    const doc = parseFeedMarkdown(
      'https://example.com :smile: [Docs](https://docs.example.com)'
    );

    expect(doc.querySelectorAll('a')).toHaveLength(1);
    expect(doc.querySelector('a')?.getAttribute('href')).toBe(
      'https://docs.example.com'
    );
    expect(doc.querySelector('a')?.hasAttribute('target')).toBe(false);
    expect(doc.body.textContent).toContain('https://example.com :smile:');
  });

  it('preserves existing mention HTML and literal code samples', () => {
    const mention =
      '<a data-type="mention" data-fqn="team" href="/teams/team">@team</a>';
    const doc = parseFeedMarkdown(
      `${mention}\n\n\`**literal** :smile:\`\n\n\`\`\`html\n<img src=x>\n\`\`\``
    );

    expect(doc.querySelector('a')?.outerHTML).toBe(mention);
    expect(doc.querySelector('code')?.textContent).toBe('**literal** :smile:');
    expect(doc.querySelector('pre > code')?.textContent?.trim()).toBe(
      '<img src=x>'
    );
    expect(doc.querySelector('img')).toBeNull();
  });

  it('leaves unsafe HTML and links subject to the existing sanitizer', () => {
    const html = MarkdownToHTMLConverter.makeHtml(
      '[unsafe](javascript:alert(1)) <img src="x" onerror="alert(2)">'
    );
    const doc = new DOMParser().parseFromString(
      getSanitizeContent(html),
      'text/html'
    );

    expect(doc.querySelector('a')?.hasAttribute('href')).toBe(false);
    expect(doc.querySelector('img')?.hasAttribute('onerror')).toBe(false);
    expect(doc.querySelector('img')?.getAttribute('src')).toBe('x');
  });

  it('returns an empty string for an empty feed', () => {
    expect(MarkdownToHTMLConverter.makeHtml('')).toBe('');
  });
});
