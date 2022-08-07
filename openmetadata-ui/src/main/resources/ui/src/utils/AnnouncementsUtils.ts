import { EntityType } from '../enums/entity.enum';

export const ANNOUNCEMENT_ENTITIES = [
  EntityType.TABLE,
  EntityType.DASHBOARD,
  EntityType.TOPIC,
  EntityType.PIPELINE,
];

export const validateMessages = {
  required: '${name} is required!',
  string: {
    range: '${name} must be between ${min} and ${max} character.',
  },
};

export const isActiveAnnouncement = (startTime: number, endTime: number) => {
  const currentTime = Date.now() / 1000;

  return currentTime > startTime && currentTime < endTime;
};

export const announcementInvalidStartTime =
  'Announcement start time must be earlier than the end time';
