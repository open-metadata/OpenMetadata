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
// Mock MentionBlot as a class
class MentionBlot {
  static create(data: { value: string; link: string; id: string }) {
    const element = document.createElement('a');
    element.innerText = data.value;
    element.href = data.link;
    element.id = data.id;

    return element;
  }
}

// Mock the Quill.import function
jest.mock('react-quill-new', () => ({
  Quill: {
    import: jest.fn().mockImplementation(() => {
      return MentionBlot;
    }),
  },
}));

import { LinkBlot } from './QuillLink';

describe('LinkBlot', () => {
  it('should create a link element with correct properties', () => {
    const data = {
      value: 'Link Text',
      link: 'https://example.com/',
      id: 'linkId',
      denotationChar: '@',
    };

    const linkElement = LinkBlot.render(data) as HTMLAnchorElement;

    expect(linkElement.tagName).toBe('A');
    expect(linkElement.innerText).toBe(data.value);
    expect(linkElement.href).toBe(data.link);
    expect(linkElement.id).toBe(data.id);
  });

  it('should have correct blotName', () => {
    expect(LinkBlot.blotName).toBe('link-mention');
  });
});
