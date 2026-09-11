/*
 *  Copyright 2025 Collate.
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

import { Button, Typography } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { KnowledgeGraphMode } from './KnowledgeGraph.interface';
interface EmptyStateProps {
  level: number;
  hasFilters: boolean;
  mode: KnowledgeGraphMode;
  onClearFilters: () => void;
  onExtend: () => void;
}
const KnowledgeGraphEmptyState = ({
  level,
  hasFilters,
  mode,
  onClearFilters,
  onExtend,
}: EmptyStateProps) => {
  const { t } = useTranslation();
  let message =
    mode === 'ontology'
      ? 'message.kg-ontology-empty'
      : 'message.kg-no-connections';
  if (hasFilters) {
    message = 'message.kg-no-filter-matches';
  }
  if (level === 1) {
    message = 'message.kg-root-only';
  }

  return (
    <div className="kg-empty-hint">
      <Typography size="text-sm">{t(message)}</Typography>
      {mode === 'ontology' && level < 3 && !hasFilters && (
        <Button color="link-color" size="sm" onPress={onExtend}>
          {t('label.kg-extended-connections')}
        </Button>
      )}
      {hasFilters && (
        <Button color="link-color" size="sm" onPress={onClearFilters}>
          {t('label.clear-filter-plural')}
        </Button>
      )}
    </div>
  );
};

export default KnowledgeGraphEmptyState;
