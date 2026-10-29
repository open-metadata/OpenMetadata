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
import {
  Grid01,
  Plus,
  Share07,
  Upload01,
} from '@openmetadata/ui-core-components/icons';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';

interface OntologyEmptyStateProps {
  readonly canCreate: boolean;
  readonly onInstallFromLibrary: () => void;
  readonly onImportFile: () => void;
  readonly onCreateFromScratch: () => void;
}

interface EmptyStateOption {
  readonly id: 'library' | 'import' | 'scratch';
  readonly icon: FC<{ className?: string }>;
  readonly title: string;
  readonly description: string;
  readonly isHighlighted: boolean;
  readonly onPress: () => void;
}

const OntologyEmptyState = ({
  canCreate,
  onInstallFromLibrary,
  onImportFile,
  onCreateFromScratch,
}: OntologyEmptyStateProps) => {
  const { t } = useTranslation();
  const options: EmptyStateOption[] = [
    {
      id: 'library',
      icon: Grid01,
      title: t('label.install-from-library'),
      description: t('message.ontology-first-run-library'),
      isHighlighted: true,
      onPress: onInstallFromLibrary,
    },
    {
      id: 'import',
      icon: Upload01,
      title: t('label.import-a-file'),
      description: t('message.ontology-first-run-import'),
      isHighlighted: false,
      onPress: onImportFile,
    },
    {
      id: 'scratch',
      icon: Plus,
      title: t('label.create-from-scratch'),
      description: t('message.ontology-first-run-scratch'),
      isHighlighted: false,
      onPress: onCreateFromScratch,
    },
  ];

  return (
    <Box
      align="center"
      className="tw:min-h-0 tw:flex-1 tw:overflow-auto tw:p-8"
      data-testid="ontology-empty-state"
      direction="col"
      justify="center">
      <Box
        align="center"
        className="tw:w-full tw:max-w-205 tw:text-center"
        direction="col"
        gap={2}>
        <FeaturedIcon color="brand" icon={Share07} size="lg" theme="dark" />
        <Typography as="h2" size="display-xs" weight="bold">
          {t('label.no-ontologies-yet')}
        </Typography>
        <Typography
          className="tw:max-w-130 tw:pb-6"
          color="secondary"
          size="text-sm">
          {t('message.ontology-first-run-description')}
        </Typography>
        <div className="tw:grid tw:w-full tw:grid-cols-1 tw:gap-4 tw:text-left tw:md:grid-cols-3">
          {options.map((option) => (
            <Card
              className="tw:flex tw:flex-col"
              color={option.isHighlighted ? 'brandOutlined' : 'default'}
              data-testid={`ontology-empty-option-${option.id}`}
              key={option.id}
              size="md">
              <Card.Content className="tw:flex tw:flex-1 tw:flex-col tw:gap-3">
                <FeaturedIcon
                  color={option.isHighlighted ? 'brand' : 'gray'}
                  icon={option.icon}
                  size="md"
                  theme="light"
                />
                <Typography color="secondary" size="text-xs">
                  {option.description}
                </Typography>
                <Button
                  className="tw:mt-auto tw:self-start"
                  color={option.isHighlighted ? 'primary' : 'secondary'}
                  data-testid={`ontology-empty-${option.id}`}
                  isDisabled={!canCreate}
                  size="sm"
                  onPress={option.onPress}>
                  {option.title}
                </Button>
              </Card.Content>
            </Card>
          ))}
        </div>
      </Box>
    </Box>
  );
};

export default OntologyEmptyState;
