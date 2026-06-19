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
  Card,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { FC, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntityType } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/context/contextMemory';
import { getContextMemoryById } from '../../../rest/contextMemoryAPI';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { DerivedOntologyCardProps } from './DerivedOntologyCard.interface';

const ENTITY_LINK_TYPES = new Set<string>([
  EntityType.GLOSSARY_TERM,
  EntityType.METRIC,
]);

function getEntityPath(ref: EntityReference): string {
  const fqn = ref.fullyQualifiedName ?? ref.name ?? '';
  const type = ref.type ?? '';

  if (ENTITY_LINK_TYPES.has(type)) {
    return entityUtilClassBase.getEntityLink(type, fqn);
  }

  return '#';
}

interface EntityListProps {
  entities: EntityReference[];
  labelKey: string;
}

const EntityList: FC<EntityListProps> = ({ entities, labelKey }) => {
  const { t } = useTranslation();

  if (entities.length === 0) {
    return null;
  }

  return (
    <Box direction="col" gap={1}>
      <Typography
        className="tw:text-tertiary tw:uppercase"
        size="text-xs"
        weight="semibold">
        {t(labelKey)}
      </Typography>
      <Box direction="col">
        {entities.map((entity) => (
          <Link
            className="tw:text-sm tw:text-brand-secondary hover:tw:underline tw:py-0.5 tw:block"
            data-testid={`ontology-entity-${entity.id}`}
            key={entity.id}
            to={getEntityPath(entity)}>
            {entity.displayName ??
              entity.name ??
              entity.fullyQualifiedName ??
              entity.id}
          </Link>
        ))}
      </Box>
    </Box>
  );
};

const DerivedOntologyCard: FC<DerivedOntologyCardProps> = ({ memoryId }) => {
  const { t } = useTranslation();
  const [derivedEntities, setDerivedEntities] = useState<EntityReference[]>([]);
  const [reusedEntities, setReusedEntities] = useState<EntityReference[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOntology = useCallback(
    async (isCancelled?: () => boolean) => {
      try {
        setIsLoading(true);
        const memory = await getContextMemoryById(
          memoryId,
          'derivedEntities,reusedEntities'
        );

        if (!isCancelled?.()) {
          setDerivedEntities(memory.derivedEntities ?? []);
          setReusedEntities(memory.reusedEntities ?? []);
        }
      } catch {
        if (!isCancelled?.()) {
          setDerivedEntities([]);
          setReusedEntities([]);
        }
      } finally {
        if (!isCancelled?.()) {
          setIsLoading(false);
        }
      }
    },
    [memoryId]
  );

  useEffect(() => {
    let isStale = false;
    fetchOntology(() => isStale);

    return () => {
      isStale = true;
    };
  }, [fetchOntology]);

  const hasEntities = derivedEntities.length > 0 || reusedEntities.length > 0;

  return (
    <Card className="tw:p-4 tw:shrink-0" data-testid="derived-ontology-card">
      <div className="tw:mb-3">
        <Typography
          className="tw:text-tertiary tw:uppercase"
          size="text-xs"
          weight="semibold">
          {t('label.derived-ontology')}
        </Typography>
      </div>
      {isLoading ? (
        <Box direction="col" gap={2}>
          <Skeleton height="14px" variant="rounded" width="80%" />
          <Skeleton height="14px" variant="rounded" width="60%" />
        </Box>
      ) : !hasEntities ? (
        <Typography className="tw:text-tertiary" size="text-sm">
          {t('message.no-derived-ontology')}
        </Typography>
      ) : (
        <Box direction="col" gap={3}>
          <EntityList entities={derivedEntities} labelKey="label.derived" />
          <EntityList entities={reusedEntities} labelKey="label.reused" />
        </Box>
      )}
    </Card>
  );
};

export default DerivedOntologyCard;
