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
    Box,
    Button,
    ButtonUtility,
    Card,
    Typography
} from '@openmetadata/ui-core-components';
import { Edit01 } from '@openmetadata/ui-core-components/icons';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import RichTextEditor from '../../../../../common/RichTextEditor/RichTextEditor';
import RichTextEditorPreviewerV1 from '../../../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import type { MembersTeamDescriptionProps } from './MembersTeamDetail.types';

const MembersTeamDescription: FC<MembersTeamDescriptionProps> = ({
  team,
  canEditDescInline,
  isDescEditing,
  isDescSaving,
  descEditorRef,
  onStartEdit,
  onCancelEdit,
  onSave,
}) => {
  const { t } = useTranslation();

  return (
    <Card className="tw:mx-8 tw:mb-6">
      <Card.Content className="tw:px-3">
        <Box direction="col" gap={2}>
          <Box align="center" direction="row" gap={2}>
            <Typography className="tw:text-primary" weight="medium">
              {t('label.description')}
            </Typography>
            {canEditDescInline && !isDescEditing && (
              <ButtonUtility
                color="tertiary"
                data-testid="edit-description-btn"
                icon={Edit01}
                size="xs"
                tooltip={String(
                  t('label.edit-entity', { entity: t('label.description') })
                )}
                tooltipPlacement="right"
                onClick={onStartEdit}
              />
            )}
          </Box>
          {isDescEditing && (
            <Box direction="col" gap={2}>
              <RichTextEditor
                className="new-form-style"
                initialValue={team.description ?? ''}
                ref={descEditorRef}
              />
              <Box direction="row" gap={2} justify="end">
                <Button
                  color="tertiary"
                  data-testid="cancel-description"
                  isDisabled={isDescSaving}
                  size="sm"
                  onPress={onCancelEdit}>
                  {t('label.cancel')}
                </Button>
                <Button
                  color="primary"
                  data-testid="save-description"
                  isLoading={isDescSaving}
                  size="sm"
                  onPress={onSave}>
                  {t('label.save')}
                </Button>
              </Box>
            </Box>
          )}
          {!isDescEditing && team.description && (
            <RichTextEditorPreviewerV1 markdown={team.description} />
          )}
          {!isDescEditing && !team.description && (
            <Typography className="tw:text-tertiary" size="text-sm">
              {t('label.no-description')}
            </Typography>
          )}
        </Box>
      </Card.Content>
    </Card>
  );
};

export default MembersTeamDescription;
