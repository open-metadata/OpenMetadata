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

import { File06 } from '@untitledui/icons';
import { ReactComponent as DOCIcon } from '../assets/svg/ic-doc.svg';
import { ReactComponent as ImageIcon } from '../assets/svg/ic-image.svg';
import { ReactComponent as PDFIcon } from '../assets/svg/ic-pdf.svg';
import { ReactComponent as XLSIcon } from '../assets/svg/ic-xls.svg';

export {
  assetToDocumentItem,
  contextFileToDocumentItem,
  contextFileToUploadedDocumentItem,
  CONTEXT_CENTER_DOCUMENTS_ENTITY_LINK,
  CONTEXT_CENTER_DOCUMENTS_FQN,
  createArticleKnowledgePage,
  fetchContextCenterDocuments,
  formatBytes,
  handleAssetDownload,
  knowledgePageToArticleItem,
} from './ContextCenterPureUtils';

export const getFileTypeIcon = (fileType: string) => {
  const commonProps = {
    width: 32,
    height: 32,
  };
  switch (fileType) {
    case 'doc':
      return <DOCIcon {...commonProps} />;
    case 'pdf':
      return <PDFIcon {...commonProps} />;
    case 'xls':
      return <XLSIcon {...commonProps} />;
    case 'image':
      return <ImageIcon {...commonProps} />;
    default:
      return (
        <File06
          strokeWidth={1.2}
          {...commonProps}
          className="tw:text-gray-500"
        />
      );
  }
};
