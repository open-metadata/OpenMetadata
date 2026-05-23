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

import { Card } from '@openmetadata/ui-core-components';
import Loader from '../Loader/Loader';
import { EntityCardViewProps } from './EntityCardView.interface';

const EntityCardView = <T extends { id: string }>({
  entities,
  loading,
  renderCard,
  onEntityClick,
  emptyMessage,
}: EntityCardViewProps<T>) => {
  if (loading) {
    return <Loader />;
  }

  if (entities.length === 0) {
    return emptyMessage ? (
      <div className="tw:py-12 tw:text-center tw:text-sm tw:text-tertiary">
        {emptyMessage}
      </div>
    ) : null;
  }

  return (
    <div
      className="tw:grid tw:grid-cols-1 tw:md:grid-cols-2 tw:lg:grid-cols-3 tw:gap-4 tw:p-6"
      data-testid="card-view-container">
      {entities.map((entity) => (
        <Card
          data-testid="entity-card"
          isClickable={Boolean(onEntityClick)}
          key={entity.id}
          variant="default"
          onClick={onEntityClick ? () => onEntityClick(entity) : undefined}>
          <Card.Content>{renderCard(entity)}</Card.Content>
        </Card>
      ))}
    </div>
  );
};

export default EntityCardView;
