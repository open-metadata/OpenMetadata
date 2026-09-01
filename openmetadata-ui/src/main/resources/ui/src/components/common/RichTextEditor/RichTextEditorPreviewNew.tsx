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
import { Button } from 'antd';
import classNames from 'classnames';
import {
  CSSProperties,
  FC,
  lazy,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  formatClientContent,
  isDescriptionContentEmpty,
} from '../../../utils/BlockEditorPureUtils';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import './rich-text-editor-previewerV1.less';
import { PreviewerProp } from './RichTextEditor.interface';
const BlockEditor = withSuspenseFallback(
  lazy(() => import('../../BlockEditor/BlockEditor'))
);

// Best-effort default for the very first paint's optimistic clamp, before
// checkOverflow has measured anything real. Matches this component's typical
// rendered typography (.tiptap.ProseMirror: font-size var(--om-font-size-sm)
// = 14px, .om-leading-normal: line-height 1.5 = 21px/line) — close enough
// that most instances need no visible correction at all. A consumer with a
// genuinely different font-size still gets corrected by the real
// measurement below; this only shrinks how far off the very first frame is.
const DEFAULT_LINE_HEIGHT_PX = 21;

// Matches a block-level closing tag or a self-closing line break, so a
// separator can be inserted at each one before extracting plain text —
// textContent concatenates text nodes with no regard for block boundaries
// (e.g. "<h1>Title</h1><p>body</p>".textContent is "Titlebody", not
// "Title body"), so adjacent blocks would otherwise run together.
const BLOCK_BOUNDARY_REGEX =
  /<\/(p|div|h[1-6]|li|ul|ol|blockquote|pre|table|tr|thead|tbody)>|<(?:br|hr)\s*\/?>/gi;

const RichTextEditorPreviewerNew: FC<PreviewerProp> = ({
  markdown = '',
  className = '',
  enableSeeMoreVariant = true,
  textVariant = 'black',
  isDescriptionExpanded = false,
  maxLineLength = '2',
  disableExpand = false,
  clampByLines = false,
}) => {
  const { t, i18n } = useTranslation();
  // formatClientContent is a pure, synchronous transform (DOMParser-based
  // markdown->HTML + sanitisation, no I/O) — computing it directly instead of
  // via a state-setting effect skips an entire extra commit-then-effect
  // round trip on mount, so checkOverflow's layout effect below can measure
  // and clamp the real content on the very first commit instead of a
  // follow-up one.
  const content = useMemo(() => formatClientContent(markdown), [markdown]);
  // clampByLines applies -webkit-line-clamp to contentRef, which only
  // reliably truncates over inline/text content -- BlockEditor's rendered
  // root is a block-level wrapper (see BlockEditor.tsx), so clamping across
  // browsers is inconsistent when it sits directly inside the clamped box.
  // Render plain text instead while collapsed so the clamped box's direct
  // child is text, and swap back to the real rich BlockEditor once expanded.
  // Extracted via the DOM (not a tag-stripping regex) so entities decode
  // correctly (`&amp;` -> `&`), with a separator inserted at each block
  // boundary first so adjacent blocks don't run into one word.
  const plainTextContent = useMemo(() => {
    if (!clampByLines) {
      return '';
    }

    const withBlockSeparators = content.replace(BLOCK_BOUNDARY_REGEX, '$& ');
    const doc = new DOMParser().parseFromString(
      withBlockSeparators,
      'text/html'
    );

    return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
  }, [clampByLines, content]);
  const [readMore, setReadMore] = useState<boolean>(isDescriptionExpanded);
  const [isOverflowing, setIsOverflowing] = useState<boolean>(false);
  const [isContentLoaded, setIsContentLoaded] = useState<boolean>(false);
  // The real, measured line-height (px) for `maxLineLength` lines of this
  // instance's actual rendered content — see the effect below. Undefined only
  // for the first paint, before there is anything to measure yet.
  const [clampHeightPx, setClampHeightPx] = useState<number>();
  // Whether the *next* clampHeightPx paint should snap instantly rather than
  // animate. Computed and set together with clampHeightPx inside
  // checkOverflow's layout effect below (see the comment there) — never
  // computed or written inside clampStyle's memo, which must stay a pure
  // read of state/props: useMemo isn't guaranteed to run exactly once per
  // commit (e.g. under StrictMode's double-render), so a side effect (or a
  // ref read used as if it were fresh state) inside it is unsafe.
  const [isInstantTransition, setIsInstantTransition] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  // Tracks whether a real measurement has ever landed *after* web fonts
  // finished loading. `font-display: swap` (see src/styles/inter-variable.css)
  // means a cold paint first renders with the system fallback font, then
  // swaps to Inter once it loads — a different font has different metrics,
  // so the ResizeObserver fires again with a corrected height right after
  // the swap. If that correction were allowed to animate, it looks identical
  // to the mount-time estimate->measured flash: content briefly
  // grows/shrinks on its own. So no correction animates until fonts have
  // actually settled, and only the first one after they do is instant.
  const hasMeasuredOnceRef = useRef(false);
  const [fontsReady, setFontsReady] = useState<boolean>(
    () =>
      typeof document === 'undefined' || document.fonts?.status !== 'loading'
  );
  // Mirrors `fontsReady` for checkOverflow's closure below: that closure is
  // captured once per layout-effect run (tied to [content, maxLineLength]),
  // but can go on to fire many times via the Resize/MutationObservers it
  // sets up — reading the `fontsReady` state variable directly there would
  // see a stale snapshot from whenever the effect last ran, not the latest
  // value. A ref's `.current` is always current regardless of which closure
  // reads it.
  const fontsReadyRef = useRef(fontsReady);
  fontsReadyRef.current = fontsReady;

  useEffect(() => {
    if (fontsReady || typeof document === 'undefined' || !document.fonts) {
      return;
    }

    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) {
        setFontsReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [fontsReady]);

  const clampStyle: CSSProperties | undefined = useMemo(() => {
    if (readMore) {
      return undefined;
    }

    // clampByLines clamps to an exact number of text lines (clean cut-off,
    // no partial last line) via -webkit-line-clamp, instead of the
    // height-based approximation below.
    if (clampByLines) {
      return {
        display: '-webkit-box',
        WebkitBoxOrient: 'vertical',
        WebkitLineClamp: Number(maxLineLength),
        overflow: 'hidden',
      };
    }

    return {
      overflow: 'hidden',
      // Before the first real measurement lands, fall back to the
      // DEFAULT_LINE_HEIGHT_PX estimate so content is never shown fully
      // unclamped; checkOverflow (in a layout effect, so before paint in
      // the common case) corrects it to the real per-instance value.
      maxHeight:
        clampHeightPx !== undefined
          ? `${clampHeightPx}px`
          : `${Number(maxLineLength) * DEFAULT_LINE_HEIGHT_PX}px`,
      transition: isInstantTransition ? 'none' : 'max-height 0.3s ease',
    };
  }, [
    readMore,
    maxLineLength,
    clampByLines,
    clampHeightPx,
    isInstantTransition,
  ]);

  const handleReadMoreToggle = () => {
    // When disableExpand is set, the button stays a pure "View more" affordance
    // that never flips local state — the click is left to bubble to an
    // ancestor (e.g. a clickable card that navigates instead of expanding).
    // Toggling readMore here would still commit and paint before a
    // startTransition-wrapped navigation (react-router's BrowserRouter wraps
    // its location update in one), producing a visible flash of the expanded
    // state right before the page navigates away.
    if (disableExpand) {
      return;
    }
    setReadMore((prev) => !prev);
  };

  useEffect(() => {
    setReadMore(isDescriptionExpanded);
  }, [isDescriptionExpanded]);

  // useLayoutEffect (not useEffect) so the real measurement runs, and the
  // clamp/overflow state fully settles, before the browser paints this
  // commit — otherwise the fallback estimate above paints first and the
  // real value visibly corrects it a frame later, especially noticeable
  // when a whole grid of cards mounts at once.
  useLayoutEffect(() => {
    if (!content) {
      return;
    }

    const checkOverflow = () => {
      if (contentRef.current) {
        const el = contentRef.current;

        // Measure the real rendered line-height instead of assuming a fixed
        // em-per-line ratio: a hardcoded multiplier drifts from the true line
        // box height whenever a consumer's actual line-height differs (e.g.
        // this content renders at 1.5em, so a "* 2" formula clamped to ~2.67
        // lines instead of exactly maxLineLength, letting an extra line's
        // glyphs show through while still reporting overflow).
        const computedStyle = getComputedStyle(el);
        const parsedLineHeight = parseFloat(computedStyle.lineHeight);
        const fontSize = parseFloat(computedStyle.fontSize) || 16;
        const lineHeight = Number.isNaN(parsedLineHeight)
          ? fontSize * 1.2
          : parsedLineHeight;
        const targetHeight = lineHeight * Number(maxLineLength);

        const originalMaxHeight = el.style.maxHeight;
        const originalOverflow = el.style.overflow;
        const originalDisplay = el.style.display;
        const originalLineClamp =
          el.style.getPropertyValue('-webkit-line-clamp');
        const originalBoxOrient =
          el.style.getPropertyValue('-webkit-box-orient');

        // Measure overflow with the same clamp the view uses, so the
        // view-more toggle appears exactly when content exceeds the clamp.
        if (clampByLines) {
          el.style.display = '-webkit-box';
          el.style.setProperty('-webkit-box-orient', 'vertical');
          el.style.setProperty(
            '-webkit-line-clamp',
            `${Number(maxLineLength)}`
          );
          el.style.overflow = 'hidden';
        } else {
          el.style.maxHeight = `${targetHeight}px`;
          el.style.overflow = 'hidden';
        }

        const { scrollHeight, clientHeight } = el;
        const isOverflow = scrollHeight > clientHeight + 1;

        el.style.maxHeight = originalMaxHeight;
        el.style.overflow = originalOverflow;
        el.style.display = originalDisplay;
        el.style.setProperty('-webkit-line-clamp', originalLineClamp);
        el.style.setProperty('-webkit-box-orient', originalBoxOrient);

        // Computed here, from the ref's value *before* this measurement
        // updates it below — this is "was a real measurement already taken
        // after fonts were ready, prior to this one" — then stored as its
        // own state (isInstantTransition) so clampStyle's memo only ever
        // needs to read state, not decide anything or touch the ref itself.
        const isInstant = !fontsReadyRef.current || !hasMeasuredOnceRef.current;

        setClampHeightPx(targetHeight);
        setIsOverflowing(isOverflow);
        setIsContentLoaded(true);
        setIsInstantTransition(isInstant);

        if (fontsReadyRef.current) {
          hasMeasuredOnceRef.current = true;
        }
      }
    };

    checkOverflow();

    const resizeObserver = new ResizeObserver(checkOverflow);

    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }

    // BlockEditor applies a changed `content` prop asynchronously: its own
    // content-sync effect (BlockEditor.tsx) defers the actual
    // editor.commands.setContent(...) call via setTimeout to avoid a tiptap
    // flushSync warning. So when `content` changes here, this effect's own
    // eager checkOverflow() call above can run *before* that DOM update has
    // landed, measuring the still-old content and reporting stale overflow
    // state (e.g. "View more" staying visible after an edit that made the
    // content fit). A MutationObserver ties the re-measurement to the real
    // DOM mutation itself, whenever it actually lands, instead of guessing
    // at timing relative to React's render/effect cycle.
    const mutationObserver = new MutationObserver(checkOverflow);

    if (contentRef.current) {
      mutationObserver.observe(contentRef.current, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [content, maxLineLength, clampByLines]);

  if (isDescriptionContentEmpty(markdown)) {
    return <span className="text-grey-muted">{t('label.no-description')}</span>;
  }

  return (
    <div
      className={classNames('rich-text-editor-container', className, {
        'text-right': i18n.dir() === 'rtl',
      })}
      data-testid="viewer-container"
      dir={i18n.dir()}>
      <div
        className={classNames('markdown-parser', textVariant, {
          'is-clamped':
            !readMore && isOverflowing && enableSeeMoreVariant && !clampByLines,
        })}
        data-testid="markdown-parser"
        ref={contentRef}
        style={clampStyle}>
        {clampByLines && !readMore ? (
          plainTextContent
        ) : (
          <BlockEditor
            // eslint-disable-next-line jsx-a11y/no-autofocus -- explicitly disabling editor autofocus
            autoFocus={false}
            content={content}
            editable={false}
          />
        )}
      </div>
      {isContentLoaded && isOverflowing && enableSeeMoreVariant && (
        <Button
          className="text-right view-more-less-button"
          data-testid={`read-${readMore ? 'less' : 'more'}-button`}
          type="link"
          onClick={handleReadMoreToggle}>
          {readMore ? t('label.view-less') : t('label.view-more')}
        </Button>
      )}
    </div>
  );
};

export default RichTextEditorPreviewerNew;
