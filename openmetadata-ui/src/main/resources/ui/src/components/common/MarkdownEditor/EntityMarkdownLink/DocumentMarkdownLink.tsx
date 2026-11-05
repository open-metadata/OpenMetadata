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

import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { Link } from 'react-router-dom';
import { listContextFiles } from '../../../../rest/assetAPI';

interface DocumentMarkdownLinkProps {
  assetId: string;
  documentsRoute: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Opens the Context Center document that is a view of a stored asset.
 *
 * The lookup runs when the link renders, not when it is clicked: a link whose target is only known
 * on click cannot be opened in a new tab or hovered for its destination. Until the document is
 * found — or when there is none, because the upload was never sent or the document was deleted —
 * the text renders as plain text rather than as a link that goes nowhere.
 */
const DocumentMarkdownLink: React.FC<DocumentMarkdownLinkProps> = ({
  assetId,
  documentsRoute,
  className,
  children,
}) => {
  const { data: documentId } = useQuery({
    queryKey: ['contextFile', 'byAsset', assetId],
    queryFn: async () =>
      (await listContextFiles({ assetId, limit: 1 })).data[0]?.id ?? null,
    staleTime: 5 * 60 * 1000,
  });

  if (!documentId) {
    return <span className={className}>{children}</span>;
  }

  return (
    <Link
      className={`entity-markdown-link ${className || ''}`}
      to={`${documentsRoute}?document=${encodeURIComponent(documentId)}`}>
      {children}
    </Link>
  );
};

export default DocumentMarkdownLink;
