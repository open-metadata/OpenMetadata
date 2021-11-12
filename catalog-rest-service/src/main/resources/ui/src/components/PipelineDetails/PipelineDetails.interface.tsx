import { Operation } from 'fast-json-patch';
import { EntityTags, TableDetail } from 'Models';
import { Pipeline, Task } from '../../generated/entity/data/pipeline';
import { User } from '../../generated/entity/teams/user';
import { EntityLineage } from '../../generated/type/entityLineage';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';

export interface PipeLineDetailsProp {
  serviceType: string;
  pipelineUrl: string;
  entityName: string;
  tagList: Array<string>;
  users: Array<User>;
  pipelineDetails: Pipeline;
  activeTab: number;
  owner: TableDetail['owner'];
  description: string;
  tier: string;
  followers: Array<User>;
  pipelineTags: Array<EntityTags>;
  slashedPipelineName: TitleBreadcrumbProps['titleLinks'];
  entityLineage: EntityLineage;
  tasks: Task[];
  setActiveTabHandler: (value: number) => void;
  followPipelineHandler: () => void;
  unfollowPipelineHandler: () => void;
  settingsUpdateHandler: (updatedPipeline: Pipeline) => Promise<void>;
  descriptionUpdateHandler: (updatedPipeline: Pipeline) => void;
  tagUpdateHandler: (updatedPipeline: Pipeline) => void;
  taskUpdateHandler: (patch: Array<Operation>) => void;
}
