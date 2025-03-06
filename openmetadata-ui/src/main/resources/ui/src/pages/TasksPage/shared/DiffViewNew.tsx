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

import classNames from 'classnames';
import { Change } from 'diff';
import { uniqueId } from 'lodash';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Thread,
  ThreadTaskStatus,
} from '../../../generated/entity/feed/thread';

export const DiffViewNew = ({
  diffArr,
  showDescTitle = false,
  task,
}: {
  diffArr: Change[];
  className?: string;
  showDescTitle?: boolean;
  task?: Thread;
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [shouldShowViewMore, setShouldShowViewMore] = useState<boolean>(false);
  const contentRef = useRef<HTMLDivElement>(null);

  function stripHtml(html: string) {
    return html
      .replace(/<(?!\/?strong\b)[^>]+>/g, '')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .trim();
  }

  const elements = diffArr.map((diff) => {
    const diffValue = stripHtml(diff.value);
    if (diff.added) {
      return (
        <ins
          className="diff-added-new"
          dangerouslySetInnerHTML={{ __html: diffValue }}
          data-testid="diff-added"
          key={uniqueId()}
        />
      );
    }
    if (diff.removed) {
      return (
        <del
          className="diff-removed-new"
          dangerouslySetInnerHTML={{ __html: diffValue }}
          data-testid="diff-removed-new"
          key={uniqueId()}
        />
      );
    }

    return (
      <span
        className="diff-normal-new"
        dangerouslySetInnerHTML={{ __html: diffValue }}
        data-testid="diff-normal-new"
        key={uniqueId()}
      />
    );
  });

  // Check if content exceeds the clamp height
  useEffect(() => {
    const checkHeight = () => {
      if (contentRef.current) {
        const element = contentRef.current;
        // Get the line height and max lines from CSS
        const lineHeight = parseInt(
          window.getComputedStyle(element).lineHeight
        );
        const maxLines = showDescTitle ? 3 : 2;
        const maxHeight = lineHeight * maxLines;

        setShouldShowViewMore(element.scrollHeight > maxHeight);
      }
    };

    checkHeight();
    // Add resize listener to recheck on window resize
    window.addEventListener('resize', checkHeight);

    return () => window.removeEventListener('resize', checkHeight);
  }, [diffArr, showDescTitle]);

  return (
    <div
      className={classNames('w-full overflow-y-auto p-md border-radius-xs', {
        'diff-view-container-card': !showDescTitle,
        'diff-view-container-card-right-panel': showDescTitle,
      })}
      style={{
        ...(showDescTitle
          ? {
              background: 'rgba(239, 244, 250, 0.25)',
              borderRadius: '12px',
            }
          : {
              padding: '20px',
              borderRadius: '8px',
              background: 'white',
              margin: '16px 0px',
            }),
        ...(task?.task?.status === ThreadTaskStatus.Closed &&
          !showDescTitle && {
            margin: '16px 0px',
          }),
        ...(task?.task?.status === ThreadTaskStatus.Open && {
          borderRadius: '8px',
        }),
      }}>
      {showDescTitle && (
        <span className="task-tab-description-header">
          {t('label.description')}
        </span>
      )}
      <pre
        className="whitespace-pre-wrap m-b-0"
        data-testid="diff-container"
        style={showDescTitle ? { marginTop: '14px' } : {}}>
        {diffArr.length ? (
          <>
            <div
              className={classNames(
                'relative',
                expanded
                  ? ''
                  : showDescTitle
                  ? 'clamp-text-3 overflow-hidden'
                  : 'clamp-text-2  overflow-hidden'
              )}
              ref={contentRef}>
              {elements}
            </div>
            {!expanded && shouldShowViewMore && (
              <span className="text-expand" onClick={() => setExpanded(true)}>
                {t('label.view-more')}
              </span>
            )}
            {expanded && shouldShowViewMore && (
              <span className="text-expand" onClick={() => setExpanded(false)}>
                {t('label.view-less')}
              </span>
            )}
          </>
        ) : (
          <span className="text-grey-muted" data-testid="noDiff-placeholder">
            {t('label.no-diff-available')}
          </span>
        )}
      </pre>
    </div>
  );
};
