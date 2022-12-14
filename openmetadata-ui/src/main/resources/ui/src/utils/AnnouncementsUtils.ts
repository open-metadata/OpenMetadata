import { EntityType } from '../enums/entity.enum';

export const ANNOUNCEMENT_ENTITIES = [
  EntityType.TABLE,
  EntityType.DASHBOARD,
  EntityType.TOPIC,
  EntityType.PIPELINE,
  EntityType.MLMODEL,
];

export const validateMessages = {
  required: '${fieldName} is required!',
  string: {
    range: '${fieldName} must be between ${min} and ${max} character.',
  },
};

export const isActiveAnnouncement = (startTime: number, endTime: number) => {
  const currentTime = Date.now() / 1000;

  return currentTime > startTime && currentTime < endTime;
};
