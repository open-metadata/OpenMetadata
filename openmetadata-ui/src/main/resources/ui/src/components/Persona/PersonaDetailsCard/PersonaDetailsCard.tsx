/*
 *  Copyright 2023 Collate.
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
import { Button, Card, Space } from 'antd';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { Persona } from '../../../generated/entity/teams/persona';
import { getEntityName } from '../../../utils/EntityUtils';
import { getPersonaDetailsPath } from '../../../utils/RouterUtils';
import RichTextEditorPreviewer from '../../common/rich-text-editor/RichTextEditorPreviewer';

interface PersonaDetailsCardProps {
  persona: Persona;
  onEdit: (persona: Persona) => void;
}

export const PersonaDetailsCard = ({
  persona,
  onEdit,
}: PersonaDetailsCardProps) => {
  const { t } = useTranslation();
  const history = useHistory();
  const handleEdit = useCallback(() => {
    onEdit(persona);
  }, [persona, onEdit]);

  const handleCardClick = useCallback(() => {
    if (persona.fullyQualifiedName) {
      history.push(getPersonaDetailsPath(persona.fullyQualifiedName));
    }
  }, [persona]);

  return (
    <Card
      bodyStyle={{ height: '100%' }}
      className="h-full border-none cursor-pointer"
      onClick={handleCardClick}>
      <Space className="justify-between h-full" direction="vertical">
        <Card.Meta
          description={
            <RichTextEditorPreviewer
              className="text-grey-muted max-two-lines"
              markdown={persona.description ?? ''}
            />
          }
          title={getEntityName(persona)}
        />
        <Button
          className="text-undeline text-link-color p-0"
          key="edit"
          size="small"
          type="text"
          onClick={handleEdit}>
          {t('label.edit')}
        </Button>
      </Space>
    </Card>
  );
};
