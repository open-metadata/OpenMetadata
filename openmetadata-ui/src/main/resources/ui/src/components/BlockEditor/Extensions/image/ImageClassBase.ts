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
import i18n from '../../../../utils/i18next/LocalUtil';
import { BlockEditorAttachmentProps } from '../../BlockEditor.interface';
import EmbedLinkElement from './EmbedLinkElement/EmbedLinkElement';

export type AuthenticatedImageUrl = (src: string) => {
  imageSrc: string;
  isLoading: boolean;
};

export type AuthenticatedFileUrl = (url: string) => {
  downloadFile: (fileName: string) => void;
  isLoading: boolean;
};

class ImageClassBase {
  public getImageComponentPopoverTab() {
    return [
      {
        label: i18n.t('label.link'),
        key: 'embed',
        children: EmbedLinkElement,
      },
    ];
  }

  public getBlockEditorAttachmentProps():
    | BlockEditorAttachmentProps
    | undefined {
    return undefined;
  }

  public getAuthenticatedImageUrl(): AuthenticatedImageUrl | undefined {
    return undefined;
  }

  public getAuthenticatedFileUrl(): AuthenticatedFileUrl | undefined {
    return undefined;
  }
}
const imageClassBase = new ImageClassBase();

export default imageClassBase;
export { ImageClassBase };
