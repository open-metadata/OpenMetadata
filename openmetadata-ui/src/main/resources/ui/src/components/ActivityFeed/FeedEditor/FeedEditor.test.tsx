/*
 *  Copyright 2022 Collate.
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

import { act, findByTestId, fireEvent, render } from '@testing-library/react';
import { KeyboardEventHandler } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { FeedEditor } from './FeedEditor';

const onSave = jest.fn();
const onChangeHandler = jest.fn();

// Minimal shape of the quill-mention module config the tests drive.
interface MentionModule {
  onOpen: () => void;
  onClose: () => void;
  onSelect: (
    item: Record<string, unknown>,
    insertItem: (item: unknown) => void
  ) => void;
}

interface CapturedQuillProps {
  modules?: { mention: MentionModule };
  onKeyDown?: KeyboardEventHandler;
}

// Captures the props ReactQuill is rendered with so tests can drive the real
// quill-mention handlers (onOpen/onClose/onSelect) that toggle isMentionListOpen.
const mockCaptureQuillProps = jest.fn<void, [CapturedQuillProps]>();

const mockFeedEditorProp = {
  onChangeHandler: onChangeHandler,
  onSave: onSave,
};

// Latest ReactQuill render props (module config + the real onKeyDown handler).
const latestQuillProps = (): CapturedQuillProps =>
  mockCaptureQuillProps.mock.calls[
    mockCaptureQuillProps.mock.calls.length - 1
  ][0];

const mentionModule = (): MentionModule => {
  const { modules } = latestQuillProps();
  if (!modules) {
    throw new Error('ReactQuill rendered without a mention module');
  }

  return modules.mention;
};

// setupTests.js globally mocks FeedEditor with a stub; test the real component.
jest.unmock('./FeedEditor');

// Quill plugins ship untransformable ESM in jsdom — stub them (their behaviour
// is irrelevant to the keydown/mention-state logic under test).
jest.mock('@windmillcode/quill-emoji', () => ({ TextAreaEmoji: class {} }));
jest.mock('quill-mention/autoregister', () => ({}), { virtual: true });

jest.mock('quilljs-markdown', () => {
  class MockQuillMarkdown {}

  return new MockQuillMarkdown();
});

jest.mock('react-quill-new', () => ({
  __esModule: true,
  Quill: { register: () => undefined, import: (val: string) => val },
  // Render a keydown-able node wired to the REAL onKeyDown so handleKeyDown (and
  // its isMentionListOpen check) is exercised, not a test reimplementation.
  default: (props: CapturedQuillProps) => {
    mockCaptureQuillProps(props);

    return (
      <div
        data-testid="react-quill"
        role="textbox"
        tabIndex={0}
        onKeyDown={props.onKeyDown}>
        editor
      </div>
    );
  },
}));

jest.mock('../../../utils/QuillLink/QuillLink', () => {
  return jest.fn();
});

describe('Test FeedEditor Component', () => {
  beforeEach(() => {
    onSave.mockClear();
    mockCaptureQuillProps.mockClear();
  });

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

    expect(onSave).toHaveBeenCalled();
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

    expect(onSave).not.toHaveBeenCalled();
  });

  it("Should not call onSave method on 'Enter' keydown with isComposing=true (IME operation)", async () => {
    const { container } = render(<FeedEditor {...mockFeedEditorProp} />, {
      wrapper: MemoryRouter,
    });
    const reactQuill = await findByTestId(container, 'react-quill');

    expect(reactQuill).toBeInTheDocument();

    fireEvent.keyDown(reactQuill, {
      key: 'Enter',
      isComposing: true,
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it("Should not call onSave method on 'Enter' keydown with keyCode=229 (IME operation, legacy)", async () => {
    const { container } = render(<FeedEditor {...mockFeedEditorProp} />, {
      wrapper: MemoryRouter,
    });
    const reactQuill = await findByTestId(container, 'react-quill');

    expect(reactQuill).toBeInTheDocument();

    fireEvent.keyDown(reactQuill, {
      key: 'Enter',
      keyCode: 229,
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it('does not submit on the Enter that selects an @mention', async () => {
    const { container } = render(<FeedEditor {...mockFeedEditorProp} />, {
      wrapper: MemoryRouter,
    });
    const reactQuill = await findByTestId(container, 'react-quill');

    // The mention suggestion list is open (user is picking a mention).
    act(() => {
      mentionModule().onOpen();
    });

    // The Enter that selects the mention must NOT send the message.
    fireEvent.keyDown(reactQuill, { key: 'Enter', shiftKey: false });

    expect(onSave).not.toHaveBeenCalled();
  });

  it('submits on the next Enter after an @mention has been selected', async () => {
    jest.useFakeTimers();
    try {
      const { container } = render(<FeedEditor {...mockFeedEditorProp} />, {
        wrapper: MemoryRouter,
      });
      const reactQuill = await findByTestId(container, 'react-quill');

      // Open the list, pick a mention (insert only), then the list closes.
      act(() => mentionModule().onOpen());
      act(() => mentionModule().onSelect({}, jest.fn()));
      act(() => mentionModule().onClose());
      // onClose defers toggling the flag a tick — flush it.
      act(() => {
        jest.runAllTimers();
      });

      // With the list now closed, Enter sends the message.
      fireEvent.keyDown(reactQuill, { key: 'Enter', shiftKey: false });

      expect(onSave).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
