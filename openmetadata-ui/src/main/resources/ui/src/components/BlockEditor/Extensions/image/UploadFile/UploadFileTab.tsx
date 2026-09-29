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
import { FileUpload } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { isEmpty, isUndefined } from 'lodash';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../../../enums/entity.enum';
import { AssetType } from '../../../../../generated/attachments/asset';
import { uploadAsset } from '../../../../../rest/assetAPI';
import { getAcceptedFileTypes } from '../../../../../utils/BlockEditorUtils';
import EntityLink from '../../../../../utils/EntityLink';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import { useEntityAttachment } from '../../../../common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider';
import { ImagePopoverContentProps } from '../ImageComponent.interface';

const UploadFileTab = ({
  updateAttributes,
  onPopupVisibleChange,
  onUploadingChange,
  fileType,
}: ImagePopoverContentProps) => {
  const { entityType, entityFqn = '' } = useEntityAttachment();
  const { t } = useTranslation();

  const handleUpload = async (files: FileList) => {
    const file = files[0];
    if (isUndefined(entityType) || isEmpty(entityFqn)) {
      showErrorToast(t('message.image-upload-after-asset-creation'));

      return;
    }

    try {
      onUploadingChange(true);
      const response = await uploadAsset(
        file,
        EntityLink.getEntityLink(
          entityType,
          entityFqn,
          entityType === EntityType.KNOWLEDGE_PAGE ? undefined : 'description'
        ),
        AssetType.Inline
      );
      updateAttributes({
        src: response.url,
        alt: file.name,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });
      onPopupVisibleChange(false);
    } catch (error) {
      showErrorToast(error as AxiosError, t('label.failed-to-upload-file'));
    } finally {
      onUploadingChange(false);
    }
  };

  return (
    <FileUpload.DropZone
      accept={getAcceptedFileTypes(fileType)}
      allowsMultiple={false}
      clickToUploadLabel={t('label.click-to-upload')}
      data-testid="upload-file-dropzone"
      input-data-testid="upload-file-input"
      isDisabled={isUndefined(entityType) || isEmpty(entityFqn)}
      orDragAndDropLabel={t('label.or-drag-and-drop')}
      onDropFiles={handleUpload}
    />
  );
};

export default UploadFileTab;
