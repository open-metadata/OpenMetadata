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
import { fireEvent, render } from '@testing-library/react';
import { useTranslation } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { FeedEditor } from './FeedEditor';

// setupTests.js globally mocks FeedEditor with a stub; test the real component.
jest.unmock('./FeedEditor');

jest.mock('@windmillcode/quill-emoji', () => ({ TextAreaEmoji: class {} }));
jest.mock('quill-mention/autoregister', () => ({}), { virtual: true });
jest.mock('quilljs-markdown', () => {
  class MockQuillMarkdown {}

  return new MockQuillMarkdown();
});

jest.mock('../../../utils/QuillLink/QuillLink', () => jest.fn());

interface MockQuillProps {
  onKeyDown?: (e: unknown) => void;
}

interface MockEditorRef {
  focus: () => void;
  getEditor: () => {
    getFormat: () => Record<string, unknown>;
    format: () => void;
  };
}

// Build a realistic-ish ReactQuill whose emoji toggle drives the global
// #textarea-emoji panel exactly like the pinned @windmillcode/quill-emoji
// bundle (remove if present, else create inside this instance's .ql-toolbar).
// Hooks are pulled via jest.requireActual so the jest.mock factory never
// references out-of-scope imported bindings.
jest.mock('react-quill-new', () => {
  const { forwardRef, useImperativeHandle, useRef } = jest.requireActual(
    'react'
  ) as typeof import('react');

  const noop = () => undefined;
  const mockEditorApi = {
    getFormat: () => ({}),
    format: noop,
  };
  const mockEditorHandle: MockEditorRef = {
    focus: noop,
    getEditor: () => mockEditorApi,
  };

  const MockReactQuill = forwardRef<MockEditorRef, MockQuillProps>(
    (_props, ref) => {
      const toolbarRef = useRef<HTMLDivElement>(null);

      useImperativeHandle(ref, () => mockEditorHandle, []);

      const checkEmojiBoxExist = () => {
        const existing = document.getElementById('textarea-emoji');
        if (existing) {
          existing.remove();

          return;
        }
        const panel = document.createElement('div');
        panel.id = 'textarea-emoji';
        panel.setAttribute('data-testid', 'textarea-emoji');
        toolbarRef.current?.appendChild(panel);
      };

      return (
        <div>
          <div className="ql-toolbar" ref={toolbarRef}>
            <button
              className="textarea-emoji-control ql-list"
              data-testid="emoji-toggle"
              type="button"
              onClick={checkEmojiBoxExist}>
              E
            </button>
          </div>
          <div
            className="ql-container"
            data-testid="react-quill"
            role="textbox"
            tabIndex={0}>
            editor
          </div>
        </div>
      );
    }
  );
  MockReactQuill.displayName = 'MockReactQuill';

  return {
    __esModule: true,
    Quill: { register: () => undefined, import: (val: string) => val },
    default: MockReactQuill,
  };
});

const mockFeedEditorProp = {
  onChangeHandler: jest.fn(),
  onSave: jest.fn(),
};

const setDir = (dir: 'ltr' | 'rtl') => {
  (useTranslation as unknown as jest.Mock).mockReturnValue({
    t: (key: string) => key,
    i18n: { language: dir === 'rtl' ? 'ar' : 'en-US', dir: () => dir },
  });
};

describe('FeedEditor multi-instance isolation (duplicate-id bug)', () => {
  beforeEach(() => {
    setDir('ltr');
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('does not render a duplicate-able id on the root, uses a stable class', () => {
    render(
      <>
        <FeedEditor {...mockFeedEditorProp} />
        <FeedEditor {...mockFeedEditorProp} />
      </>,
      { wrapper: MemoryRouter }
    );

    // The HTML-spec-violating duplicate id is gone.
    expect(document.querySelectorAll('#om-quill-editor')).toHaveLength(0);
    // Each instance still exposes a stable scoping class for the LESS rules.
    expect(document.querySelectorAll('.feed-editor-root')).toHaveLength(2);
  });

  it('second editor toggle-to-close no longer bounces (panel stays closed)', () => {
    const { container } = render(
      <>
        <FeedEditor {...mockFeedEditorProp} />
        <FeedEditor {...mockFeedEditorProp} />
      </>,
      { wrapper: MemoryRouter }
    );
    const toggles = container.querySelectorAll(
      '.textarea-emoji-control.ql-list'
    );

    expect(toggles).toHaveLength(2);

    const editorBToggle = toggles[1] as HTMLElement;

    fireEvent.click(editorBToggle);

    expect(document.getElementById('textarea-emoji')).not.toBeNull();

    // Clicking B's own toggle to dismiss used to bounce open again because
    // handleClickOutside resolved the FIRST editor's toggle globally and
    // synthetically clicked it. After the fix each editor scopes to its root.
    fireEvent.mouseDown(editorBToggle);
    fireEvent.click(editorBToggle);

    expect(document.getElementById('textarea-emoji')).toBeNull();
  });

  it('RTL: every editor root is marked data-dir="rtl" (placeholder alignment)', () => {
    setDir('rtl');
    const { container } = render(
      <>
        <FeedEditor {...mockFeedEditorProp} />
        <FeedEditor {...mockFeedEditorProp} />
      </>,
      { wrapper: MemoryRouter }
    );
    const roots = container.querySelectorAll('.feed-editor-root');

    expect(roots).toHaveLength(2);
    expect(roots[0].getAttribute('data-dir')).toBe('rtl');
    expect(roots[1].getAttribute('data-dir')).toBe('rtl');
  });
});
