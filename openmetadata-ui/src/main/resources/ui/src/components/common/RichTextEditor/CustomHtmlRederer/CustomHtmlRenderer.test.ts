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
/* eslint-disable max-len */
import { replaceLatex } from './CustomHtmlRederer';

jest.mock('katex', () => ({
  renderToString: jest.fn().mockReturnValue('latex content'),
}));

describe('replaceLatex', () => {
  it('returns the original string if no LaTeX is present', () => {
    const input = 'This is a test string without LaTeX.';
    const output = replaceLatex(input);

    expect(output).toBe(input);
  });

  it('replaces LaTeX content correctly', () => {
    const content =
      '<span class="ant-typography" data-testid="diff-normal">This dimension table contains a row for each channel or app that your customers use to create orders. Some examples of these include Facebook and Online Store. You can join this table with the sales table to measure channel performance.</span><span class="ant-typography diff-added" data-testid="diff-added"><u>\n\n$$latex\n\text{$dfrac{NetSales}{Quantity Invoiced}=Average Price, :$ If QuantityInvoiced is Null then,$: AveragePrice=Null$}\n$$</u></span>';

    const output = replaceLatex(content);

    expect(output).toContain('latex content');

    expect(output).not.toContain('$$latex');
  });

  it('replaces multiple LaTeX contents correctly', () => {
    const content = `$$latex \\frac{a}{b}$$ $$latex \\frac{c}{d}$$`;
    const output = replaceLatex(content);

    expect(output).toContain('latex content latex content');
  });

  it('returns the original LaTeX string if it is malformed', () => {
    const malformedLatex = '$$latex \\frac{a}{b}';
    const input = `This is malformed: ${malformedLatex}`;
    const output = replaceLatex(input);

    expect(output).toContain(malformedLatex);
  });
});
