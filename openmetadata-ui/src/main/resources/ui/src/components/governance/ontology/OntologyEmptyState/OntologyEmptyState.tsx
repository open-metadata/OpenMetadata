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
import { Grid01, Plus, Upload01 } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import { FeaturesPlaceholderFeature } from '../../../common/EmptyPlaceholder/EmptyPlaceholder.interface';
import FeaturesPlaceholder from '../../../common/EmptyPlaceholder/FeaturesPlaceholder';

interface OntologyEmptyStateProps {
  readonly canCreate: boolean;
  readonly onInstallFromLibrary: () => void;
  readonly onImportFile: () => void;
  readonly onCreateFromScratch: () => void;
}

const OntologyEmptyState = ({
  canCreate,
  onInstallFromLibrary,
  onImportFile,
  onCreateFromScratch,
}: OntologyEmptyStateProps) => {
  const { t } = useTranslation();
  const option = (
    id: 'library' | 'import' | 'scratch',
    feature: Omit<FeaturesPlaceholderFeature, 'key' | 'action'>,
    onPress: () => void
  ): FeaturesPlaceholderFeature => ({
    ...feature,
    key: id,
    action: {
      color: id === 'library' ? 'primary' : 'secondary',
      isDisabled: !canCreate,
      onPress,
      'data-testid': `ontology-empty-${id}`,
    },
  });

  return (
    <div
      className="tw:relative tw:min-h-100 tw:flex-1"
      data-testid="ontology-empty-state">
      <FeaturesPlaceholder
        description={t('message.ontology-first-run-description')}
        features={[
          option(
            'library',
            {
              icon: Grid01,
              title: t('label.install-from-library'),
              description: t('message.ontology-first-run-library'),
            },
            onInstallFromLibrary
          ),
          option(
            'import',
            {
              icon: Upload01,
              title: t('label.import-a-file'),
              description: t('message.ontology-first-run-import'),
            },
            onImportFile
          ),
          option(
            'scratch',
            {
              icon: Plus,
              title: t('label.create-from-scratch'),
              description: t('message.ontology-first-run-scratch'),
            },
            onCreateFromScratch
          ),
        ]}
        title={
          <Typography aria-level={2} role="heading">
            {t('label.no-ontologies-yet')}
          </Typography>
        }
      />
    </div>
  );
};

export default OntologyEmptyState;
