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
import { Button } from '@openmetadata/ui-core-components';
import { Share07 } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import NoDataPlaceholder from '../../../common/EmptyPlaceholder/NoDataPlaceholder';

interface OntologyEmptyCardProps {
  readonly canAdd: boolean;
  readonly onAdd: () => void;
}

const OntologyEmptyCard = ({ canAdd, onAdd }: OntologyEmptyCardProps) => {
  const { t } = useTranslation();

  return (
    // The overlay lets pointer events through so the empty canvas still pans and zooms.
    <div
      className="tw:pointer-events-none tw:absolute tw:inset-0 tw:z-7"
      data-testid="ontology-empty-card">
      <NoDataPlaceholder
        description={t('message.ontology-empty-card-description')}
        footer={
          canAdd ? (
            <Button
              className="tw:pointer-events-auto"
              data-testid="ontology-empty-card-add-concept"
              size="sm"
              onPress={onAdd}>
              {t('label.add-entity', { entity: t('label.concept') })}
            </Button>
          ) : undefined
        }
        icon={Share07}
        title={t('label.ontology-has-no-concepts')}
        width={340}
      />
    </div>
  );
};

export default OntologyEmptyCard;
