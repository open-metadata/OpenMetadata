/*
 *  Copyright 2021 Collate
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

import React, { FunctionComponent } from 'react';
import IconAuth0 from '../assets/img/icon-auth0.png';
import IconGithub from '../assets/img/icon-github.png';
import IconGoogle from '../assets/img/icon-google.png';
import IconOkta from '../assets/img/icon-okta.png';
import IconWelcomePopper from '../assets/img/welcome-popper-icon.png';
import IconAnnouncementWhite from '../assets/svg/announcements-white.svg';
import IconAnnouncement from '../assets/svg/announcements.svg';
import IconAPI from '../assets/svg/api.svg';
import IconArrowDownPrimary from '../assets/svg/arrow-down-primary.svg';
import IconArrowRightPrimary from '../assets/svg/arrow-right-primary.svg';
import IconSuccess from '../assets/svg/check.svg';
import IconCheckboxPrimary from '../assets/svg/checkbox-primary.svg';
import IconConfigColor from '../assets/svg/config-color.svg';
import IconConfig from '../assets/svg/config.svg';
import IconControlMinus from '../assets/svg/control-minus.svg';
import IconControlPlus from '../assets/svg/control-plus.svg';
import IconCopy from '../assets/svg/copy.svg';
import IconDashboardGrey from '../assets/svg/dashboard-grey.svg';
import IconDashboard from '../assets/svg/dashboard.svg';
import IconAsstest from '../assets/svg/data-assets.svg';
import IconDBTModelGrey from '../assets/svg/dbt-model-grey.svg';
import IconDBTModelLightGrey from '../assets/svg/dbt-model-light-grey.svg';
import IconDBTModelPrimeryColor from '../assets/svg/dbt-model-primery.svg';
import IconDBTModel from '../assets/svg/dbt-model.svg';
import IconDeploy from '../assets/svg/deploy-icon.svg';
import IconDocPrimary from '../assets/svg/doc-primary.svg';
import IconDocWhite from '../assets/svg/doc-white.svg';
import IconDoc from '../assets/svg/doc.svg';
import IconEditBlack from '../assets/svg/edit-black.svg';
import IconEditPrimary from '../assets/svg/edit-primary.svg';
import IconError from '../assets/svg/error.svg';
import IconExternalLinkWhite from '../assets/svg/external-link-white.svg';
import IconExternalLink from '../assets/svg/external-link.svg';
import IconFitView from '../assets/svg/fitview.svg';
import IconCheckCircle from '../assets/svg/ic-check-circle.svg';
import IconDelete from '../assets/svg/ic-delete.svg';
import IconDownArrow from '../assets/svg/ic-down-arrow.svg';
import IconEditLineageColor from '../assets/svg/ic-edit-lineage-colored.svg';
import IconEditLineage from '../assets/svg/ic-edit-lineage.svg';
import IconEdit from '../assets/svg/ic-edit.svg';
import IconExclamationCircle from '../assets/svg/ic-exclamation-circle.svg';
import IconExplore from '../assets/svg/ic-explore.svg';
import IconFeed from '../assets/svg/ic-feed.svg';
import IconFilter from '../assets/svg/ic-filter.svg';
import IconGrowthArrow from '../assets/svg/ic-growth-arrow.svg';
import IconHome from '../assets/svg/ic-home.svg';
import IconIncreaseArrow from '../assets/svg/ic-increase-arrow.svg';
import IconIssues from '../assets/svg/ic-issues.svg';
import IconLineage from '../assets/svg/ic-lineage.svg';
import IconLossArrow from '../assets/svg/ic-loss-arrow.svg';
import IconManage from '../assets/svg/ic-manage.svg';
import IconMenu from '../assets/svg/ic-menu.svg';
import IconMyData from '../assets/svg/ic-mydata.svg';
import IconQuality from '../assets/svg/ic-quality.svg';
import IconReply from '../assets/svg/ic-reply.svg';
import IconReports from '../assets/svg/ic-reports.svg';
import IconSchema from '../assets/svg/ic-schema.svg';
import IconSearch from '../assets/svg/ic-search.svg';
import IconSettings from '../assets/svg/ic-settings.svg';
import IconSQLBuilder from '../assets/svg/ic-sql-builder.svg';
import IconStore from '../assets/svg/ic-store.svg';
import IconTeams from '../assets/svg/ic-teams.svg';
import IconThumbsUp from '../assets/svg/ic-thumbs-up.svg';
import IconTimesCircle from '../assets/svg/ic-times-circle.svg';
import IconTrends from '../assets/svg/ic-trends.svg';
import IconUpArrow from '../assets/svg/ic-up-arrow.svg';
import IconVEllipsis from '../assets/svg/ic-v-ellipsis.svg';
import IconWorkflows from '../assets/svg/ic-workflows.svg';
import IconChevronDown from '../assets/svg/icon-chevron-down.svg';
import IconKey from '../assets/svg/icon-key.svg';
import IconNotNull from '../assets/svg/icon-notnull.svg';
import IconTour from '../assets/svg/icon-tour.svg';
import IconUnique from '../assets/svg/icon-unique.svg';
import IconInfo from '../assets/svg/info.svg';
import IconIngestion from '../assets/svg/ingestion.svg';
import IconLineageColor from '../assets/svg/lineage-color.svg';
import LogoMonogram from '../assets/svg/logo-monogram.svg';
import Logo from '../assets/svg/logo.svg';
import IconManageColor from '../assets/svg/manage-color.svg';
import IconMinus from '../assets/svg/minus.svg';
import IconPipelineGrey from '../assets/svg/pipeline-grey.svg';
import IconPipeline from '../assets/svg/pipeline.svg';
import IconPlus from '../assets/svg/plus.svg';
import IconProfilerColor from '../assets/svg/profiler-color.svg';
import IconProfiler from '../assets/svg/profiler.svg';
import IconHelpCircle from '../assets/svg/question-circle.svg';
import IconSampleDataColor from '../assets/svg/sample-data-colored.svg';
import IconSampleData from '../assets/svg/sample-data.svg';
import IconSchemaColor from '../assets/svg/schema-color.svg';
import IconSearchV1Color from '../assets/svg/search-color.svg';
import IconSearchV1 from '../assets/svg/search.svg';
import IconSetting from '../assets/svg/service.svg';
import IconSlackGrey from '../assets/svg/slack-grey.svg';
import IconSlack from '../assets/svg/slack.svg';
import IconTableGrey from '../assets/svg/table-grey.svg';
import IconTable from '../assets/svg/table.svg';
import IconTagGrey from '../assets/svg/tag-grey.svg';
import IconTag from '../assets/svg/tag.svg';
import IconTeamsGrey from '../assets/svg/teams-grey.svg';
import IconTerns from '../assets/svg/terms.svg';
import IconTier from '../assets/svg/tier.svg';
import IconTopicGrey from '../assets/svg/topic-grey.svg';
import IconTopic from '../assets/svg/topic.svg';
import IconUser from '../assets/svg/user.svg';
import IconVersionBlack from '../assets/svg/version-black.svg';
import IconVersionWhite from '../assets/svg/version-white.svg';
import IconVersion from '../assets/svg/version.svg';
import IconWarning from '../assets/svg/warning.svg';
import IconWhatsNew from '../assets/svg/whatsNew.svg';

type Props = {
  alt: string;
  icon: string;
  className?: string;
} & Record<string, string>;

export const Icons = {
  LOGO: 'logo',
  LOGO_SMALL: 'logo-small',
  WELCOME_POPPER: 'welcome-popper',
  GOOGLE_ICON: 'google-icon',
  OKTA_ICON: 'okta-icon',
  GITHUB_ICON: 'github-icon',
  AUTH0_ICON: 'auth0-icon',
  EDIT: 'icon-edit',
  EDIT_BLACK: 'icon-edit-black',
  EDIT_PRIMARY: 'icon-edit-primary',
  EXPLORE: 'icon-explore',
  MY_DATA: 'icon-my-data',
  REPORTS: 'icon-reports',
  SETTINGS: 'icon-settings',
  SQL_BUILDER: 'icon-sql-builder',
  TEAMS: 'icon-teams',
  TEAMS_GREY: 'icon-teams-grey',
  WORKFLOWS: 'icon-workflows',
  MENU: 'icon-menu',
  FEED: 'icon-feed',
  STORE: 'icon-store',
  THUMBSUP: 'icon-thumbs-up',
  VELLIPSIS: 'icon-v-ellipsis',
  COPY: 'copy',
  DELETE: 'icon-delete',
  REPLY: 'icon-reply',
  SEARCH: 'icon-search',
  INFO: 'icon-info',
  SCHEMA: 'icon-schema',
  QUALITY: 'icon-quality',
  ISSUES: 'icon-issues',
  TRENDS: 'icon-trends',
  LINEAGE: 'icon-lineage',
  MANAGE: 'icon-manage',
  HOME: 'icon-home',
  GROWTH_ARROW: 'icon-growth-arrow',
  LOSS_ARROW: 'icon-loss-arrow',
  CHECK_CIRCLE: 'icon-check-circle',
  EXCLAMATION_CIRCLE: 'icon-exclamation-circle',
  TIMES_CIRCLE: 'icon-times-circle',
  HELP_CIRCLE: 'icon-help-circle',
  FILTERS: 'icon-filters',
  UP_ARROW: 'icon-up-arrow',
  DOWN_ARROW: 'icon-down-arrow',
  INCREASE_ARROW: 'icon-increase-arrow',
  TOAST_SUCCESS: 'success',
  TOAST_ERROR: 'error',
  TOAST_WARNING: 'warning',
  TOAST_INFO: 'info',
  KEY: 'key',
  NOT_NULL: 'not-null',
  UNIQUE: 'unique',
  ASSETS: 'assets',
  SERVICE: 'service',
  INGESTION: 'ingestion',
  USERS: 'users',
  TERMS: 'terms',
  DOC: 'doc',
  DOC_WHITE: 'doc-white',
  DOC_PRIMARY: 'doc-primary',
  API: 'api',
  WHATS_NEW: 'whats-new',
  TABLE: 'table',
  TOPIC: 'topic',
  DASHBOARD: 'dashboard',
  TABLE_GREY: 'table-grey',
  TOPIC_GREY: 'topic-grey',
  DASHBOARD_GREY: 'dashboard-grey',
  CONFIG: 'icon-config',
  SLACK: 'slack',
  SLACK_GREY: 'slack-grey',
  EXTERNAL_LINK: 'external-link',
  EXTERNAL_LINK_WHITE: 'external-link-white',
  PROFILER: 'icon-profiler',
  PIPELINE: 'pipeline',
  PIPELINE_GREY: 'pipeline-grey',
  DBTMODEL_GREY: 'dbtmodel-grey',
  DBTMODEL_LIGHT_GREY: 'dbtmodel-light-grey',
  DBTMODEL_PRIMERY: 'dbtmodel-primery',
  DBTMODEL: 'dbtmodel',
  VERSION: 'icon-version',
  VERSION_WHITE: 'icon-version-white',
  VERSION_BLACK: 'icon-version-black',
  ICON_DEPLOY: 'icon-deploy',
  TOUR: 'tour',
  ICON_PLUS: 'icon-plus',
  ICON_MINUS: 'icon-minus',
  TAG: 'icon-tag',
  TAG_GREY: 'icon-tag-grey',
  TIER: 'icon-tier',
  SEARCHV1: 'icon-searchv1',
  SCHEMACOLOR: 'icon-schemacolor',
  CONFIGCOLOR: 'icon-configcolor',
  LINEAGECOLOR: 'icon-lineagecolor',
  PROFILERCOLOR: 'icon-profilercolor',
  MANAGECOLOR: 'icon-managecolor',
  SEARCHV1COLOR: 'icon-searchv1color',
  SAMPLE_DATA: 'sample-data',
  SAMPLE_DATA_COLOR: 'sample-data-color',
  FITVEW: 'icon-fitview',
  CONTROLPLUS: 'icon-control-plus',
  CONTROLMINUS: 'icon-control-minus',
  EDITLINEAGECOLOR: 'icon-edit-lineage-color',
  EDITLINEAGE: 'icon-edit-lineage',
  CHECKBOX_PRIMARY: 'icon-checkbox-primary',
  ARROW_RIGHT_PRIMARY: 'icon-arrow-right-primary',
  ARROW_DOWN_PRIMARY: 'icon-arrow-down-primary',
  ANNOUNCEMENT: 'icon-announcement',
  ANNOUNCEMENT_WHITE: 'icon-announcement-white',
  CHEVRON_DOWN: 'icon-chevron-down',
};

const SVGIcons: FunctionComponent<Props> = ({
  alt,
  icon,
  className = '',
  ...props
}: Props) => {
  let IconComponent;
  switch (icon) {
    case Icons.MY_DATA:
      IconComponent = IconMyData;

      break;
    case Icons.REPORTS:
      IconComponent = IconReports;

      break;
    case Icons.EDIT:
      IconComponent = IconEdit;

      break;
    case Icons.EXPLORE:
      IconComponent = IconExplore;

      break;
    case Icons.WORKFLOWS:
      IconComponent = IconWorkflows;

      break;
    case Icons.TOUR:
      IconComponent = IconTour;

      break;
    case Icons.SQL_BUILDER:
      IconComponent = IconSQLBuilder;

      break;
    case Icons.TEAMS:
      IconComponent = IconTeams;

      break;
    case Icons.TEAMS_GREY:
      IconComponent = IconTeamsGrey;

      break;
    case Icons.SETTINGS:
      IconComponent = IconSettings;

      break;
    case Icons.LOGO:
      IconComponent = Logo;

      break;
    case Icons.LOGO_SMALL:
      IconComponent = LogoMonogram;

      break;
    case Icons.WELCOME_POPPER:
      IconComponent = IconWelcomePopper;

      break;
    case Icons.GOOGLE_ICON:
      IconComponent = IconGoogle;

      break;
    case Icons.OKTA_ICON:
      IconComponent = IconOkta;

      break;
    case Icons.GITHUB_ICON:
      IconComponent = IconGithub;

      break;
    case Icons.AUTH0_ICON:
      IconComponent = IconAuth0;

      break;
    case Icons.MENU:
      IconComponent = IconMenu;

      break;
    case Icons.STORE:
      IconComponent = IconStore;

      break;
    case Icons.FEED:
      IconComponent = IconFeed;

      break;
    case Icons.THUMBSUP:
      IconComponent = IconThumbsUp;

      break;
    case Icons.VELLIPSIS:
      IconComponent = IconVEllipsis;

      break;
    case Icons.DELETE:
      IconComponent = IconDelete;

      break;
    case Icons.COPY:
      IconComponent = IconCopy;

      break;
    case Icons.REPLY:
      IconComponent = IconReply;

      break;
    case Icons.SEARCH:
      IconComponent = IconSearch;

      break;
    case Icons.INFO:
      IconComponent = IconInfo;

      break;
    case Icons.SCHEMA:
      IconComponent = IconSchema;

      break;
    case Icons.QUALITY:
      IconComponent = IconQuality;

      break;
    case Icons.ISSUES:
      IconComponent = IconIssues;

      break;
    case Icons.TRENDS:
      IconComponent = IconTrends;

      break;
    case Icons.LINEAGE:
      IconComponent = IconLineage;

      break;
    case Icons.MANAGE:
      IconComponent = IconManage;

      break;
    case Icons.HOME:
      IconComponent = IconHome;

      break;
    case Icons.GROWTH_ARROW:
      IconComponent = IconGrowthArrow;

      break;
    case Icons.LOSS_ARROW:
      IconComponent = IconLossArrow;

      break;
    case Icons.CHECK_CIRCLE:
      IconComponent = IconCheckCircle;

      break;
    case Icons.EXCLAMATION_CIRCLE:
      IconComponent = IconExclamationCircle;

      break;
    case Icons.TIMES_CIRCLE:
      IconComponent = IconTimesCircle;

      break;
    case Icons.HELP_CIRCLE:
      IconComponent = IconHelpCircle;

      break;
    case Icons.FILTERS:
      IconComponent = IconFilter;

      break;
    case Icons.UP_ARROW:
      IconComponent = IconUpArrow;

      break;
    case Icons.DOWN_ARROW:
      IconComponent = IconDownArrow;

      break;
    case Icons.INCREASE_ARROW:
      IconComponent = IconIncreaseArrow;

      break;
    case Icons.TOAST_SUCCESS:
      IconComponent = IconSuccess;

      break;
    case Icons.TOAST_ERROR:
      IconComponent = IconError;

      break;
    case Icons.TOAST_WARNING:
      IconComponent = IconWarning;

      break;
    case Icons.KEY:
      IconComponent = IconKey;

      break;
    case Icons.NOT_NULL:
      IconComponent = IconNotNull;

      break;
    case Icons.UNIQUE:
      IconComponent = IconUnique;

      break;
    case Icons.ASSETS:
      IconComponent = IconAsstest;

      break;
    case Icons.TOAST_INFO:
      IconComponent = IconInfo;

      break;
    case Icons.SERVICE:
      IconComponent = IconSetting;

      break;
    case Icons.INGESTION:
      IconComponent = IconIngestion;

      break;
    case Icons.USERS:
      IconComponent = IconUser;

      break;
    case Icons.TERMS:
      IconComponent = IconTerns;

      break;
    case Icons.DOC:
      IconComponent = IconDoc;

      break;
    case Icons.DOC_WHITE:
      IconComponent = IconDocWhite;

      break;
    case Icons.DOC_PRIMARY:
      IconComponent = IconDocPrimary;

      break;
    case Icons.API:
      IconComponent = IconAPI;

      break;
    case Icons.WHATS_NEW:
      IconComponent = IconWhatsNew;

      break;
    case Icons.TABLE:
      IconComponent = IconTable;

      break;
    case Icons.TOPIC:
      IconComponent = IconTopic;

      break;
    case Icons.DASHBOARD:
      IconComponent = IconDashboard;

      break;
    case Icons.TABLE_GREY:
      IconComponent = IconTableGrey;

      break;
    case Icons.TOPIC_GREY:
      IconComponent = IconTopicGrey;

      break;
    case Icons.DASHBOARD_GREY:
      IconComponent = IconDashboardGrey;

      break;
    case Icons.CONFIG:
      IconComponent = IconConfig;

      break;
    case Icons.SLACK:
      IconComponent = IconSlack;

      break;
    case Icons.SLACK_GREY:
      IconComponent = IconSlackGrey;

      break;
    case Icons.EXTERNAL_LINK:
      IconComponent = IconExternalLink;

      break;
    case Icons.EXTERNAL_LINK_WHITE:
      IconComponent = IconExternalLinkWhite;

      break;
    case Icons.PROFILER:
      IconComponent = IconProfiler;

      break;
    case Icons.PIPELINE:
      IconComponent = IconPipeline;

      break;
    case Icons.PIPELINE_GREY:
      IconComponent = IconPipelineGrey;

      break;
    case Icons.VERSION:
      IconComponent = IconVersion;

      break;
    case Icons.VERSION_WHITE:
      IconComponent = IconVersionWhite;

      break;
    case Icons.VERSION_BLACK:
      IconComponent = IconVersionBlack;

      break;
    case Icons.ICON_DEPLOY:
      IconComponent = IconDeploy;

      break;
    case Icons.ICON_PLUS:
      IconComponent = IconPlus;

      break;
    case Icons.ICON_MINUS:
      IconComponent = IconMinus;

      break;
    case Icons.DBTMODEL_GREY:
      IconComponent = IconDBTModelGrey;

      break;
    case Icons.DBTMODEL_LIGHT_GREY:
      IconComponent = IconDBTModelLightGrey;

      break;
    case Icons.DBTMODEL:
      IconComponent = IconDBTModel;

      break;
    case Icons.DBTMODEL_PRIMERY:
      IconComponent = IconDBTModelPrimeryColor;

      break;
    case Icons.TAG:
      IconComponent = IconTag;

      break;
    case Icons.TAG_GREY:
      IconComponent = IconTagGrey;

      break;
    case Icons.TIER:
      IconComponent = IconTier;

      break;
    case Icons.SEARCHV1:
      IconComponent = IconSearchV1;

      break;
    case Icons.CONFIGCOLOR:
      IconComponent = IconConfigColor;

      break;
    case Icons.LINEAGECOLOR:
      IconComponent = IconLineageColor;

      break;
    case Icons.MANAGECOLOR:
      IconComponent = IconManageColor;

      break;
    case Icons.PROFILERCOLOR:
      IconComponent = IconProfilerColor;

      break;
    case Icons.SCHEMACOLOR:
      IconComponent = IconSchemaColor;

      break;
    case Icons.SEARCHV1COLOR:
      IconComponent = IconSearchV1Color;

      break;

    case Icons.EDIT_BLACK:
      IconComponent = IconEditBlack;

      break;
    case Icons.EDIT_PRIMARY:
      IconComponent = IconEditPrimary;

      break;

    case Icons.SAMPLE_DATA:
      IconComponent = IconSampleData;

      break;
    case Icons.SAMPLE_DATA_COLOR:
      IconComponent = IconSampleDataColor;

      break;
    case Icons.FITVEW:
      IconComponent = IconFitView;

      break;
    case Icons.CONTROLPLUS:
      IconComponent = IconControlPlus;

      break;
    case Icons.CONTROLMINUS:
      IconComponent = IconControlMinus;

      break;
    case Icons.EDITLINEAGE:
      IconComponent = IconEditLineage;

      break;
    case Icons.EDITLINEAGECOLOR:
      IconComponent = IconEditLineageColor;

      break;
    case Icons.CHECKBOX_PRIMARY:
      IconComponent = IconCheckboxPrimary;

      break;
    case Icons.ARROW_DOWN_PRIMARY:
      IconComponent = IconArrowDownPrimary;

      break;
    case Icons.ARROW_RIGHT_PRIMARY:
      IconComponent = IconArrowRightPrimary;

      break;
    case Icons.ANNOUNCEMENT:
      IconComponent = IconAnnouncement;

      break;
    case Icons.ANNOUNCEMENT_WHITE:
      IconComponent = IconAnnouncementWhite;

      break;
    case Icons.CHEVRON_DOWN:
      IconComponent = IconChevronDown;

      break;

    default:
      IconComponent = null;

      break;
  }

  return IconComponent ? (
    <img
      alt={alt}
      className={`svg-icon ${className}`}
      data-testid="image"
      src={IconComponent}
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...props}
    />
  ) : null;
};

export default SVGIcons;
