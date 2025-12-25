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
import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  formatContent,
  isDescriptionContentEmpty,
} from '../../../utils/BlockEditorUtils';
import BlockEditor from '../../BlockEditor/BlockEditor';
import './rich-text-editor-previewerV1.less';
import { PreviewerProp } from './RichTextEditor.interface';

const RichTextEditorPreviewerNew: FC<PreviewerProp> = ({
  markdown = '',
  className = '',
  enableSeeMoreVariant = true,
  textVariant = 'black',
  isDescriptionExpanded = false,
  maxLineLength = '2',
}) => {
  const { t, i18n } = useTranslation();
  const [content, setContent] = useState<string>('');
  const [readMore, setReadMore] = useState<boolean>(isDescriptionExpanded);
  const [isOverflowing, setIsOverflowing] = useState<boolean>(false);
  const [isContentLoaded, setIsContentLoaded] = useState<boolean>(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const clampStyle: Record<string, string | number> | undefined = useMemo(
    () =>
      readMore
        ? undefined
        : {
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: Number(maxLineLength),
            overflow: 'hidden',
            maxHeight: `${Number(maxLineLength) * 2}em`,
            transition: 'max-height 0.3s ease',
          },
    [readMore, maxLineLength]
  );

  const handleReadMoreToggle = () => setReadMore((prev) => !prev);

  useEffect(() => {
    setContent(formatContent(markdown, 'client'));
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

        // Save original styles
        const originalDisplay = el.style.display;
        const originalBoxOrient = el.style.webkitBoxOrient;
        const originalOverflow = el.style.overflow;
        const originalLineClamp = el.style.webkitLineClamp;

        // Temporarily apply line-clamp to measure overflow
        el.style.display = '-webkit-box';
        el.style.webkitBoxOrient = 'vertical';
        el.style.overflow = 'hidden';
        el.style.webkitLineClamp = maxLineLength;

        // Check if content overflows
        const { scrollHeight, clientHeight } = el;
        const isOverflow = scrollHeight > clientHeight + 1;

        // Restore original styles
        el.style.display = originalDisplay;
        el.style.webkitBoxOrient = originalBoxOrient;
        el.style.overflow = originalOverflow;
        el.style.webkitLineClamp = originalLineClamp;

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
        className={classNames('markdown-parser', textVariant)}
        data-testid="markdown-parser"
        ref={contentRef}
        style={clampStyle}>
        <BlockEditor autoFocus={false} content={content} editable={false} />
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
