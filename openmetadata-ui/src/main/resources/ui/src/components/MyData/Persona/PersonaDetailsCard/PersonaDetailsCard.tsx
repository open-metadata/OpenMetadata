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
import { Typography } from '@openmetadata/ui-core-components';
import { Card, Space, Tag } from 'antd';
import { lazy, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Persona } from '../../../../generated/entity/teams/persona';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getPersonaDetailsPath } from '../../../../utils/RouterUtils';
import withSuspenseFallback from '../../../AppRouter/withSuspenseFallback';

const RichTextEditorPreviewerV1 = withSuspenseFallback(
  lazy(() => import('../../../common/RichTextEditor/RichTextEditorPreviewerV1'))
);

interface PersonaDetailsCardProps {
  persona: Persona;
}

export const PersonaDetailsCard = ({ persona }: PersonaDetailsCardProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleCardClick = useCallback(() => {
    if (persona.fullyQualifiedName) {
      navigate({
        pathname: getPersonaDetailsPath(persona.fullyQualifiedName),
        hash: '#customize-ui',
      });
    }
  }, [persona]);

  return (
    <Card
      bodyStyle={{ height: '100%' }}
      className="h-full w-full cursor-pointer overflow-hidden"
      data-testid={`persona-details-card-${persona.name}`}
      onClick={handleCardClick}>
      <Space className="justify-between w-full" direction="vertical">
        <Card.Meta
          description={
            persona.description ? (
              <RichTextEditorPreviewerV1
                className="text-grey-muted max-two-lines"
                markdown={persona.description ?? ''}
              />
            ) : (
              <Typography className="text-grey-muted">
                {t('label.no-description')}
              </Typography>
            )
          }
          title={
            <div className="d-flex justify-between w-full">
              <div>
                {/* Card.Meta's title sits inside the whole-card onClick
                    handler above: `ellipsis={{ tooltip: true }}` would wrap
                    this in a real `<button>` (TooltipTrigger), which
                    swallows the click before it bubbles to the Card. Use
                    plain ellipsis truncation plus a native `title`
                    attribute instead. */}
                <Typography ellipsis title={getEntityName(persona)}>
                  {getEntityName(persona)}
                </Typography>
              </div>
              {persona.default && (
                <Tag color="blue" data-testid="default-persona-tag">
                  {t('label.default')}
                </Tag>
              )}
            </div>
          }
        />
      </Space>
    </Card>
  );
};
