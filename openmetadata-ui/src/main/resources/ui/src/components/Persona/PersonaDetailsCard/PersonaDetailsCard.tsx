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
import { Card, Space, Typography } from 'antd';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { Persona } from '../../../generated/entity/teams/persona';
import { getEntityName } from '../../../utils/EntityUtils';
import { getPersonaDetailsPath } from '../../../utils/RouterUtils';
import RichTextEditorPreviewer from '../../common/RichTextEditor/RichTextEditorPreviewer';

interface PersonaDetailsCardProps {
  persona: Persona;
}

export const PersonaDetailsCard = ({ persona }: PersonaDetailsCardProps) => {
  const history = useHistory();
  const { t } = useTranslation();

  const handleCardClick = useCallback(() => {
    if (persona.fullyQualifiedName) {
      history.push(getPersonaDetailsPath(persona.fullyQualifiedName));
    }
  }, [persona]);

  return (
    <Card
      bodyStyle={{ height: '100%' }}
      className="h-full cursor-pointer"
      onClick={handleCardClick}>
      <Space className="justify-between h-full" direction="vertical">
        <Card.Meta
          description={
            persona.description ? (
              <RichTextEditorPreviewer
                className="text-grey-muted max-two-lines"
                markdown={persona.description ?? ''}
              />
            ) : (
              <Typography.Text className="text-grey-muted">
                {t('label.no-description')}
              </Typography.Text>
            )
          }
          title={getEntityName(persona)}
        />
      </Space>
    </Card>
  );
};
