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

import { Typography } from '@openmetadata/ui-core-components';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User } from '../../../../../generated/entity/teams/user';
import { useProfileCopy } from '../../../../../hooks/discovery/personal-space/useUserProfile';
import RichTextEditor from '../../../../common/RichTextEditor/RichTextEditor';
import RichTextEditorPreviewerV1 from '../../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import InlineEditCard from './InlineEditCard';

interface UserDescriptionRowProps {
  userData: User;
  canEdit: boolean;
  updateUserDetails: (data: Partial<User>, key: keyof User) => Promise<boolean>;
}

const UserDescriptionRow: React.FC<UserDescriptionRowProps> = ({
  userData,
  canEdit,
  updateUserDetails,
}) => {
  const { t } = useTranslation();
  const copy = useProfileCopy(userData);
  const savedDescription = userData.description ?? '';
  const [draft, setDraft] = useState(savedDescription);

  return (
    <InlineEditCard
      canEdit={canEdit}
      description={copy(
        'message.your-description-description',
        'message.user-description-description'
      )}
      isSaveDisabled={draft === savedDescription}
      renderEdit={() => (
        <RichTextEditor
          className="new-form-style"
          data-testid="user-description-editor"
          initialValue={savedDescription}
          placeHolder={t('message.write-your-description')}
          onTextChange={setDraft}
        />
      )}
      testId="user-description"
      title={t('label.description')}
      view={
        savedDescription ? (
          <RichTextEditorPreviewerV1 markdown={savedDescription} />
        ) : (
          <Typography color="secondary" size="text-sm">
            {t('label.no-description')}
          </Typography>
        )
      }
      onEnterEdit={() => setDraft(savedDescription)}
      onSave={() => updateUserDetails({ description: draft }, 'description')}
    />
  );
};

export default UserDescriptionRow;
