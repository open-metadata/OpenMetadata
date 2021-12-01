/*
 *  Copyright 2021 Collate
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

import React from 'react';
import { Table } from '../../../generated/entity/data/table';
import { getHtmlForNonAdminAction } from '../../../utils/CommonUtils';
import SVGIcons from '../../../utils/SvgUtils';
import { ModalWithMarkdownEditor } from '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import NonAdminAction from '../non-admin-action/NonAdminAction';
import RichTextEditorPreviewer from '../rich-text-editor/RichTextEditorPreviewer';

type Props = {
  entityName?: string;
  owner?: Table['owner'];
  hasEditAccess?: boolean;
  description: string;
  isEdit?: boolean;
  onDescriptionEdit?: () => void;
  onCancel?: () => void;
  onDescriptionUpdate?: (value: string) => void;
  onSuggest?: (value: string) => void;
  isReadOnly?: boolean;
};

const Description = ({
  owner,
  hasEditAccess,
  onDescriptionEdit,
  description,
  isEdit,
  onCancel,
  onDescriptionUpdate,
  isReadOnly = false,
  entityName,
}: Props) => {
  return (
    <div className="schema-description tw-flex tw-flex-col tw-h-full tw-min-h-168 tw-relative tw-border tw-border-main tw-rounded-md">
      <div className="tw-flex tw-items-center tw-px-3 tw-py-1 tw-border-b tw-border-main">
        <span className="tw-flex-1 tw-leading-8 tw-m-0 tw-text-sm tw-font-normal">
          Description
        </span>
        {!isReadOnly ? (
          <div className="tw-flex-initial">
            <NonAdminAction
              html={getHtmlForNonAdminAction(Boolean(owner))}
              isOwner={hasEditAccess}>
              <button
                className="focus:tw-outline-none"
                data-testid="edit-description"
                onClick={onDescriptionEdit}>
                <SVGIcons
                  alt="edit"
                  icon="icon-edit"
                  title="Edit"
                  width="12px"
                />
              </button>
            </NonAdminAction>
          </div>
        ) : null}
      </div>
      <div className="tw-px-3 tw-py-2 tw-overflow-y-auto">
        <div className="tw-pl-3" data-testid="description" id="description">
          {description.trim() ? (
            <RichTextEditorPreviewer markdown={description} />
          ) : (
            <span className="tw-no-description">No description added</span>
          )}
        </div>
        {isEdit && (
          <ModalWithMarkdownEditor
            header={`Edit description for ${entityName}`}
            placeholder="Enter Description"
            value={description}
            onCancel={onCancel}
            onSave={onDescriptionUpdate}
          />
        )}
      </div>
    </div>
  );
};

export default Description;
