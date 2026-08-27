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

const RichTextEditorPreviewerNew: FC<PreviewerProp> = ({
  markdown = '',
  className = '',
  enableSeeMoreVariant = true,
  textVariant = 'black',
  isDescriptionExpanded = false,
  maxLineLength = '2',
  disableExpand = false,
}) => {
  const { t, i18n } = useTranslation();
  // formatClientContent is a pure, synchronous transform (DOMParser-based
  // markdown->HTML + sanitisation, no I/O) — computing it directly instead of
  // via a state-setting effect skips an entire extra commit-then-effect
  // round trip on mount, so checkOverflow's layout effect below can measure
  // and clamp the real content on the very first commit instead of a
  // follow-up one.
  const content = useMemo(() => formatClientContent(markdown), [markdown]);
  const [readMore, setReadMore] = useState<boolean>(isDescriptionExpanded);
  const [isOverflowing, setIsOverflowing] = useState<boolean>(false);
  const [isContentLoaded, setIsContentLoaded] = useState<boolean>(false);
  // The real, measured line-height (px) for `maxLineLength` lines of this
  // instance's actual rendered content — see the effect below. Undefined only
  // for the first paint, before there is anything to measure yet.
  const [clampHeightPx, setClampHeightPx] = useState<number>();
  const contentRef = useRef<HTMLDivElement>(null);
  // Tracks whether we've already applied a real measured clampHeightPx once
  // *after* web fonts finished loading. `font-display: swap` (see
  // src/styles/inter-variable.css) means a cold paint first renders with the
  // system fallback font, then swaps to Inter once it loads — a different
  // font has different metrics, so the ResizeObserver fires again with a
  // corrected height right after the swap. If that correction were allowed
  // to animate, it looks identical to the mount-time estimate->measured
  // flash: content briefly grows/shrinks on its own. So no correction
  // animates until fonts have actually settled.
  const hasMeasuredOnceRef = useRef(false);
  const [fontsReady, setFontsReady] = useState<boolean>(
    () =>
      typeof document === 'undefined' || document.fonts?.status !== 'loading'
  );

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

  const clampStyle: Record<string, string | number> | undefined =
    useMemo(() => {
      if (readMore) {
        return undefined;
      }

      // Any correction is provisional (and must snap instantly) until fonts
      // are ready; once they are, only the first post-font-swap measurement
      // is instant — everything after that (an explicit toggle, or a later
      // genuine resize) still animates as before.
      const isProvisionalOrInitial =
        !fontsReady ||
        (clampHeightPx !== undefined && !hasMeasuredOnceRef.current);

      if (fontsReady && clampHeightPx !== undefined) {
        hasMeasuredOnceRef.current = true;
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
        transition: isProvisionalOrInitial ? 'none' : 'max-height 0.3s ease',
      };
    }, [readMore, maxLineLength, clampHeightPx, fontsReady]);

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

        el.style.maxHeight = `${targetHeight}px`;
        el.style.overflow = 'hidden';

        const { scrollHeight, clientHeight } = el;
        const isOverflow = scrollHeight > clientHeight + 1;

        el.style.maxHeight = originalMaxHeight;
        el.style.overflow = originalOverflow;

        setClampHeightPx(targetHeight);
        setIsOverflowing(isOverflow);
        setIsContentLoaded(true);
      }
    };

    checkOverflow();

    const resizeObserver = new ResizeObserver(checkOverflow);

    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [content, maxLineLength]);

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
          'is-clamped': !readMore && isOverflowing && enableSeeMoreVariant,
        })}
        data-testid="markdown-parser"
        ref={contentRef}
        style={clampStyle}>
        <BlockEditor
          // eslint-disable-next-line jsx-a11y/no-autofocus -- explicitly disabling editor autofocus
          autoFocus={false}
          content={content}
          editable={false}
        />
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
