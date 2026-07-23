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
import { isUndefined } from 'lodash';
import { EntityType } from '../../../../enums/entity.enum';
import { AssetType } from '../../../../generated/attachments/asset';
import { useAuthenticatedFile } from '../../../../hooks/useAuthenticatedFile';
import { useAuthenticatedImage } from '../../../../hooks/useAuthenticatedImage';
import { uploadAsset } from '../../../../rest/assetAPI';
import EntityLink from '../../../../utils/EntityLink';
import i18n from '../../../../utils/i18next/LocalUtil';
import { BlockEditorAttachmentProps } from '../../BlockEditor.interface';
import EmbedLinkElement from './EmbedLinkElement/EmbedLinkElement';
import UploadFileTab from './UploadFile/UploadFileTab';

export type AuthenticatedImageUrl = (src: string) => {
  imageSrc: string;
  isLoading: boolean;
};

export type AuthenticatedFileUrl = (url: string) => {
  downloadFile: (fileName: string) => void;
  isLoading: boolean;
};

export interface ImageComponentPopoverTabOptions {
  allowFileUpload?: boolean;
}

class ImageClassBase {
  public getImageComponentPopoverTab({
    allowFileUpload,
  }: ImageComponentPopoverTabOptions = {}) {
    return [
      {
        label: i18n.t('label.link'),
        key: 'embed',
        children: EmbedLinkElement,
      },
      ...(allowFileUpload
        ? [
            {
              label: i18n.t('label.upload'),
              key: 'upload',
              children: UploadFileTab,
            },
          ]
        : []),
    ];
  }

  public getBlockEditorAttachmentProps(
    entityType?: EntityType
  ): BlockEditorAttachmentProps | undefined {
    return {
      allowImageUpload: entityType === EntityType.KNOWLEDGE_PAGE,
      onImageUpload: async (
        file: File,
        entityType?: EntityType,
        entityFqn?: string
      ) => {
        if (isUndefined(entityType) || isUndefined(entityFqn)) {
          return Promise.reject(
            i18n.t('message.image-upload-after-asset-creation')
          );
        }

        const response = await uploadAsset(
          file,
          EntityLink.getEntityLink(
            entityType,
            entityFqn,
            entityType === EntityType.KNOWLEDGE_PAGE ? undefined : 'description'
          ),
          AssetType.Inline
        );

        if (!response.url) {
          return Promise.reject(i18n.t('label.failed-to-upload-file'));
        }

        return response.url;
      },
    };
  }

  public getAuthenticatedImageUrl(): AuthenticatedImageUrl | undefined {
    return useAuthenticatedImage;
  }

  public getAuthenticatedFileUrl(): AuthenticatedFileUrl | undefined {
    return useAuthenticatedFile;
  }
}
const imageClassBase = new ImageClassBase();

export default imageClassBase;
export { ImageClassBase };
