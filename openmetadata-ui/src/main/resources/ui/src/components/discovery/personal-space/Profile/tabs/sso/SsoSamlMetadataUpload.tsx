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

import { Alert, Button, FileUpload } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';

interface SsoSamlMetadataUploadProps {
  status: 'success' | 'error' | null;
  fileName: string;
  onUpload: (files: FileList) => void;
  onChangeFile: () => void;
}

/** Drop zone for the IdP metadata XML, then the parse result with a way to pick another file. */
const SsoSamlMetadataUpload = ({
  status,
  fileName,
  onUpload,
  onChangeFile,
}: SsoSamlMetadataUploadProps) => {
  const { t } = useTranslation();

  if (status === null) {
    return (
      <FileUpload.DropZone
        accept=".xml,application/xml,text/xml"
        allowsMultiple={false}
        clickToUploadLabel={t('label.click-to-upload')}
        data-testid="sso-saml-metadata-upload"
        hint={t('message.upload-saml-metadata-xml-description')}
        input-data-testid="sso-saml-metadata-input"
        orDragAndDropLabel={t('label.or-drag-and-drop-an-xml-file-here')}
        onDropFiles={onUpload}
      />
    );
  }

  return (
    <Alert
      data-testid="sso-saml-metadata-status"
      rightContent={
        <Button
          color="link-color"
          data-testid="change-metadata-xml-btn"
          size="sm"
          onPress={onChangeFile}>
          {t('label.change-entity', { entity: t('label.file') })}
        </Button>
      }
      title={t(
        status === 'success'
          ? 'message.metadata-xml-file-parsed-success'
          : 'message.metadata-xml-file-parsed-error',
        { fileName }
      )}
      variant={status}
    />
  );
};

export default SsoSamlMetadataUpload;
