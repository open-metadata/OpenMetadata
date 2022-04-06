/*
 *  Copyright 2021 Collate
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

import { findByTestId, fireEvent, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { FeedEditor } from './FeedEditor';

const onSave = jest.fn();
const onChangeHandler = jest.fn();

const onKeyDownHandler = jest.fn().mockImplementation((e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    onSave();
  }
});

const mockFeedEditorProp = {
  onChangeHandler: onChangeHandler,
  onSave: onSave,
};

jest.mock('quilljs-markdown', () => {
  class MockQuillMarkdown {
    constructor() {
      // eslint-disable-next-line no-console
      console.log('Markdown constructor');
    }
  }

  const instance = new MockQuillMarkdown();

  return instance;
});

jest.mock('react-quill', () => {
  class MockQuill {
    constructor() {
      // eslint-disable-next-line no-console
      console.log('Quill constructor');
    }

    register(val: string) {
      // eslint-disable-next-line no-console
      console.log(`Register ${val} module`);
    }

    import(val: string) {
      return val;
    }
  }

  return {
    __esModule: true,
    Quill: new MockQuill(),
    default: jest.fn().mockImplementation(() => {
      return (
        <div data-testid="react-quill" onKeyDown={onKeyDownHandler}>
          editor
        </div>
      );
    }),
  };
});

describe('Test FeedEditor Component', () => {
  it('Should render FeedEditor Component', async () => {
    const { container } = render(<FeedEditor {...mockFeedEditorProp} />, {
      wrapper: MemoryRouter,
    });

    const editorWrapper = await findByTestId(container, 'editor-wrapper');

    expect(editorWrapper).toBeInTheDocument();
  });

  it("Should call onSave method on 'Enter' keydown", async () => {
    const { container } = render(<FeedEditor {...mockFeedEditorProp} />, {
      wrapper: MemoryRouter,
    });
    const reactQuill = await findByTestId(container, 'react-quill');

    expect(reactQuill).toBeInTheDocument();

    fireEvent.keyDown(reactQuill, {
      key: 'Enter',
      shiftKey: false,
    });

    expect(onSave).toBeCalled();
  });

  it("Should not call onSave method on 'Enter' + 'Shift' keydown", async () => {
    const { container } = render(<FeedEditor {...mockFeedEditorProp} />, {
      wrapper: MemoryRouter,
    });
    const reactQuill = await findByTestId(container, 'react-quill');

    expect(reactQuill).toBeInTheDocument();

    fireEvent.keyDown(reactQuill, {
      key: 'Enter',
      shiftKey: true,
    });

    expect(onSave).not.toBeCalled();
  });
});
