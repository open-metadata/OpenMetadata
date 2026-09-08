/*
 *  Copyright 2024 Collate.
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

import { Box, Typography } from '@openmetadata/ui-core-components';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../../../constants/constants';
import { isDescriptionContentEmpty } from '../../../../../utils/BlockEditorPureUtils';
import RichTextEditorPreviewerV1 from '../../../RichTextEditor/RichTextEditorPreviewerV1';


export const DataProductDescriptionField = ({
  description,
}: {
  description?: string;
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  const checkTruncation = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const measureNode =
      container.querySelector<HTMLElement>('.markdown-parser') ?? container;
    setIsTruncated(measureNode.scrollHeight > measureNode.clientHeight + 1);
  }, []);

  useEffect(() => {
    checkTruncation();
  }, [description, checkTruncation]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') {
      return;
    }
    
    const observer = new ResizeObserver(checkTruncation);
    observer.observe(container);

    return () => observer.disconnect();
  }, [checkTruncation]);

  if (isDescriptionContentEmpty(description ?? '')) {
    return <Typography size="text-sm">{NO_DATA_PLACEHOLDER}</Typography>;
  }

  return (
    <Box direction="col" gap={1}>
      <div
        className="tw:text-sm tw:break-words tw:[&_.markdown-parser]:line-clamp-2"
        ref={containerRef}>
        <RichTextEditorPreviewerV1
          enableSeeMoreVariant={false}
          markdown={description ?? ''}
        />
      </div>
      {isTruncated && (
        <Typography className="tw:text-brand-secondary" size="text-xs">
          {t('label.view-more')}
        </Typography>
      )}
    </Box>
  );
};
