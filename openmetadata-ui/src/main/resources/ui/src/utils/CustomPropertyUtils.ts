import { ResourceEntity } from '../components/PermissionProvider/PermissionProvider.interface';

export const getResourceEntityFromCustomProperty = (property: string) => {
  switch (property) {
    case 'tables':
      return ResourceEntity.TABLE;

    case 'topics':
      return ResourceEntity.TOPIC;

    case 'dashboards':
      return ResourceEntity.DASHBOARD;

    case 'pipelines':
      return ResourceEntity.PIPELINE;

    case 'mlModels':
      return ResourceEntity.ML_MODEL;
  }

  return ResourceEntity.TABLE;
};
