import { Operation } from 'fast-json-patch';
import { EntityTags, TableDetail } from 'Models';
import { Chart } from '../../generated/entity/data/chart';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { User } from '../../generated/entity/teams/user';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';

export interface ChartType extends Chart {
  displayName: string;
}

export interface DashboardDetailsProps {
  charts: Array<ChartType>;
  serviceType: string;
  dashboardUrl: string;
  tagList: Array<string>;
  users: Array<User>;
  dashboardDetails: Dashboard;
  entityName: string;
  activeTab: number;
  owner: TableDetail['owner'];
  description: string;
  tier: string;
  followers: Array<User>;
  dashboardTags: Array<EntityTags>;
  slashedDashboardName: TitleBreadcrumbProps['titleLinks'];
  setActiveTabHandler: (value: number) => void;
  followDashboardHandler: () => void;
  unfollowDashboardHandler: () => void;
  settingsUpdateHandler: (updatedDashboard: Dashboard) => Promise<void>;
  descriptionUpdateHandler: (updatedDashboard: Dashboard) => void;
  chartDescriptionUpdateHandler: (
    index: number,
    chartId: string,
    patch: Array<Operation>
  ) => void;
  chartTagUpdateHandler: (
    index: number,
    chartId: string,
    patch: Array<Operation>
  ) => void;
  tagUpdateHandler: (updatedDashboard: Dashboard) => void;
}
