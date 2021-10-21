import { EntityTags, TableDetail } from 'Models';
import { Topic } from '../../generated/entity/data/topic';
import { User } from '../../generated/entity/teams/user';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';

export interface TopicDetailsProps {
  tagList: Array<string>;
  schemaText: string;
  schemaType: string;
  partitions: number;
  cleanupPolicies: Array<string>;
  maximumMessageSize: number;
  replicationFactor: number;
  retentionSize: number;
  users: Array<User>;
  topicDetails: Topic;
  entityName: string;
  activeTab: number;
  owner: TableDetail['owner'];
  description: string;
  tier: string;
  followers: Array<User>;
  topicTags: Array<EntityTags>;
  slashedTopicName: TitleBreadcrumbProps['titleLinks'];
  setActiveTabHandler: (value: number) => void;
  followTopicHandler: () => void;
  unfollowTopicHandler: () => void;
  settingsUpdateHandler: (updatedTopic: Topic) => Promise<void>;
  descriptionUpdateHandler: (updatedTopic: Topic) => void;
  tagUpdateHandler: (updatedTopic: Topic) => void;
}
