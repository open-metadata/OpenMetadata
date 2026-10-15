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

import {
  act,
  findByTestId,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react';
import { KeyboardEventHandler } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { getUserByName } from '../../../rest/userAPI';
import { suggestions } from '../../../utils/FeedUtils';
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
  renderItem: (item: Record<string, unknown>) => HTMLElement;
  source: (
    searchTerm: string,
    renderList: (matches: unknown[], search: string) => void,
    mentionChar: string
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

// Only the search is stubbed: every mention search in this file finds nothing.
jest.mock('../../../utils/FeedUtils', () => ({
  ...jest.requireActual('../../../utils/FeedUtils'),
  suggestions: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../rest/userAPI', () => ({
  getUserByName: jest.fn(),
}));

// Typed handles onto the module-level jest mocks above. The repo's Jest type
// defs predate `jest.mocked`, so cast to `jest.Mock` (the idiomatic, type-clean
// pattern used across the test suite) instead of calling `jest.mocked(...)`.
const mockSuggestions = suggestions as jest.Mock;
const mockGetUserByName = getUserByName as jest.Mock;

// Runs the debounced mention search and returns what it handed quill-mention.
const searchMentions = async (searchTerm: string) => {
  const renderList = jest.fn();
  mentionModule().source(searchTerm, renderList, '@');
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  await waitFor(() => expect(renderList).toHaveBeenCalled());

  return renderList.mock.calls[0];
};

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

  it('renders entity mention names and breadcrumbs as text', () => {
    render(<FeedEditor {...mockFeedEditorProp} />, {
      wrapper: MemoryRouter,
    });
    const payload = '<img src=x onerror="alert(1)">';

    const suggestion = mentionModule().renderItem({
      id: 'entity-id',
      value: 'entity-fqn',
      link: '/table/entity-fqn',
      name: payload,
      type: 'table',
      breadcrumbs: [{ name: payload }],
    });

    expect(suggestion.querySelector('img')).not.toBeInTheDocument();
    expect(suggestion).toHaveTextContent(`${payload}${payload}`);
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

  it('escapes HTML in entity names rendered in the mention suggestion list', async () => {
    const { container } = render(<FeedEditor {...mockFeedEditorProp} />, {
      wrapper: MemoryRouter,
    });
    await findByTestId(container, 'react-quill');

    const payload = '<img src=x onerror=alert(1)>';
    const wrapper = mentionModule().renderItem({
      type: 'table',
      name: payload,
      breadcrumbs: [{ name: payload }],
    });

    // The payload must appear as literal text, never as parsed markup.
    expect(wrapper.querySelector('img')).toBeNull();
    expect(wrapper.textContent).toContain(payload);
  });

  describe('when a mention search finds nothing', () => {
    beforeEach(() => jest.useFakeTimers());

    afterEach(() => jest.useRealTimers());

    it('shows the empty text as a row that cannot be picked', async () => {
      render(
        <FeedEditor
          {...mockFeedEditorProp}
          emptyMentionText="No match found"
        />,
        { wrapper: MemoryRouter }
      );

      const [matches, searchTerm] = await searchMentions('zz');

      expect(searchTerm).toBe('zz');
      expect(matches).toEqual([
        expect.objectContaining({ value: 'No match found', disabled: true }),
      ]);
      expect(mentionModule().renderItem(matches[0])).toHaveTextContent(
        'No match found'
      );
    });

    it('closes the list when no empty text is given', async () => {
      render(<FeedEditor {...mockFeedEditorProp} />, {
        wrapper: MemoryRouter,
      });

      const [matches] = await searchMentions('zz');

      expect(matches).toEqual([]);
    });

    it('does not submit on Enter while the disabled no-match row keeps the dropdown open', async () => {
      const { container } = render(
        <FeedEditor
          {...mockFeedEditorProp}
          emptyMentionText="No match found"
        />,
        { wrapper: MemoryRouter }
      );
      const reactQuill = await findByTestId(container, 'react-quill');

      // 1. Drive the real source() path: a failed mention search produces a
      //    single disabled "No match found" row (commit 36729ad778). Reverting
      //    that commit yields [] here, which fails this assertion — so the
      //    test is sensitive to the commit, not just the fix.
      const [matches] = await searchMentions('zz');

      expect(matches).toEqual([
        expect.objectContaining({ value: 'No match found', disabled: true }),
      ]);

      // 2. quill-mention's renderList fires showMentionList -> setIsOpen(true)
      //    -> onOpen for a non-empty list. The mock stubs quill-mention, so
      //    simulate that callback to mirror the real dropdown state: a
      //    disabled row keeps the dropdown open (selectItem returns early for
      //    a disabled item, so hideMentionList / onClose never fires).
      act(() => {
        mentionModule().onOpen();
      });

      // 3. First Enter: the list is open, so it must not submit.
      fireEvent.keyDown(reactQuill, { key: 'Enter', shiftKey: false });

      expect(onSave).not.toHaveBeenCalled();

      // 4. Second Enter: the dropdown is still on screen. With the fix,
      //    isMentionListOpen stayed true (only onClose flips it false, and it
      //    never fired), so this Enter must not submit either. With the bug,
      //    the first Enter's unconditional toggleMentionList(false) left the
      //    flag false even though the dropdown stayed open, letting this
      //    Enter post the comment.
      fireEvent.keyDown(reactQuill, { key: 'Enter', shiftKey: false });

      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe('when a mention search returns users whose avatar fetch rejects', () => {
    beforeEach(() => jest.useFakeTimers());

    afterEach(() => {
      // Restore the file-wide default so the "finds nothing" suite is unaffected.
      mockSuggestions.mockResolvedValue([]);
      mockGetUserByName.mockReset();
      jest.useRealTimers();
    });

    it('produces a dense array (no holes) when one user fetch rejects among all-user results', async () => {
      mockSuggestions.mockResolvedValue([
        {
          id: '1',
          value: '@john',
          link: '/users/john',
          name: 'john',
          type: 'user',
          breadcrumbs: [],
        },
        {
          id: '2',
          value: '@jane',
          link: '/users/jane',
          name: 'jane',
          type: 'user',
          breadcrumbs: [],
        },
      ]);
      mockGetUserByName.mockImplementation((name: string) =>
        name === 'john'
          ? Promise.reject(new Error('Not Found'))
          : Promise.resolve({ id: '2', name: 'jane' })
      );

      render(<FeedEditor {...mockFeedEditorProp} />, { wrapper: MemoryRouter });

      const [matches] = await searchMentions('j');

      // Without the fix, index 0 is an undefined hole (getUserByName rejected
      // and no .catch fallback existed), so quill-mention's renderList would
      // throw a TypeError on data[0].disabled.
      expect(matches).toHaveLength(2);
      expect(matches).not.toContain(undefined);
      expect(matches[0]).toEqual(
        expect.objectContaining({ value: '@john', name: 'john', type: 'user' })
      );
      expect(matches[1]).toEqual(
        expect.objectContaining({ value: '@jane', name: 'jane', type: 'user' })
      );
      // The rejected user still gets a fallback avatar element — no hole.
      expect(matches[0].avatarEle).toBeInstanceOf(HTMLDivElement);
      expect(matches[1].avatarEle).toBeInstanceOf(HTMLDivElement);
    });

    it('preserves display-name order across mixed USER/TEAM results when a user fetch rejects at a lower index', async () => {
      mockSuggestions.mockResolvedValue([
        {
          id: '1',
          value: '@john',
          link: '/users/john',
          name: 'john',
          type: 'user',
          breadcrumbs: [],
        },
        {
          id: '2',
          value: '@team-alpha',
          link: '/teams/team-alpha',
          name: 'team-alpha',
          type: 'team',
          breadcrumbs: [],
        },
        {
          id: '3',
          value: '@jane',
          link: '/users/jane',
          name: 'jane',
          type: 'user',
          breadcrumbs: [],
        },
      ]);
      mockGetUserByName.mockImplementation((name: string) =>
        name === 'john'
          ? Promise.reject(new Error('Not Found'))
          : Promise.resolve({ id: '3', name: 'jane' })
      );

      render(<FeedEditor {...mockFeedEditorProp} />, { wrapper: MemoryRouter });

      const [matches] = await searchMentions('j');

      // A team entry at a higher index than a failing user is the exact
      // configuration that crashed quill-mention pre-fix (hole within
      // [0, length)). Every index must be populated and in the original order.
      expect(matches).toHaveLength(3);
      expect(matches).not.toContain(undefined);
      expect(matches[0]).toEqual(
        expect.objectContaining({ value: '@john', type: 'user' })
      );
      expect(matches[1]).toEqual(
        expect.objectContaining({ value: '@team-alpha', type: 'team' })
      );
      expect(matches[2]).toEqual(
        expect.objectContaining({ value: '@jane', type: 'user' })
      );
    });

    it('renders a fallback entry for every user when all avatar fetches reject', async () => {
      mockSuggestions.mockResolvedValue([
        {
          id: '1',
          value: '@john',
          link: '/users/john',
          name: 'john',
          type: 'user',
          breadcrumbs: [],
        },
        {
          id: '2',
          value: '@jane',
          link: '/users/jane',
          name: 'jane',
          type: 'user',
          breadcrumbs: [],
        },
      ]);
      mockGetUserByName.mockImplementation(() =>
        Promise.reject(new Error('Server Error'))
      );

      render(<FeedEditor {...mockFeedEditorProp} />, { wrapper: MemoryRouter });

      const [matches] = await searchMentions('j');

      // All fetches reject; the .catch fallback still populates every index,
      // so the array is dense (no crash, no holey-array TypeError).
      expect(matches).toHaveLength(2);
      expect(matches).not.toContain(undefined);
      expect(matches[0]).toEqual(
        expect.objectContaining({ value: '@john', type: 'user' })
      );
      expect(matches[1]).toEqual(
        expect.objectContaining({ value: '@jane', type: 'user' })
      );
      expect(matches[0].avatarEle).toBeInstanceOf(HTMLDivElement);
    });
  });
});
