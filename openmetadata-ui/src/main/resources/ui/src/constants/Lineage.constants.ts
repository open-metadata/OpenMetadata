import { capitalize } from 'lodash';
import { EntityType } from '../enums/entity.enum';

export const foreignObjectSize = 40;

export const entityData = [
  {
    type: EntityType.TABLE,
    label: capitalize(EntityType.TABLE),
  },
  { type: EntityType.PIPELINE, label: capitalize(EntityType.PIPELINE) },
  { type: EntityType.DASHBOARD, label: capitalize(EntityType.DASHBOARD) },
];
