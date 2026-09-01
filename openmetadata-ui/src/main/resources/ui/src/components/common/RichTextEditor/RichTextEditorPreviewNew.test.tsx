/*
 *  Copyright 2025 Collate.
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
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { PreviewerProp } from './RichTextEditor.interface';
import RichTextEditorPreviewNew from './RichTextEditorPreviewNew';

jest.mock('../../BlockEditor/BlockEditor', () => {
  return jest
    .fn()
    .mockImplementation(({ content }) => (
      <div data-testid="block-editor">{content}</div>
    ));
});

jest.mock('../../../utils/BlockEditorPureUtils', () => ({
  formatClientContent: jest.fn((content) => content),
  isDescriptionContentEmpty: jest.fn((content) => !content || content === ''),
  getTextFromHtmlString: jest.fn((content) =>
    (content ?? '').replace(/<[^>]{1,1000}>/g, '').trim()
  ),
}));

const mockLongMarkdown = `
# Very Long Content
This is a very long piece of content that should trigger the "read more" functionality.
Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.
`;

const mockProp: PreviewerProp = {
  markdown: mockLongMarkdown,
  className: '',
  enableSeeMoreVariant: true,
  textVariant: 'black',
  isDescriptionExpanded: false,
  maxLineLength: '2',
};

describe('RichTextEditorPreviewNew', () => {
  let mockResizeObserver: jest.Mock;
  let resizeCallback: ResizeObserverCallback;

  beforeEach(() => {
    mockResizeObserver = jest.fn().mockImplementation((callback) => {
      resizeCallback = callback;

      return {
        observe: jest.fn(),
        disconnect: jest.fn(),
        unobserve: jest.fn(),
      };
    });
    global.ResizeObserver =
      mockResizeObserver as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // A 14px font at a real 1.5 line-height (21px/line) — the actual ratio this
  // component renders content at. The clamp height must be derived from this
  // measured value, not a hardcoded assumption.
  const mockRealisticLineHeight = () =>
    jest.spyOn(window, 'getComputedStyle').mockReturnValue({
      lineHeight: '21px',
      fontSize: '14px',
    } as CSSStyleDeclaration);

  it('should render the component with markdown content', async () => {
    render(<RichTextEditorPreviewNew {...mockProp} />);

    expect(screen.getByTestId('viewer-container')).toBeInTheDocument();
    expect(screen.getByTestId('markdown-parser')).toBeInTheDocument();
    expect(await screen.findByTestId('block-editor')).toBeInTheDocument();
  });

  it('should render no-description placeholder when markdown is empty', () => {
    render(<RichTextEditorPreviewNew {...mockProp} markdown="" />);

    expect(screen.getByText('label.no-description')).toBeInTheDocument();
    expect(screen.queryByTestId('viewer-container')).not.toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const customClass = 'custom-class';
    render(<RichTextEditorPreviewNew {...mockProp} className={customClass} />);

    const container = screen.getByTestId('viewer-container');

    expect(container).toHaveClass('rich-text-editor-container', customClass);
  });

  it('should apply text variant className', () => {
    render(<RichTextEditorPreviewNew {...mockProp} textVariant="white" />);

    const parser = screen.getByTestId('markdown-parser');

    expect(parser).toHaveClass('markdown-parser', 'white');
  });

  it('should apply RTL direction when i18n dir is rtl', () => {
    jest.spyOn(require('react-i18next'), 'useTranslation').mockReturnValue({
      t: (key: string) => key,
      i18n: { dir: () => 'rtl' },
    });

    render(<RichTextEditorPreviewNew {...mockProp} />);

    const container = screen.getByTestId('viewer-container');

    expect(container).toHaveClass('text-right');
    expect(container).toHaveAttribute('dir', 'rtl');
  });

  it('should apply line clamp styles when not expanded', () => {
    mockRealisticLineHeight();
    render(<RichTextEditorPreviewNew {...mockProp} maxLineLength="3" />);

    const parser = screen.getByTestId('markdown-parser');
    const style = parser.style;

    // 3 lines at the real measured 21px line-height, not a fixed "3 * 2em".
    expect(style.maxHeight).toBe('63px');
    expect(style.overflow).toBe('hidden');
    expect(style.display).toBe('');
  });

  it('should not apply line clamp styles when expanded', () => {
    render(
      <RichTextEditorPreviewNew
        {...mockProp}
        isDescriptionExpanded
        maxLineLength="2"
      />
    );

    const parser = screen.getByTestId('markdown-parser');
    const style = parser.style;

    expect(style.display).toBe('');
    expect(style.maxHeight).toBe('');
    expect(style.overflow).toBe('');
  });

  it('does not animate the mount-time correction from the 2em-per-line estimate to the real measured height, so a freshly-mounted card does not visibly shrink', () => {
    // On mount, clampStyle first renders with the em-per-line fallback (no
    // measurement exists yet), then the checkOverflow effect measures the
    // real height and corrects it. Animating that one-time correction (the
    // original behavior) is what produced the "shows full description then
    // gets shorter" flash reported when a whole grid of cards mounts at
    // once (e.g. switching from table to grid view) — every card's estimate
    // was looser than its real clamp, so all of them visibly shrank in sync.
    mockRealisticLineHeight();
    render(<RichTextEditorPreviewNew {...mockProp} maxLineLength="3" />);

    const parser = screen.getByTestId('markdown-parser');

    // The real measured height (3 lines @ 21px) is already applied by the
    // time render() settles, and the transition that got it there must be
    // 'none' -- an instant snap, not an animated shrink.
    expect(parser.style.maxHeight).toBe('63px');
    expect(parser.style.transition).toBe('none');
  });

  it('does not animate a font-swap-triggered remeasurement while fonts are still loading, but resumes animating once fonts are ready', async () => {
    // font-display: swap (src/styles/inter-variable.css) means a cold paint
    // renders with the system fallback font first, then swaps to Inter once
    // it loads -- a real ResizeObserver refire with a different height. That
    // correction must not animate either, or it reproduces the exact same
    // flash, just shifted to happen right after the font swap instead of on
    // mount.
    let resolveFontsReady: () => void = () => undefined;
    const fontsReadyPromise = new Promise<FontFaceSet>((resolve) => {
      resolveFontsReady = () => resolve({} as FontFaceSet);
    });

    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { status: 'loading', ready: fontsReadyPromise },
    });

    try {
      mockRealisticLineHeight();
      render(<RichTextEditorPreviewNew {...mockProp} maxLineLength="3" />);

      const parser = screen.getByTestId('markdown-parser');

      expect(parser.style.transition).toBe('none');

      // Font swap changes the rendered metrics -> ResizeObserver fires again
      // with a different height, while document.fonts.status is still
      // "loading".
      jest.spyOn(window, 'getComputedStyle').mockReturnValue({
        lineHeight: '24px',
        fontSize: '16px',
      } as CSSStyleDeclaration);

      act(() => {
        resizeCallback([], mockResizeObserver.mock.results[0].value);
      });

      expect(parser.style.maxHeight).toBe('72px');
      expect(parser.style.transition).toBe('none');

      // Fonts finish loading. No new measurement has happened yet, so
      // nothing about the clamp has changed at this exact point.
      await act(async () => {
        resolveFontsReady();
        await fontsReadyPromise;
      });

      expect(parser.style.transition).toBe('none');

      // The *first* measurement taken after fonts become ready is still
      // instant (it's the one correcting for the font swap itself).
      jest.spyOn(window, 'getComputedStyle').mockReturnValue({
        lineHeight: '21px',
        fontSize: '14px',
      } as CSSStyleDeclaration);

      act(() => {
        resizeCallback([], mockResizeObserver.mock.results[0].value);
      });

      expect(parser.style.maxHeight).toBe('63px');
      expect(parser.style.transition).toBe('none');

      // A *second* genuine change, after fonts were already ready for the
      // prior measurement, finally animates normally.
      jest.spyOn(window, 'getComputedStyle').mockReturnValue({
        lineHeight: '18px',
        fontSize: '14px',
      } as CSSStyleDeclaration);

      act(() => {
        resizeCallback([], mockResizeObserver.mock.results[0].value);
      });

      expect(parser.style.maxHeight).toBe('54px');
      expect(parser.style.transition).toBe('max-height 0.3s ease');
    } finally {
      Reflect.deleteProperty(document, 'fonts');
    }
  });

  it('still animates a later, genuine max-height change (collapsing back after View more/View less) once the initial mount has settled', async () => {
    render(<RichTextEditorPreviewNew {...mockProp} />);

    const contentElement = screen.getByTestId('markdown-parser');

    Object.defineProperty(contentElement, 'scrollHeight', {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(contentElement, 'clientHeight', {
      configurable: true,
      value: 100,
    });

    act(() => {
      resizeCallback([], mockResizeObserver.mock.results[0].value);
    });

    // The mount-time settle already happened above with transition: 'none'.
    const readMoreButton = await screen.findByTestId('read-more-button');

    act(() => {
      fireEvent.click(readMoreButton);
    });

    // Expanded: clampStyle is undefined (no maxHeight/transition to clamp).
    expect(contentElement.style.maxHeight).toBe('');

    const readLessButton = screen.getByTestId('read-less-button');

    act(() => {
      fireEvent.click(readLessButton);
    });

    // Collapsing back applies a real (non-mount-time) max-height change, so
    // it must animate, unlike the earlier one-time mount correction.
    expect(contentElement.style.transition).toBe('max-height 0.3s ease');
  });

  it('should detect overflow and show view-more button', async () => {
    render(<RichTextEditorPreviewNew {...mockProp} />);

    const contentElement = screen.getByTestId('markdown-parser');

    Object.defineProperty(contentElement, 'scrollHeight', {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(contentElement, 'clientHeight', {
      configurable: true,
      value: 100,
    });

    act(() => {
      resizeCallback([], mockResizeObserver.mock.results[0].value);
    });

    await waitFor(() => {
      expect(screen.getByTestId('read-more-button')).toBeInTheDocument();
    });
  });

  it('re-measures overflow once BlockEditor actually mutates the DOM, hiding View more when content no longer overflows even without a new React render', async () => {
    // BlockEditor.tsx applies a changed `content` prop imperatively and
    // asynchronously: its own content-sync effect defers the real
    // editor.commands.setContent(...) call via setTimeout (to avoid a
    // tiptap flushSync warning), which mutates the ProseMirror DOM directly
    // -- not through this component's own React render cycle. The test
    // mock below renders `content` synchronously as a child, which doesn't
    // reproduce that asynchrony, so this test instead mutates the DOM
    // directly (bypassing React entirely, like the real editor does) to
    // exercise the actual mechanism that must catch it: the MutationObserver
    // in the layout effect, not the eager checkOverflow() call tied to
    // content changing.
    render(<RichTextEditorPreviewNew {...mockProp} />);

    const contentElement = screen.getByTestId('markdown-parser');
    // BlockEditor is React.lazy-loaded, so even with the module mocked its
    // dynamic import() still resolves on a microtask -- findByTestId (not
    // getByTestId) waits for that Suspense boundary to settle.
    const editorElement = await screen.findByTestId('block-editor');

    Object.defineProperty(contentElement, 'scrollHeight', {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(contentElement, 'clientHeight', {
      configurable: true,
      value: 100,
    });

    act(() => {
      resizeCallback([], mockResizeObserver.mock.results[0].value);
    });

    await waitFor(() => {
      expect(screen.getByTestId('read-more-button')).toBeInTheDocument();
    });

    // The content now fits -- update the (mocked) measured size to reflect
    // it, then mutate the DOM directly, outside of any React render, the
    // same way BlockEditor's real deferred setContent call would.
    Object.defineProperty(contentElement, 'scrollHeight', {
      configurable: true,
      value: 80,
    });
    Object.defineProperty(contentElement, 'clientHeight', {
      configurable: true,
      value: 100,
    });

    act(() => {
      editorElement.textContent = 'Short content that fits.';
    });

    await waitFor(() => {
      expect(screen.queryByTestId('read-more-button')).not.toBeInTheDocument();
    });
  });

  it('should not show view-more button when content does not overflow', async () => {
    render(<RichTextEditorPreviewNew {...mockProp} />);

    const contentElement = screen.getByTestId('markdown-parser');

    Object.defineProperty(contentElement, 'scrollHeight', {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(contentElement, 'clientHeight', {
      configurable: true,
      value: 100,
    });

    act(() => {
      resizeCallback([], mockResizeObserver.mock.results[0].value);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('read-more-button')).not.toBeInTheDocument();
    });
  });

  it('should not show view-more button when enableSeeMoreVariant is false', async () => {
    render(
      <RichTextEditorPreviewNew {...mockProp} enableSeeMoreVariant={false} />
    );

    const contentElement = screen.getByTestId('markdown-parser');

    Object.defineProperty(contentElement, 'scrollHeight', {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(contentElement, 'clientHeight', {
      configurable: true,
      value: 100,
    });

    act(() => {
      resizeCallback([], mockResizeObserver.mock.results[0].value);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('read-more-button')).not.toBeInTheDocument();
    });
  });

  it('should toggle read more state when button is clicked', async () => {
    render(<RichTextEditorPreviewNew {...mockProp} />);

    const contentElement = screen.getByTestId('markdown-parser');

    Object.defineProperty(contentElement, 'scrollHeight', {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(contentElement, 'clientHeight', {
      configurable: true,
      value: 100,
    });

    act(() => {
      resizeCallback([], mockResizeObserver.mock.results[0].value);
    });

    await waitFor(() => {
      expect(screen.getByTestId('read-more-button')).toBeInTheDocument();
    });

    const readMoreButton = screen.getByTestId('read-more-button');

    act(() => {
      fireEvent.click(readMoreButton);
    });

    expect(screen.getByTestId('read-less-button')).toBeInTheDocument();

    const readLessButton = screen.getByTestId('read-less-button');

    act(() => {
      fireEvent.click(readLessButton);
    });

    expect(screen.getByTestId('read-more-button')).toBeInTheDocument();
  });

  it('bubbles the View more click to an ancestor onClick (e.g. a clickable card that navigates)', async () => {
    const ancestorOnClick = jest.fn();

    // Mirrors EntityCardView.component.tsx wrapping each card in a plain
    // `<Card onClick={() => onEntityClick(entity)}>`. For consumers like the
    // Data Product grid card, "View more" is meant to navigate like the rest
    // of the card, not expand in place, so the click must reach the ancestor.
    render(
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
      <div onClick={ancestorOnClick}>
        <RichTextEditorPreviewNew {...mockProp} />
      </div>
    );

    const contentElement = screen.getByTestId('markdown-parser');

    Object.defineProperty(contentElement, 'scrollHeight', {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(contentElement, 'clientHeight', {
      configurable: true,
      value: 100,
    });

    act(() => {
      resizeCallback([], mockResizeObserver.mock.results[0].value);
    });

    const readMoreButton = await screen.findByTestId('read-more-button');

    act(() => {
      fireEvent.click(readMoreButton);
    });

    expect(ancestorOnClick).toHaveBeenCalledTimes(1);
  });

  it('toggles readMore unconditionally on click, independent of any ancestor navigation — this is why it can flash before a deprioritized route change', async () => {
    // react-router's BrowserRouter (useTransitions enabled — see AppRoot.tsx's
    // `useTransitions={!isPlaywrightEnv()}`) wraps its history-driven location
    // update in React.startTransition (confirmed in
    // node_modules/react-router/dist/development/chunk-7XGYIT3M.js's
    // BrowserRouter: `React.startTransition(() => setStateImpl(newState))`).
    // A startTransition update is lower priority than this component's own
    // ordinary readMore toggle, so in a real browser React commits/paints the
    // expanded state first and only unmounts on the later, deprioritized
    // transition commit — confirmed with a live, non-jsdom reproduction
    // (screenshots + timestamped log) rather than here: React's test-mode
    // act() intentionally flushes startTransition updates synchronously, so
    // jsdom/RTL cannot observe the intermediate frame the way a real browser
    // paint loop does. What this test CAN verify is the actual cause: the
    // toggle below is unconditional and has no awareness of navigation at
    // all, which is exactly why disableExpand (tested below) is the real fix
    // rather than something jsdom happened to hide from the earlier test.
    const ancestorOnClick = jest.fn();

    render(
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
      <div onClick={ancestorOnClick}>
        <RichTextEditorPreviewNew {...mockProp} />
      </div>
    );

    const contentElement = screen.getByTestId('markdown-parser');

    Object.defineProperty(contentElement, 'scrollHeight', {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(contentElement, 'clientHeight', {
      configurable: true,
      value: 100,
    });

    act(() => {
      resizeCallback([], mockResizeObserver.mock.results[0].value);
    });

    const readMoreButton = await screen.findByTestId('read-more-button');

    fireEvent.click(readMoreButton);

    expect(screen.getByTestId('read-less-button')).toBeInTheDocument();
    expect(ancestorOnClick).toHaveBeenCalledTimes(1);
  });

  it('keeps the "View more" affordance visible but never flips readMore when disableExpand is set, so there is nothing to flash regardless of navigation timing', async () => {
    // enableSeeMoreVariant={false} was ruled out for the Data Product card:
    // it removes the "View more" button/text entirely (see the "should not
    // show view-more button when enableSeeMoreVariant is false" test above),
    // but the card still wants that affordance visible — just without it
    // ever locally expanding. disableExpand keeps the button (and overflow
    // detection) exactly as today, it just makes the click a no-op locally
    // so it has nothing to paint before an ancestor's click handler runs.
    render(<RichTextEditorPreviewNew {...mockProp} disableExpand />);

    const contentElement = screen.getByTestId('markdown-parser');

    Object.defineProperty(contentElement, 'scrollHeight', {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(contentElement, 'clientHeight', {
      configurable: true,
      value: 100,
    });

    act(() => {
      resizeCallback([], mockResizeObserver.mock.results[0].value);
    });

    const readMoreButton = await screen.findByTestId('read-more-button');

    fireEvent.click(readMoreButton);

    // Still says "View more" — it never became "View less".
    expect(screen.getByTestId('read-more-button')).toBeInTheDocument();
    expect(screen.queryByTestId('read-less-button')).not.toBeInTheDocument();
  });

  it('still bubbles the click to an ancestor onClick when disableExpand is set', async () => {
    const ancestorOnClick = jest.fn();

    render(
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
      <div onClick={ancestorOnClick}>
        <RichTextEditorPreviewNew {...mockProp} disableExpand />
      </div>
    );

    const contentElement = screen.getByTestId('markdown-parser');

    Object.defineProperty(contentElement, 'scrollHeight', {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(contentElement, 'clientHeight', {
      configurable: true,
      value: 100,
    });

    act(() => {
      resizeCallback([], mockResizeObserver.mock.results[0].value);
    });

    const readMoreButton = await screen.findByTestId('read-more-button');

    fireEvent.click(readMoreButton);

    expect(ancestorOnClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('read-less-button')).not.toBeInTheDocument();
  });

  it('should update content when markdown prop changes', () => {
    const { rerender } = render(
      <RichTextEditorPreviewNew {...mockProp} markdown="Initial content" />
    );

    expect(screen.getByTestId('block-editor')).toHaveTextContent(
      'Initial content'
    );

    rerender(
      <RichTextEditorPreviewNew {...mockProp} markdown="Updated content" />
    );

    expect(screen.getByTestId('block-editor')).toHaveTextContent(
      'Updated content'
    );
  });

  it('should update read more state when isDescriptionExpanded prop changes', async () => {
    const { rerender } = render(
      <RichTextEditorPreviewNew {...mockProp} isDescriptionExpanded={false} />
    );

    const contentElement = screen.getByTestId('markdown-parser');

    Object.defineProperty(contentElement, 'scrollHeight', {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(contentElement, 'clientHeight', {
      configurable: true,
      value: 100,
    });

    act(() => {
      resizeCallback([], mockResizeObserver.mock.results[0].value);
    });

    await waitFor(() => {
      expect(screen.getByTestId('read-more-button')).toBeInTheDocument();
    });

    rerender(<RichTextEditorPreviewNew {...mockProp} isDescriptionExpanded />);

    await waitFor(() => {
      expect(screen.queryByTestId('read-more-button')).not.toBeInTheDocument();
    });
  });

  it('should handle different maxLineLength values', () => {
    mockRealisticLineHeight();

    const { rerender } = render(
      <RichTextEditorPreviewNew {...mockProp} maxLineLength="2" />
    );

    let parser = screen.getByTestId('markdown-parser');

    expect(parser.style.maxHeight).toBe('42px');

    rerender(<RichTextEditorPreviewNew {...mockProp} maxLineLength="5" />);

    parser = screen.getByTestId('markdown-parser');

    expect(parser.style.maxHeight).toBe('105px');
  });

  it('should observe resize events', () => {
    const { unmount } = render(<RichTextEditorPreviewNew {...mockProp} />);

    const observeInstance = mockResizeObserver.mock.results[0].value;

    expect(observeInstance.observe).toHaveBeenCalled();

    unmount();

    expect(observeInstance.disconnect).toHaveBeenCalled();
  });

  it('should handle ResizeObserver cleanup on unmount', () => {
    const { unmount } = render(<RichTextEditorPreviewNew {...mockProp} />);

    const disconnectMock = mockResizeObserver.mock.results[0].value.disconnect;

    unmount();

    expect(disconnectMock).toHaveBeenCalled();
  });

  it('should render with default props', () => {
    render(<RichTextEditorPreviewNew />);

    expect(screen.getByText('label.no-description')).toBeInTheDocument();
  });

  it('should render view-more button with correct translation key', async () => {
    const mockT = jest.fn((key) => key);
    jest.spyOn(require('react-i18next'), 'useTranslation').mockReturnValue({
      t: mockT,
      i18n: { dir: () => 'ltr' },
    });

    render(<RichTextEditorPreviewNew {...mockProp} />);

    const contentElement = screen.getByTestId('markdown-parser');

    Object.defineProperty(contentElement, 'scrollHeight', {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(contentElement, 'clientHeight', {
      configurable: true,
      value: 100,
    });

    act(() => {
      resizeCallback([], mockResizeObserver.mock.results[0].value);
    });

    await waitFor(() => {
      expect(mockT).toHaveBeenCalledWith('label.view-more');
    });
  });

  it('should render view-less button with correct translation key', async () => {
    const mockT = jest.fn((key) => key);
    jest.spyOn(require('react-i18next'), 'useTranslation').mockReturnValue({
      t: mockT,
      i18n: { dir: () => 'ltr' },
    });

    render(<RichTextEditorPreviewNew {...mockProp} />);

    const contentElement = screen.getByTestId('markdown-parser');

    Object.defineProperty(contentElement, 'scrollHeight', {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(contentElement, 'clientHeight', {
      configurable: true,
      value: 100,
    });

    act(() => {
      resizeCallback([], mockResizeObserver.mock.results[0].value);
    });

    await waitFor(() => {
      const button = screen.getByTestId('read-more-button');
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(mockT).toHaveBeenCalledWith('label.view-less');
    });
  });

  it('should handle empty content after formatting', () => {
    render(<RichTextEditorPreviewNew {...mockProp} markdown="" />);

    expect(screen.getByText('label.no-description')).toBeInTheDocument();
  });

  it('should calculate maxHeight based on maxLineLength', () => {
    mockRealisticLineHeight();
    render(<RichTextEditorPreviewNew {...mockProp} maxLineLength="4" />);

    const parser = screen.getByTestId('markdown-parser');

    expect(parser.style.maxHeight).toBe('84px');
  });

  it('shows View more for content that genuinely exceeds the true 2-line height, using the real measured line-height', async () => {
    mockRealisticLineHeight();
    render(<RichTextEditorPreviewNew {...mockProp} maxLineLength="2" />);

    const contentElement = screen.getByTestId('markdown-parser');

    // Matches the live-reproduced bug exactly: 3 lines of real content at a
    // 21px line-height (63px natural height) against a correctly-computed
    // 2-line clamp (42px) — genuinely overflows and must show "View more".
    // Under the old buggy "maxLineLength * 2em" formula this would have
    // clamped to 56px (@14px font), which 63px also happens to exceed, but
    // only by 7px — enough to leave a barely-clipped third line visible
    // instead of a clean 2-line cut.
    Object.defineProperty(contentElement, 'scrollHeight', {
      configurable: true,
      value: 63,
    });
    Object.defineProperty(contentElement, 'clientHeight', {
      configurable: true,
      value: 42,
    });

    act(() => {
      resizeCallback([], mockResizeObserver.mock.results[0].value);
    });

    await waitFor(() => {
      expect(screen.getByTestId('read-more-button')).toBeInTheDocument();
    });
  });

  describe('clampByLines mode', () => {
    it('renders plain text (not the rich BlockEditor) while clamped and collapsed, so -webkit-line-clamp truncates over inline text instead of a block-level child', () => {
      render(<RichTextEditorPreviewNew {...mockProp} clampByLines />);

      const parser = screen.getByTestId('markdown-parser');

      expect(screen.queryByTestId('block-editor')).not.toBeInTheDocument();
      expect(parser.style.display).toBe('-webkit-box');
      expect(parser.style.WebkitBoxOrient).toBe('vertical');
      expect(parser.style.WebkitLineClamp).toBe('2');
    });

    it('swaps back to the real rich BlockEditor once expanded via View more', async () => {
      render(<RichTextEditorPreviewNew {...mockProp} clampByLines />);

      const contentElement = screen.getByTestId('markdown-parser');

      Object.defineProperty(contentElement, 'scrollHeight', {
        configurable: true,
        value: 200,
      });
      Object.defineProperty(contentElement, 'clientHeight', {
        configurable: true,
        value: 100,
      });

      act(() => {
        resizeCallback([], mockResizeObserver.mock.results[0].value);
      });

      const readMoreButton = await screen.findByTestId('read-more-button');

      expect(screen.queryByTestId('block-editor')).not.toBeInTheDocument();

      act(() => {
        fireEvent.click(readMoreButton);
      });

      expect(await screen.findByTestId('block-editor')).toBeInTheDocument();
    });
  });

  it('does not show View more for content that fits within the true 2-line height', async () => {
    mockRealisticLineHeight();
    render(<RichTextEditorPreviewNew {...mockProp} maxLineLength="2" />);

    const contentElement = screen.getByTestId('markdown-parser');

    // A single short line (21px) fits comfortably within the correct 42px
    // 2-line clamp — must not show "View more" at all.
    Object.defineProperty(contentElement, 'scrollHeight', {
      configurable: true,
      value: 21,
    });
    Object.defineProperty(contentElement, 'clientHeight', {
      configurable: true,
      value: 42,
    });

    act(() => {
      resizeCallback([], mockResizeObserver.mock.results[0].value);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('read-more-button')).not.toBeInTheDocument();
    });
  });
});
