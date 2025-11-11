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

import { Viewer } from '@toast-ui/react-editor';
import { Button } from 'antd';
import classNames from 'classnames';
import { uniqueId } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DESCRIPTION_MAX_PREVIEW_CHARACTERS } from '../../../constants/constants';
import { formatContent, isHTMLString } from '../../../utils/BlockEditorUtils';
import { getTrimmedContent } from '../../../utils/CommonUtils';
import {
  customHTMLRenderer,
  replaceLatex,
} from './CustomHtmlRederer/CustomHtmlRederer';
import './rich-text-editor-previewer.less';
import { PreviewerProp } from './RichTextEditor.interface';

/**
 * @deprecated This component is deprecated and will be removed in future releases.
 * Please use {@link https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/src/components/common/RichTextEditor/RichTextEditorPreviewerV1.tsx|RichTextEditorPreviewerV1} instead of this component.
 */
const RichTextEditorPreviewer = ({
  markdown = '',
  className = '',
  enableSeeMoreVariant = true,
  textVariant = 'black',
  showReadMoreBtn = true,
  maxLength = DESCRIPTION_MAX_PREVIEW_CHARACTERS,
  isDescriptionExpanded = false,
  reducePreviewLineClass,
}: PreviewerProp) => {
  const { t, i18n } = useTranslation();
  const [content, setContent] = useState<string>('');
  // initially read more will be false
  const [readMore, setReadMore] = useState<boolean>(false);

  // read more toggle handler
  const handleReadMoreToggle = () => setReadMore((pre) => !pre);

  // whether has read more content or not
  const hasReadMore = useMemo(
    () => enableSeeMoreVariant && markdown.length > maxLength,
    [enableSeeMoreVariant, markdown, maxLength]
  );

  /**
   * if hasReadMore is true then value will be based on read more state
   * else value will be content
   */
  const viewerValue = useMemo(() => {
    if (hasReadMore) {
      return readMore ? content : `${getTrimmedContent(content, maxLength)}...`;
    }

    return content;
  }, [hasReadMore, readMore, maxLength, content]);

  useEffect(() => {
    setContent(
      isHTMLString(markdown) ? formatContent(markdown, 'client') : markdown
    );
  }, [markdown]);

  const handleMouseDownEvent = useCallback(async (e: MouseEvent) => {
    const targetNode = e.target as HTMLElement;
    const previousSibling = targetNode.previousElementSibling as HTMLElement;
    const targetNodeDataTestId = targetNode.getAttribute('data-testid');

    if (targetNodeDataTestId === 'code-block-copy-icon' && previousSibling) {
      const codeNode = previousSibling.previousElementSibling;

      const content = codeNode?.textContent ?? '';

      try {
        await navigator.clipboard.writeText(content);
        previousSibling.setAttribute('data-copied', 'true');
        targetNode.setAttribute('data-copied', 'true');
        setTimeout(() => {
          previousSibling.setAttribute('data-copied', 'false');
          targetNode.setAttribute('data-copied', 'false');
        }, 2000);
      } catch (error) {
        // handle error
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('mousedown', handleMouseDownEvent);

    return () => window.removeEventListener('mousedown', handleMouseDownEvent);
  }, [handleMouseDownEvent]);

  useEffect(() => {
    setReadMore(Boolean(isDescriptionExpanded));
  }, [isDescriptionExpanded]);

  return (
    <div
      className={classNames('rich-text-editor-container', className, {
        'text-right': i18n.dir() === 'rtl',
      })}
      data-testid="viewer-container"
      dir={i18n.dir()}>
      <div
        className={classNames(
          'markdown-parser',
          textVariant,
          readMore ? '' : reducePreviewLineClass
        )}
        data-testid="markdown-parser">
        <Viewer
          extendedAutolinks
          customHTMLRenderer={customHTMLRenderer}
          initialValue={replaceLatex(viewerValue)}
          key={uniqueId()}
          linkAttributes={{ target: '_blank' }}
        />
      </div>
      {hasReadMore && showReadMoreBtn && (
        <Button
          className="text-xs text-right"
          data-testid={`read-${readMore ? 'less' : 'more'}-button`}
          type="link"
          onClick={handleReadMoreToggle}>
          {readMore ? t('label.less-lowercase') : t('label.more-lowercase')}
        </Button>
      )}
    </div>
  );
};

export default RichTextEditorPreviewer;
