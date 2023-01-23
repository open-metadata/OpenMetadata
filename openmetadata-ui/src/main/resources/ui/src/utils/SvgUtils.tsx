/*
 *  Copyright 2022 Collate.
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

import { omit } from 'lodash';
import React, { FunctionComponent } from 'react';
import IconAuth0 from '../assets/img/icon-auth0.png';
import IconCognito from '../assets/img/icon-aws-cognito.png';
import IconAzure from '../assets/img/icon-azure.png';
import IconGithub from '../assets/img/icon-github.png';
import IconGoogle from '../assets/img/icon-google.png';
import IconOkta from '../assets/img/icon-okta.png';
import IconNoDataFoundPlaceHolder from '../assets/img/no-data-placeholder.svg';
import IconWelcomePopper from '../assets/img/welcome-popper-icon.png';
import IconCommentPlus from '../assets/svg/add-chat.svg';
import IconAddReaction from '../assets/svg/add-reaction-emoji.svg';
import IconAdmin from '../assets/svg/admin.svg';
import IconAllActivity from '../assets/svg/all-activity.svg';
import IconAnnouncementsBasicPrimary from '../assets/svg/announcements-basic-primary.svg';
import IconAnnouncementsBlack from '../assets/svg/announcements-black.svg';
import IconAnnouncementsPrimary from '../assets/svg/announcements-primary.svg';
import IconAnnouncementsPurple from '../assets/svg/announcements-purple.svg';
import IconAnnouncementsYellow from '../assets/svg/announcements-yellow.svg';
import IconAnnouncements from '../assets/svg/announcements.svg';
import IconAPI from '../assets/svg/api.svg';
import IconArrowDownLight from '../assets/svg/arrow-down-light.svg';
import IconArrowDownPrimary from '../assets/svg/arrow-down-primary.svg';
import IconArrowRightLight from '../assets/svg/arrow-right-light.svg';
import IconArrowRightPrimary from '../assets/svg/arrow-right-primary.svg';
import IconArrowRight from '../assets/svg/arrow-right.svg';
import IconBotProfile from '../assets/svg/bot-profile.svg';
import IconSuccess from '../assets/svg/check.svg';
import IconCheckboxPrimary from '../assets/svg/checkbox-primary.svg';
import IconCircleCheckbox from '../assets/svg/circle-checkbox.svg';
import IconClosedLock from '../assets/svg/closed-lock.svg';
import IconComments from '../assets/svg/comment.svg';
import IconTaskClose from '../assets/svg/complete.svg';
import IconConfigColor from '../assets/svg/config-color.svg';
import IconConfig from '../assets/svg/config.svg';
import IconControlMinus from '../assets/svg/control-minus.svg';
import IconControlPlus from '../assets/svg/control-plus.svg';
import IconCreateIngestion from '../assets/svg/creating-ingestion.svg';
import IconDashboardGrey from '../assets/svg/dashboard-grey.svg';
import IconDashboard from '../assets/svg/dashboard.svg';
import IconAsstest from '../assets/svg/data-assets.svg';
import IconDBTModelGrey from '../assets/svg/dbt-model-grey.svg';
import IconDBTModelLightGrey from '../assets/svg/dbt-model-light-grey.svg';
import IconDBTModelPrimeryColor from '../assets/svg/dbt-model-primery.svg';
import IconDBTModel from '../assets/svg/dbt-model.svg';
import IconDeleteGradiant from '../assets/svg/delete-gradiant.svg';
import IconFeedDelete from '../assets/svg/delete-white.svg';
import IconDeploy from '../assets/svg/deploy-icon.svg';
import IconDeployIngestion from '../assets/svg/deploy-ingestion.svg';
import IconDocPrimary from '../assets/svg/doc-primary.svg';
import IconDocWhite from '../assets/svg/doc-white.svg';
import IconDoc from '../assets/svg/doc.svg';
import IconDrag from '../assets/svg/drag.svg';
import IconEditBlack from '../assets/svg/edit-black.svg';
import IconEditOutlinePrimary from '../assets/svg/edit-outline-primery.svg';
import IconEditPrimary from '../assets/svg/edit-primary.svg';
import IconError from '../assets/svg/error.svg';
import IconExitFullScreen from '../assets/svg/exit-full-screen.svg';
import IconExternalLinkGrey from '../assets/svg/external-link-grey.svg';
import IconExternalLinkWhite from '../assets/svg/external-link-white.svg';
import IconExternalLink from '../assets/svg/external-link.svg';
import IconFailBadge from '../assets/svg/fail-badge.svg';
import IconFilterPrimary from '../assets/svg/filter-primary.svg';
import IconFitView from '../assets/svg/fitview.svg';
import IconForeignKey from '../assets/svg/foriegnKey.svg';
import IconFullScreen from '../assets/svg/full-screen.svg';
import IconGithubStar from '../assets/svg/github-star.svg';
import IconHidePassword from '../assets/svg/hide-password.svg';
import IconAlertBell from '../assets/svg/ic-alert-bell.svg';
import IconAllApplicationPrimary from '../assets/svg/ic-all-application-primary.svg';
import IconAllApplication from '../assets/svg/ic-all-application.svg';
import IconCheckCircle from '../assets/svg/ic-check-circle.svg';
import IconCommentPrimary from '../assets/svg/ic-comment-grey-primary.svg';
import IconCommentGrey from '../assets/svg/ic-comment-grey.svg';
import IconDeleteColored, {
  ReactComponent as IcDeleteColored,
} from '../assets/svg/ic-delete-colored.svg';
import IconDelete from '../assets/svg/ic-delete.svg';
import IconDownArrow from '../assets/svg/ic-down-arrow.svg';
import IconEditLineageColor from '../assets/svg/ic-edit-lineage-colored.svg';
import IconEditLineage from '../assets/svg/ic-edit-lineage.svg';
import IconEdit from '../assets/svg/ic-edit.svg';
import IconExclamationCircle from '../assets/svg/ic-exclamation-circle.svg';
import IconExplore from '../assets/svg/ic-explore.svg';
import IconFeed from '../assets/svg/ic-feed.svg';
import IconFilter from '../assets/svg/ic-filter.svg';
import IconFolderPrimary from '../assets/svg/ic-folder-primary.svg';
import IconFolder from '../assets/svg/ic-folder.svg';
import IconGrowthArrow from '../assets/svg/ic-growth-arrow.svg';
import IconHome from '../assets/svg/ic-home.svg';
import IconIncreaseArrow from '../assets/svg/ic-increase-arrow.svg';
import IconIssues from '../assets/svg/ic-issues.svg';
import IconLineage from '../assets/svg/ic-lineage.svg';
import IconLossArrow from '../assets/svg/ic-loss-arrow.svg';
import IconManage from '../assets/svg/ic-manage.svg';
import IconMentionsPrimary from '../assets/svg/ic-mentions-primary.svg';
import IconMentions from '../assets/svg/ic-mentions.svg';
import IconMenu from '../assets/svg/ic-menu.svg';
import IconMyData from '../assets/svg/ic-mydata.svg';
import IconQuality from '../assets/svg/ic-quality.svg';
import IconReply from '../assets/svg/ic-reply.svg';
import IconReports from '../assets/svg/ic-reports.svg';
import IconRestore from '../assets/svg/ic-restore.svg';
import IconSchema from '../assets/svg/ic-schema.svg';
import IconSearch from '../assets/svg/ic-search.svg';
import IconSettingGray from '../assets/svg/ic-settings-gray.svg';
import IconSettingPrimery from '../assets/svg/ic-settings-primery.svg';
import IconSettings from '../assets/svg/ic-settings.svg';
import IconSQLBuilder from '../assets/svg/ic-sql-builder.svg';
import IconStarPrimary from '../assets/svg/ic-star-primary.svg';
import IconStar from '../assets/svg/ic-star.svg';
import IconStore from '../assets/svg/ic-store.svg';
import IconSync from '../assets/svg/ic-sync.svg';
import IconTaskPrimary from '../assets/svg/ic-task-primary.svg';
import IconTask from '../assets/svg/ic-task.svg';
import IconTeams from '../assets/svg/ic-teams.svg';
import IconThumbsUp from '../assets/svg/ic-thumbs-up.svg';
import IconTimesCircle from '../assets/svg/ic-times-circle.svg';
import IconTrends from '../assets/svg/ic-trends.svg';
import IconUpArrow from '../assets/svg/ic-up-arrow.svg';
import IconVEllipsis from '../assets/svg/ic-v-ellipsis.svg';
import IconWorkflows from '../assets/svg/ic-workflows.svg';
import IconAddTest from '../assets/svg/icon-add-test.svg';
import IconChevronDown from '../assets/svg/icon-chevron-down.svg';
import IconCopy from '../assets/svg/icon-copy.svg';
import IconDown from '../assets/svg/icon-down.svg';
import IcEditPrimary from '../assets/svg/icon-edit-primary.svg';
import IconInfoSecondary from '../assets/svg/icon-info.svg';
import IconKey from '../assets/svg/icon-key.svg';
import IconNotNull from '../assets/svg/icon-notnull.svg';
import IconPlusPrimaryOutlined from '../assets/svg/icon-plus-primary-outlined.svg';
import IconRoleGrey from '../assets/svg/icon-role-grey.svg';
import IconTestSuite from '../assets/svg/icon-test-suite.svg';
import IconTour from '../assets/svg/icon-tour.svg';
import IconUnique from '../assets/svg/icon-unique.svg';
import IconUp from '../assets/svg/icon-up.svg';
import IconTaskOpen from '../assets/svg/in-progress.svg';
import IconInfo from '../assets/svg/info.svg';
import IconIngestion from '../assets/svg/ingestion.svg';
import IconLineageColor from '../assets/svg/lineage-color.svg';
import LogoMonogram from '../assets/svg/logo-monogram.svg';
import Logo from '../assets/svg/logo.svg';
import IconManageColor from '../assets/svg/manage-color.svg';
import IconMinus from '../assets/svg/minus.svg';
import IconMlModal from '../assets/svg/mlmodal.svg';
import IconMSTeamsGrey from '../assets/svg/ms-teams-grey.svg';
import IconMSTeams from '../assets/svg/ms-teams.svg';
import IconOpenLock from '../assets/svg/open-lock.svg';
import IconPaperPlanePrimary from '../assets/svg/paper-plane-primary.svg';
import IconPaperPlane from '../assets/svg/paper-plane.svg';
import IconPendingBadge from '../assets/svg/pending-badge.svg';
import IconPipelineGrey from '../assets/svg/pipeline-grey.svg';
import IconPipeline from '../assets/svg/pipeline.svg';
import IconPlusPrimery from '../assets/svg/plus-primery.svg';
import IconPlus from '../assets/svg/plus.svg';
import IconPolicies from '../assets/svg/policies.svg';
import IconProfilerColor from '../assets/svg/profiler-color.svg';
import IconProfiler from '../assets/svg/profiler.svg';
import IconHelpCircle from '../assets/svg/question-circle.svg';
import IconReaction from '../assets/svg/Reaction.svg';
import IconRemove from '../assets/svg/Remove.svg';
import IconReplyFeed from '../assets/svg/Reply.svg';
import IconRequest from '../assets/svg/request-icon.svg';
import IconSampleDataColor from '../assets/svg/sample-data-colored.svg';
import IconSampleData from '../assets/svg/sample-data.svg';
import IconSchemaColor from '../assets/svg/schema-color.svg';
import IconSearchV1Color from '../assets/svg/search-color.svg';
import IconSearchV1 from '../assets/svg/search.svg';
import IconSetting from '../assets/svg/service.svg';
import IconShowPassword from '../assets/svg/show-password.svg';
import IconSlackGrey from '../assets/svg/slack-grey.svg';
import IconSlack from '../assets/svg/slack.svg';
import IconSuccessBadge from '../assets/svg/success-badge.svg';
import IconTableGrey from '../assets/svg/table-grey.svg';
import IconTable from '../assets/svg/table.svg';
import IconTagGrey from '../assets/svg/tag-grey.svg';
import IconTag from '../assets/svg/tag.svg';
import IconTaskColor from '../assets/svg/Task-ic.svg';
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
import IconWebhookGrey from '../assets/svg/webhook-grey.svg';
import IconWebhookPrimary from '../assets/svg/webhook-primary.svg';
import IconWebhook from '../assets/svg/webhook.svg';
import IconWhatsNew from '../assets/svg/whatsNew.svg';

type Props = {
  icon: string;
} & React.DetailedHTMLProps<
  React.ImgHTMLAttributes<HTMLImageElement>,
  HTMLImageElement
>;

export const Icons = {
  LOGO: 'logo',
  LOGO_SMALL: 'logo-small',
  WELCOME_POPPER: 'welcome-popper',
  AZURE_ICON: 'azure-icon',
  GOOGLE_ICON: 'google-icon',
  OKTA_ICON: 'okta-icon',
  COGNITO_ICON: 'cognito-icon',
  GITHUB_ICON: 'github-icon',
  AUTH0_ICON: 'auth0-icon',
  EDIT: 'icon-edit',
  EDIT_BLACK: 'icon-edit-black',
  EDIT_PRIMARY: 'icon-edit-primary',
  EDIT_OUTLINE_PRIMARY: 'icon-edit-outline-primary',
  EXPLORE: 'icon-explore',
  MY_DATA: 'icon-my-data',
  REPORTS: 'icon-reports',
  SETTINGS: 'icon-settings',
  SETTINGS_PRIMERY: 'icon-settings-primery',
  SETTINGS_GRAY: 'icon-settings-gray',
  SQL_BUILDER: 'icon-sql-builder',
  TEAMS: 'icon-teams',
  TEAMS_GREY: 'icon-teams-grey',
  TEST_SUITE: 'icon-test-suite',
  WORKFLOWS: 'icon-workflows',
  MENU: 'icon-menu',
  FEED: 'icon-feed',
  STORE: 'icon-store',
  THUMBSUP: 'icon-thumbs-up',
  VELLIPSIS: 'icon-v-ellipsis',
  COPY: 'copy',
  DELETE: 'icon-delete',
  DELETE_GRADIANT: 'delete-gradient',
  REPLY: 'icon-reply',
  SEARCH: 'icon-search',
  INFO: 'icon-info',
  SCHEMA: 'icon-schema',
  QUALITY: 'icon-quality',
  ISSUES: 'icon-issues',
  TRENDS: 'icon-trends',
  RESTORE: 'icon-restore',
  LINEAGE: 'icon-lineage',
  MANAGE: 'icon-manage',
  HOME: 'icon-home',
  ADD_TEST: 'icon-add-test',
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
  EXTERNAL_LINK_GREY: 'external-link-grey',
  PROFILER: 'icon-profiler',
  PIPELINE: 'pipeline',
  MLMODAL: 'mlmodel-grey',
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
  ICON_PLUS_PRIMARY: 'icon-plus-primary',
  ICON_PLUS_PRIMARY_OUTLINED: 'icon-plus-primary-outlined',
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
  FULL_SCREEN: 'icon-full-screen',
  EXIT_FULL_SCREEN: 'icon-exit-full-screen',
  CONTROLPLUS: 'icon-control-plus',
  CONTROLMINUS: 'icon-control-minus',
  EDITLINEAGECOLOR: 'icon-edit-lineage-color',
  EDITLINEAGE: 'icon-edit-lineage',
  REQUEST: 'icon-request',
  CHECKBOX_PRIMARY: 'icon-checkbox-primary',
  CIRCLE_CHECKBOX: 'icon-circle-checkbox',
  ARROW_RIGHT_PRIMARY: 'icon-arrow-right-primary',
  ARROW_DOWN_PRIMARY: 'icon-arrow-down-primary',
  ARROW_RIGHT: 'icon-arrow-right',
  ANNOUNCEMENT: 'icon-announcement',
  ANNOUNCEMENT_BLACK: 'icon-announcement-black',
  ANNOUNCEMENT_PURPLE: 'icon-announcement-purple',
  ANNOUNCEMENT_PRIMARY: 'icon-announcement-primary',
  ANNOUNCEMENT_YELLOW: 'icon-announcement-yellow',
  ANNOUNCEMENT_BASIC_PRIMARY: 'icon-announcement-basic-primary',
  CHEVRON_DOWN: 'icon-chevron-down',
  ICON_UP: 'icon-up',
  ICON_DOWN: 'icon-down',
  PAPER_PLANE: 'icon-paper-plane',
  PAPER_PLANE_PRIMARY: 'icon-paper-plane-primary',
  COMMENT: 'icon-comment',
  COMMENT_PLUS: 'icon-comment-plus',
  WEBHOOK: 'icon-webhook',
  WEBHOOK_GREY: 'icon-webhook-grey',
  WEBHOOK_PRIMARY: 'icon-webhook-primary',
  GITHUB_STAR: 'icon-github-star',
  SYNC: 'icon-sync',
  SUCCESS_BADGE: 'success-badge',
  FAIL_BADGE: 'fail-badge',
  PENDING_BADGE: 'pending-badge',
  BOT_PROFILE: 'bot-profile',
  CREATE_INGESTION: 'create-ingestion',
  DEPLOY_INGESTION: 'deploy-ingestion',
  ADD_REACTION: 'add-reaction',
  ADD_REPLY: 'add-reply',
  REACTION: 'reaction',
  FEED_DELETE: 'feed-delete',
  ALERT_BELL: 'alert-bell',
  TASK: 'ic-task',
  TASK_PRIMARY: 'ic-task-primary',
  ALL_APPLICATION: 'all-application',
  ALL_APPLICATION_PRIMARY: 'all-application-primary',
  FOLDER: 'ic-folder',
  FOLDER_PRIMARY: 'ic-folder-primary',
  STAR: 'ic-star',
  STAR_PRIMARY: 'ic-star-primary',
  MENTIONS: 'ic-mentions',
  MENTIONS_PRIMARY: 'ic-mentions-primary',
  COMMENT_GREY: 'ic-comment-grey',
  COMMENT_PRIMARY: 'ic-comment-grey-primary',
  TASK_ICON: 'task-icon',
  TASK_CLOSED: 'task-closed',
  TASK_OPEN: 'task-open',
  FOREGIN_KEY: 'foreign-key',
  ROLE_GREY: 'role-grey',
  POLICIES: 'policies',
  INFO_SECONDARY: 'info-secondary',
  ICON_REMOVE: 'icon-remove',
  DELETE_COLORED: 'icon-delete-colored',
  IC_EDIT_PRIMARY: 'ic-edit-primary',
  MSTEAMS: 'msteams',
  MSTEAMS_GREY: 'msteams-grey',
  ALL_ACTIVITY: 'all-activity',
  OPEN_LOCK: 'open-lock',
  CLOSED_LOCK: 'closed-lock',
  FILTER_PRIMARY: 'filter-primary',
  ADMIN: 'admin',
  NO_DATA_PLACEHOLDER: 'no-data-placeholder',
  SHOW_PASSWORD: 'show-password',
  HIDE_PASSWORD: 'hide-password',
  ARROW_RIGHT_LIGHT: 'arrow-right-light',
  ARROW_DOWN_LIGHT: 'arrow-down-light',
  DRAG: 'drag',
};

/**
 * @deprecated SVGIcons is deprecated, Please use SVG image as ReactComponent wherever it is required
 * e.g import { ReactComponent as Icon } from '<PATH_NAME>';
 */

const SVGIcons: FunctionComponent<Props> = ({ icon, ...props }: Props) => {
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
    case Icons.RESTORE:
      IconComponent = IconRestore;

      break;
    case Icons.TEAMS_GREY:
      IconComponent = IconTeamsGrey;

      break;
    case Icons.SETTINGS:
      IconComponent = IconSettings;

      break;
    case Icons.SETTINGS_PRIMERY:
      IconComponent = IconSettingPrimery;

      break;
    case Icons.SETTINGS_GRAY:
      IconComponent = IconSettingGray;

      break;
    case Icons.LOGO:
      IconComponent = Logo;

      break;
    case Icons.ROLE_GREY:
      IconComponent = IconRoleGrey;

      break;
    case Icons.LOGO_SMALL:
      IconComponent = LogoMonogram;

      break;
    case Icons.ADD_TEST:
      IconComponent = IconAddTest;

      break;
    case Icons.WELCOME_POPPER:
      IconComponent = IconWelcomePopper;

      break;
    case Icons.GOOGLE_ICON:
      IconComponent = IconGoogle;

      break;
    case Icons.AZURE_ICON:
      IconComponent = IconAzure;

      break;
    case Icons.OKTA_ICON:
      IconComponent = IconOkta;

      break;
    case Icons.COGNITO_ICON:
      IconComponent = IconCognito;

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

    case Icons.DRAG:
      IconComponent = IconDrag;

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
    case Icons.DELETE_GRADIANT:
      IconComponent = IconDeleteGradiant;

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
    case Icons.MLMODAL:
      IconComponent = IconMlModal;

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
    case Icons.EXTERNAL_LINK_GREY:
      IconComponent = IconExternalLinkGrey;

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
    case Icons.ICON_PLUS_PRIMARY:
      IconComponent = IconPlusPrimery;

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
    case Icons.EDIT_OUTLINE_PRIMARY:
      IconComponent = IconEditOutlinePrimary;

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
    case Icons.FULL_SCREEN:
      IconComponent = IconFullScreen;

      break;
    case Icons.EXIT_FULL_SCREEN:
      IconComponent = IconExitFullScreen;

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
    case Icons.CIRCLE_CHECKBOX:
      IconComponent = IconCircleCheckbox;

      break;
    case Icons.CHECKBOX_PRIMARY:
      IconComponent = IconCheckboxPrimary;

      break;
    case Icons.ARROW_DOWN_PRIMARY:
      IconComponent = IconArrowDownPrimary;

      break;
    case Icons.ARROW_RIGHT:
      IconComponent = IconArrowRight;

      break;
    case Icons.ARROW_RIGHT_PRIMARY:
      IconComponent = IconArrowRightPrimary;

      break;
    case Icons.ANNOUNCEMENT:
      IconComponent = IconAnnouncements;

      break;
    case Icons.ANNOUNCEMENT_PURPLE:
      IconComponent = IconAnnouncementsPurple;

      break;
    case Icons.ANNOUNCEMENT_YELLOW:
      IconComponent = IconAnnouncementsYellow;

      break;
    case Icons.ANNOUNCEMENT_BLACK:
      IconComponent = IconAnnouncementsBlack;

      break;
    case Icons.ANNOUNCEMENT_PRIMARY:
      IconComponent = IconAnnouncementsPrimary;

      break;
    case Icons.ANNOUNCEMENT_BASIC_PRIMARY:
      IconComponent = IconAnnouncementsBasicPrimary;

      break;
    case Icons.REQUEST:
      IconComponent = IconRequest;

      break;
    case Icons.CHEVRON_DOWN:
      IconComponent = IconChevronDown;

      break;
    case Icons.ICON_DOWN:
      IconComponent = IconDown;

      break;
    case Icons.ICON_UP:
      IconComponent = IconUp;

      break;
    case Icons.PAPER_PLANE:
      IconComponent = IconPaperPlane;

      break;
    case Icons.PAPER_PLANE_PRIMARY:
      IconComponent = IconPaperPlanePrimary;

      break;
    case Icons.COMMENT:
      IconComponent = IconComments;

      break;
    case Icons.COMMENT_PLUS:
      IconComponent = IconCommentPlus;

      break;
    case Icons.WEBHOOK:
      IconComponent = IconWebhook;

      break;
    case Icons.WEBHOOK_GREY:
      IconComponent = IconWebhookGrey;

      break;
    case Icons.WEBHOOK_PRIMARY:
      IconComponent = IconWebhookPrimary;

      break;
    case Icons.GITHUB_STAR:
      IconComponent = IconGithubStar;

      break;
    case Icons.SYNC:
      IconComponent = IconSync;

      break;
    case Icons.SUCCESS_BADGE:
      IconComponent = IconSuccessBadge;

      break;
    case Icons.FAIL_BADGE:
      IconComponent = IconFailBadge;

      break;
    case Icons.PENDING_BADGE:
      IconComponent = IconPendingBadge;

      break;
    case Icons.BOT_PROFILE:
      IconComponent = IconBotProfile;

      break;
    case Icons.CREATE_INGESTION:
      IconComponent = IconCreateIngestion;

      break;
    case Icons.DEPLOY_INGESTION:
      IconComponent = IconDeployIngestion;

      break;
    case Icons.ADD_REACTION:
      IconComponent = IconAddReaction;

      break;
    case Icons.ADD_REPLY:
      IconComponent = IconReplyFeed;

      break;

    case Icons.REACTION:
      IconComponent = IconReaction;

      break;
    case Icons.FEED_DELETE:
      IconComponent = IconFeedDelete;

      break;

    case Icons.ALERT_BELL:
      IconComponent = IconAlertBell;

      break;
    case Icons.TASK_ICON:
      IconComponent = IconTaskColor;

      break;

    case Icons.TASK:
      IconComponent = IconTask;

      break;
    case Icons.TASK_PRIMARY:
      IconComponent = IconTaskPrimary;

      break;
    case Icons.ALL_APPLICATION:
      IconComponent = IconAllApplication;

      break;
    case Icons.ALL_APPLICATION_PRIMARY:
      IconComponent = IconAllApplicationPrimary;

      break;
    case Icons.FOLDER:
      IconComponent = IconFolder;

      break;
    case Icons.FOLDER_PRIMARY:
      IconComponent = IconFolderPrimary;

      break;
    case Icons.STAR:
      IconComponent = IconStar;

      break;
    case Icons.STAR_PRIMARY:
      IconComponent = IconStarPrimary;

      break;
    case Icons.MENTIONS:
      IconComponent = IconMentions;

      break;
    case Icons.MENTIONS_PRIMARY:
      IconComponent = IconMentionsPrimary;

      break;
    case Icons.COMMENT_GREY:
      IconComponent = IconCommentGrey;

      break;
    case Icons.COMMENT_PRIMARY:
      IconComponent = IconCommentPrimary;

      break;
    case Icons.TASK_CLOSED:
      IconComponent = IconTaskClose;

      break;
    case Icons.TASK_OPEN:
      IconComponent = IconTaskOpen;

      break;
    case Icons.FOREGIN_KEY:
      IconComponent = IconForeignKey;

      break;
    case Icons.POLICIES:
      IconComponent = IconPolicies;

      break;
    case Icons.ICON_REMOVE:
      IconComponent = IconRemove;

      break;
    case Icons.IC_EDIT_PRIMARY:
      IconComponent = IcEditPrimary;

      break;
    case Icons.ICON_PLUS_PRIMARY_OUTLINED:
      IconComponent = IconPlusPrimaryOutlined;

      break;

    case Icons.INFO_SECONDARY:
      IconComponent = IconInfoSecondary;

      break;
    case Icons.MSTEAMS:
      IconComponent = IconMSTeams;

      break;
    case Icons.MSTEAMS_GREY:
      IconComponent = IconMSTeamsGrey;

      break;
    case Icons.DELETE_COLORED:
      IconComponent = IconDeleteColored;

      break;

    case Icons.SHOW_PASSWORD:
      IconComponent = IconShowPassword;

      break;

    case Icons.HIDE_PASSWORD:
      IconComponent = IconHidePassword;

      break;

    case Icons.ARROW_DOWN_LIGHT:
      IconComponent = IconArrowDownLight;

      break;

    case Icons.ARROW_RIGHT_LIGHT:
      IconComponent = IconArrowRightLight;

      break;

    case Icons.TEST_SUITE:
      IconComponent = IconTestSuite;

      break;

    case Icons.ALL_ACTIVITY:
      IconComponent = IconAllActivity;

      break;
    case Icons.FILTER_PRIMARY:
      IconComponent = IconFilterPrimary;

      break;

    case Icons.OPEN_LOCK:
      IconComponent = IconOpenLock;

      break;

    case Icons.CLOSED_LOCK:
      IconComponent = IconClosedLock;

      break;

    case Icons.ADMIN:
      IconComponent = IconAdmin;

      break;

    case Icons.NO_DATA_PLACEHOLDER:
      IconComponent = IconNoDataFoundPlaceHolder;

      break;

    default:
      IconComponent = null;

      break;
  }

  return IconComponent ? (
    <img
      // eslint-disable-next-line react/prop-types
      className={`svg-icon ${props.className ? props.className : ''}`}
      data-testid="image"
      height="16px"
      src={IconComponent}
      width="16px"
      {...omit(props, ['src', 'className'])}
    />
  ) : null;
};

export default SVGIcons;

export { IcDeleteColored };
