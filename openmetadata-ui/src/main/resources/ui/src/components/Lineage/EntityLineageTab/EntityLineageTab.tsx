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
import { FC, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import LineageProvider from '../../../context/LineageProvider/LineageProvider';
import { EntityType } from '../../../enums/entity.enum';
import LineageTable from '../../LineageTable/LineageTable';
import { SourceType } from '../../SearchedData/SearchedData.interface';
import Lineage from '../Lineage.component';

interface EntityLineageTabProps {
  deleted: boolean;
  entity: SourceType;
  entityType: EntityType;
  hasEditAccess: boolean;
}

export const EntityLineageTab: FC<EntityLineageTabProps> = ({
  deleted,
  entity,
  entityType,
  hasEditAccess,
}) => {
  // Extract mode from search params
  const location = useLocation();
  const viewMode = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);

    return searchParams.get('mode') === 'impact_analysis'
      ? 'impact_analysis'
      : 'lineage';
  }, [location.search]);

  const lineageTab = useMemo(
    () => (
      <Lineage
        deleted={deleted}
        entity={entity}
        entityType={entityType}
        hasEditAccess={hasEditAccess}
      />
    ),
    [deleted, entity, entityType, hasEditAccess]
  );

  const lineageTable = useMemo(
    () => <LineageTable entity={entity} />,
    [entity]
  );

  return (
    <LineageProvider>
      {viewMode === 'lineage' ? lineageTab : lineageTable}
    </LineageProvider>
  );
};
