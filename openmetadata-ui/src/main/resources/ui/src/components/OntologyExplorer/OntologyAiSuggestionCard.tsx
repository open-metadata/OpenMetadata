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
  Badge,
  Button,
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import { Check, XClose } from '@untitledui/icons';
import { useTranslation } from 'react-i18next';

interface OntologyAiSuggestionCardProps {
  canAccept: boolean;
  confidence: number;
  isAccepting: boolean;
  rationale: string;
  subtitle: string;
  testId: string;
  title: string;
  onAccept: () => void;
  onDismiss: () => void;
}

const OntologyAiSuggestionCard = ({
  canAccept,
  confidence,
  isAccepting,
  rationale,
  subtitle,
  testId,
  title,
  onAccept,
  onDismiss,
}: OntologyAiSuggestionCardProps) => {
  const { t } = useTranslation();

  return (
    <Card data-testid={testId} size="sm">
      <Card.Content className="tw:flex tw:flex-col tw:gap-3">
        <div className="tw:flex tw:items-start tw:justify-between tw:gap-3">
          <div className="tw:min-w-0">
            <Typography as="h3" size="text-sm" weight="semibold">
              {title}
            </Typography>
            <Typography
              as="p"
              className="tw:mt-0.5 tw:break-all tw:text-tertiary"
              size="text-xs">
              {subtitle}
            </Typography>
          </div>
          <Badge color="brand" size="sm">
            {t('label.confidence')}: {Math.round(confidence * 100)}%
          </Badge>
        </div>
        <div>
          <Typography as="p" className="tw:text-secondary" size="text-xs">
            {t('label.rationale')}
          </Typography>
          <Typography as="p" className="tw:mt-1" size="text-sm">
            {rationale}
          </Typography>
        </div>
        <div className="tw:flex tw:justify-end tw:gap-2">
          <Button
            color="tertiary"
            iconLeading={XClose}
            size="sm"
            onPress={onDismiss}>
            {t('label.dismiss')}
          </Button>
          {canAccept ? (
            <Button
              color="primary"
              iconLeading={Check}
              isLoading={isAccepting}
              size="sm"
              onPress={onAccept}>
              {t('label.add-to-draft')}
            </Button>
          ) : null}
        </div>
      </Card.Content>
    </Card>
  );
};

export default OntologyAiSuggestionCard;
