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
  Card,
  FeaturedIcon,
  Typography,
} from '@openmetadata/ui-core-components';
import { Share07 } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';

interface OntologyEmptyCardProps {
  readonly canAdd: boolean;
  readonly onAdd: () => void;
}

const OntologyEmptyCard = ({ canAdd, onAdd }: OntologyEmptyCardProps) => {
  const { t } = useTranslation();

  return (
    <div className="tw:pointer-events-none tw:absolute tw:inset-0 tw:z-7 tw:flex tw:items-center tw:justify-center">
      <Card
        className="tw:pointer-events-auto tw:w-85"
        data-testid="ontology-empty-card"
        variant="elevated">
        <Card.Content>
          <Box
            align="center"
            className="tw:py-4 tw:text-center"
            direction="col"
            gap={3}>
            <FeaturedIcon color="brand" icon={Share07} size="md" />
            <Typography as="h3" size="text-md" weight="semibold">
              {t('label.ontology-has-no-concepts')}
            </Typography>
            <Typography color="secondary" size="text-xs">
              {t('message.ontology-empty-card-description')}
            </Typography>
            {canAdd ? (
              <Button
                data-testid="ontology-empty-card-add-concept"
                size="sm"
                onPress={onAdd}>
                {t('label.add-entity', { entity: t('label.concept') })}
              </Button>
            ) : null}
          </Box>
        </Card.Content>
      </Card>
    </div>
  );
};

export default OntologyEmptyCard;
