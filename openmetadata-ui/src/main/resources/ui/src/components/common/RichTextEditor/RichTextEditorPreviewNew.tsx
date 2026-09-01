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
import { FC, lazy, useEffect, useMemo, useRef, useState } from 'react';
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

const RichTextEditorPreviewerNew: FC<PreviewerProp> = ({
  markdown = '',
  className = '',
  enableSeeMoreVariant = true,
  textVariant = 'black',
  isDescriptionExpanded = false,
  maxLineLength = '2',
  clampByLines = false,
}) => {
  const { t, i18n } = useTranslation();
  const [content, setContent] = useState<string>('');
  const [readMore, setReadMore] = useState<boolean>(isDescriptionExpanded);
  const [isOverflowing, setIsOverflowing] = useState<boolean>(false);
  const [isContentLoaded, setIsContentLoaded] = useState<boolean>(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const clampStyle: Record<string, string | number> | undefined =
    useMemo(() => {
      if (readMore) {
        return undefined;
      }

      // clampByLines clamps to an exact number of text lines (clean cut-off,
      // no partial last line), instead of the height-based approximation.
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
        maxHeight: `${Number(maxLineLength) * 2}em`,
        transition: 'max-height 0.3s ease',
      };
    }, [readMore, maxLineLength, clampByLines]);

  const handleReadMoreToggle = () => setReadMore((prev) => !prev);

  useEffect(() => {
    setContent(formatClientContent(markdown));
    setIsContentLoaded(false);
    setIsOverflowing(false);
  }, [markdown]);

  useEffect(() => {
    setReadMore(isDescriptionExpanded);
  }, [isDescriptionExpanded]);

  useEffect(() => {
    if (!content) {
      return;
    }

    const checkOverflow = () => {
      if (contentRef.current) {
        const el = contentRef.current;

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
          el.style.maxHeight = `${Number(maxLineLength) * 2}em`;
          el.style.overflow = 'hidden';
        }

        const { scrollHeight, clientHeight } = el;
        const isOverflow = scrollHeight > clientHeight + 1;

        el.style.maxHeight = originalMaxHeight;
        el.style.overflow = originalOverflow;
        el.style.display = originalDisplay;
        el.style.setProperty('-webkit-line-clamp', originalLineClamp);
        el.style.setProperty('-webkit-box-orient', originalBoxOrient);

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
