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
import { EditorView } from '@tiptap/pm/view';
import { AxiosError } from 'axios';
import { isString, noop } from 'lodash';
import React, { createContext, ReactNode, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../../enums/entity.enum';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { FileType } from '../../../BlockEditor/BlockEditor.interface';
import imageClassBase from '../../../BlockEditor/Extensions/image/ImageClassBase';

export interface EntityAttachmentType {
  entityType: EntityType;
  entityFqn?: string;
  handleFileUpload: (
    file: File,
    view: EditorView,
    pos: number,
    showInlineAlert?: boolean
  ) => Promise<void>;
  errorMessage?: string;
  handleErrorMessage: (error?: string) => void;
  allowImageUpload: boolean;
  allowFileUpload: boolean;
}

interface EntityAttachmentProps {
  children: ReactNode;
  entityType: EntityType;
  entityFqn?: string;
  allowFileUpload?: boolean;
}

const EntityAttachmentContext = createContext<EntityAttachmentType>(
  {} as EntityAttachmentType
);

export const useEntityAttachment = () => useContext(EntityAttachmentContext);

export const EntityAttachmentProvider = ({
  children,
  entityType,
  entityFqn,
  allowFileUpload = false,
}: EntityAttachmentProps) => {
  const { t } = useTranslation();
  const { onImageUpload = noop, allowImageUpload = false } =
    imageClassBase.getBlockEditorAttachmentProps() ?? {};
  const [errorMessage, setErrorMessage] = useState<string>();

  const handleErrorMessage = (error?: string) => {
    setErrorMessage(error);
  };

  // Handle file upload logic
  const handleFileUpload = async (
    file: File,
    view: EditorView,
    pos: number,
    showInlineAlert?: boolean
  ) => {
    if (!onImageUpload) {
      return;
    }

    const fileType = file.type;
    const isImage = fileType.startsWith(FileType.IMAGE);

    if (isImage && !allowImageUpload) {
      return;
    }

    if (!isImage && !allowFileUpload) {
      showInlineAlert
        ? setErrorMessage(t('message.only-image-files-supported'))
        : showErrorToast(t('message.only-image-files-supported'));

      return;
    }

    try {
      const url = await onImageUpload(file, entityType, entityFqn);

      if (isImage) {
        const imageNode = view.state.schema.nodes.image.create({
          src: url,
          alt: file.name,
        });
        const tr = view.state.tr.insert(pos, imageNode);
        view.dispatch(tr);
      } else {
        const { state } = view;
        const { tr } = state;

        const fileNode = state.schema.nodes.fileAttachment.create({
          url,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        });

        tr.insert(pos, fileNode);
        view.dispatch(tr);
      }
    } catch (error) {
      showInlineAlert
        ? setErrorMessage(
            isString(error) ? error : t('label.failed-to-upload-file')
          )
        : showErrorToast(error as AxiosError, t('label.failed-to-upload-file'));
    }
  };

  const value: EntityAttachmentType = {
    entityType,
    entityFqn,
    handleFileUpload,
    errorMessage,
    handleErrorMessage,
    allowImageUpload,
    allowFileUpload,
  };

  return (
    <EntityAttachmentContext.Provider value={value}>
      {children}
    </EntityAttachmentContext.Provider>
  );
};
