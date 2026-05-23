/*
 *  Copyright 2026 Collate.
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
  Button,
  Card,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { ArrowUpRight, Upload01 } from '@untitledui/icons';
import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import UploadedDocumentCard from '../UploadedDocumentCard/UploadedDocumentCard.component';
import { UploadedDocumentItem } from '../UploadedDocumentCard/UploadedDocumentCard.interface';
import { UploadedDocumentsSectionProps } from './UploadedDocumentsSection.interface';

const DocumentCardSkeleton: FC = () => (
  <Card className="tw:flex tw:flex-col tw:gap-3 tw:p-3">
    <Skeleton height="120px" variant="rectangular" width="100%" />
    <div className="tw:flex tw:flex-col tw:gap-1">
      <Skeleton height="12px" variant="rounded" width="75%" />
      <div className="tw:flex tw:justify-between">
        <Skeleton height="12px" variant="rounded" width="40px" />
        <Skeleton height="12px" variant="rounded" width="64px" />
      </div>
    </div>
  </Card>
);

const DOCUMENT_SKELETON_KEYS = Array.from(
  { length: 8 },
  (_, i) => `doc-skeleton-${i}`
);

const UploadedDocumentSectionLoading = () =>
  DOCUMENT_SKELETON_KEYS.map((key) => <DocumentCardSkeleton key={key} />);

const CARD_WIDTH = 168;
const CARD_GAP = 16;

const UploadedDocumentsSection: FC<UploadedDocumentsSectionProps> = ({
  documents,
  onViewAll,
  onDocumentClick,
  onDownload,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxCards, setMaxCards] = useState(8);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      const count = Math.max(
        1,
        Math.floor((width + CARD_GAP) / (CARD_WIDTH + CARD_GAP))
      );
      setMaxCards(count);
    });
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  const documentsToShow = useMemo(
    () => documents.slice(0, maxCards),
    [documents, maxCards]
  );

  return (
    <Card className="tw:p-6" data-testid="uploaded-documents-section">
      <div className="tw:flex tw:items-center tw:justify-between tw:pb-5">
        <div className="tw:flex tw:items-center tw:gap-3">
          <div className="tw:p-3 tw:rounded-lg tw:bg-gray-blue-50 tw:leading-0">
            <Upload01 className="tw:text-gray-600" height={20} width={20} />
          </div>
          <div className="tw:flex tw:flex-col">
            <Typography size="text-md" weight="semibold">
              {t('label.uploaded-document-plural')}
            </Typography>
            <Typography className="tw:text-gray-500" size="text-xs">
              {t('message.manual-upload-agent-context')}
            </Typography>
          </div>
        </div>

        {onViewAll && (
          <Button
            color="link-color"
            iconTrailing={<ArrowUpRight className="tw:w-4 tw:h-4" />}
            onClick={onViewAll}>
            {t('label.view-all')}
          </Button>
        )}
      </div>

      {documents.length > 0 || isLoading ? (
        <div
          className="tw:grid tw:gap-4"
          ref={containerRef}
          style={{ gridTemplateColumns: `repeat(${maxCards}, 1fr)` }}>
          {isLoading ? (
            <UploadedDocumentSectionLoading />
          ) : (
            documentsToShow.map((doc: UploadedDocumentItem) => (
              <UploadedDocumentCard
                document={doc}
                key={doc.id}
                onClick={onDocumentClick}
                onDownload={onDownload}
              />
            ))
          )}
        </div>
      ) : (
        <ErrorPlaceHolder
          className="tw:border-0 tw:h-auto"
          type={ERROR_PLACEHOLDER_TYPE.NO_DATA}
        />
      )}
    </Card>
  );
};

export default UploadedDocumentsSection;
