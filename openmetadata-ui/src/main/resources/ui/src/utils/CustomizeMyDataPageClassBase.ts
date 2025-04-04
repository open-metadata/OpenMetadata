/*
 *  Copyright 2023 Collate.
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

import { FC } from 'react';
import ActivityFeedImg from '../assets/img/activity-feed.png';
import AnnouncementImg from '../assets/img/announcement.png';
import DataAssetsImg from '../assets/img/data-assets.png';
import FollowingImg from '../assets/img/following.png';
import KPISmallImg from '../assets/img/kpi-small.png';
import KPIImg from '../assets/img/kpi.png';
import MyDataImg from '../assets/img/my-data.png';
import RecentViewsImg from '../assets/img/recent-views.png';
import TotalAssetsMediumImg from '../assets/img/total-assets-medium.png';
import TotalAssetsImg from '../assets/img/total-assets.png';
import ApiEndpointsImg from '../assets/img/widgets/api-endpoints.png';
import ApiSchemaImg from '../assets/img/widgets/api-schema.png';
import ContainerChildrenImg from '../assets/img/widgets/container-children.png';
import ContainerSchemaImg from '../assets/img/widgets/container-schema.png';
import CustomPropertyImg from '../assets/img/widgets/custom_properties.png';
import ChartsTableImg from '../assets/img/widgets/dashboard-charts.png';
import DataModelImg from '../assets/img/widgets/dashboard-data-model.png';
import DataProductImg from '../assets/img/widgets/data-products.png';
import DatabaseSchemaImg from '../assets/img/widgets/database-schema-table.png';
import DescriptionLargeImg from '../assets/img/widgets/description-large.png';
import DescriptionImg from '../assets/img/widgets/description.png';
import DomainImg from '../assets/img/widgets/Domain.png';
import FrequentlyJoinedTablesImg from '../assets/img/widgets/frequently-joined-tables.png';
import GlossaryTermImg from '../assets/img/widgets/glossary-terms.png';
import MlModelFeaturesImg from '../assets/img/widgets/ml-features.png';
import OwnersImg from '../assets/img/widgets/owners.png';
import PipelineTasksImg from '../assets/img/widgets/pipeline-tasks.png';
import ReferencesImg from '../assets/img/widgets/References.png';
import RelatedMetricsImg from '../assets/img/widgets/related-metrics.png';
import RelatedTermsImg from '../assets/img/widgets/RelatedTerms.png';
import ReviewersImg from '../assets/img/widgets/Reviewers.png';
import SchemaTablesImg from '../assets/img/widgets/schema-tables.png';
import SearchIndexFieldsImg from '../assets/img/widgets/search-index-fields.png';
import StoredProcedureCodeImg from '../assets/img/widgets/stored-procedure-code.png';
import SynonymsImg from '../assets/img/widgets/Synonyms.png';
import TableConstraints from '../assets/img/widgets/table-constraints.png';
import TablesSchemaImg from '../assets/img/widgets/tables-schema.png';
import TagsImg from '../assets/img/widgets/tags.png';
import TermsImg from '../assets/img/widgets/Terms.png';
import TopicSchemaImg from '../assets/img/widgets/topic-schema.png';
import { MyDataWidget } from '../components/MyData/MyDataWidget/MyDataWidget.component';
import AnnouncementsWidget, {
  AnnouncementsWidgetProps,
} from '../components/MyData/RightSidebar/AnnouncementsWidget';
import FollowingWidget, {
  FollowingWidgetProps,
} from '../components/MyData/RightSidebar/FollowingWidget';
import DataAssetsWidget from '../components/MyData/Widgets/DataAssetsWidget/DataAssetsWidget.component';
import FeedsWidget from '../components/MyData/Widgets/FeedsWidget/FeedsWidget.component';
import KPIWidget from '../components/MyData/Widgets/KPIWidget/KPIWidget.component';
import RecentlyViewed from '../components/MyData/Widgets/RecentlyViewed/RecentlyViewed';
import TotalDataAssetsWidget from '../components/MyData/Widgets/TotalDataAssetsWidget/TotalDataAssetsWidget.component';
import {
  LandingPageWidgetKeys,
  WidgetWidths,
} from '../enums/CustomizablePage.enum';
import {
  DetailPageWidgetKeys,
  GlossaryTermDetailPageWidgetKeys,
} from '../enums/CustomizeDetailPage.enum';
import {
  WidgetCommonProps,
  WidgetConfig,
} from '../pages/CustomizablePage/CustomizablePage.interface';

class CustomizeMyDataPageClassBase {
  defaultWidgetHeight = 3;
  landingPageWidgetMargin = 16;
  landingPageRowHeight = 100;
  landingPageMaxGridSize = 4;

  landingPageWidgetDefaultHeights: Record<string, number> = {
    activityFeed: 6,
    announcements: 3,
    following: 3,
    recentlyViewed: 3,
    myData: 3,
    kpi: 3,
    totalAssets: 3,
    DataAssets: 3,
  };

  announcementWidget: WidgetConfig = {
    h: this.landingPageWidgetDefaultHeights.announcements,
    i: LandingPageWidgetKeys.ANNOUNCEMENTS,
    w: 1,
    x: 3,
    y: 0,
    static: true, // Making announcement widget fixed on top right position
  };

  defaultLayout: Array<WidgetConfig> = [
    {
      h: this.landingPageWidgetDefaultHeights.activityFeed,
      i: LandingPageWidgetKeys.ACTIVITY_FEED,
      w: 3,
      x: 0,
      y: 0,
      static: false,
    },
    {
      h: this.landingPageWidgetDefaultHeights.DataAssets,
      i: LandingPageWidgetKeys.DATA_ASSETS,
      w: 3,
      x: 0,
      y: 0,
      static: false,
    },
    {
      h: this.landingPageWidgetDefaultHeights.myData,
      i: LandingPageWidgetKeys.MY_DATA,
      w: 1,
      x: 3,
      y: 6,
      static: false,
    },
    {
      h: this.landingPageWidgetDefaultHeights.kpi,
      i: LandingPageWidgetKeys.KPI,
      w: 2,
      x: 0,
      y: 9,
      static: false,
    },
    {
      h: this.landingPageWidgetDefaultHeights.totalAssets,
      i: LandingPageWidgetKeys.TOTAL_DATA_ASSETS,
      w: 3,
      x: 0,
      y: 6,
      static: false,
    },
    {
      h: this.landingPageWidgetDefaultHeights.following,
      i: LandingPageWidgetKeys.FOLLOWING,
      w: 1,
      x: 3,
      y: 1.5,
      static: false,
    },
    {
      h: this.landingPageWidgetDefaultHeights.recentlyViewed,
      i: LandingPageWidgetKeys.RECENTLY_VIEWED,
      w: 1,
      x: 3,
      y: 3,
      static: false,
    },
  ];

  protected updateDefaultLayoutLayout(layout: Array<WidgetConfig>) {
    this.defaultLayout = layout;
  }

  protected updateLandingPageWidgetDefaultHeights(obj: Record<string, number>) {
    this.landingPageWidgetDefaultHeights = obj;
  }

  /**
   *
   * @param string widgetKey
   * @returns React.FC<
    {
      isEditView?: boolean;
      widgetKey: string;
      handleRemoveWidget?: (widgetKey: string) => void;
      announcements: Thread[];
      followedData: EntityReference[];
      followedDataCount: number;
      isLoadingOwnedData: boolean;
    }
  >
   */
  public getWidgetsFromKey(
    widgetKey: string
  ): FC<WidgetCommonProps & AnnouncementsWidgetProps & FollowingWidgetProps> {
    if (widgetKey.startsWith(LandingPageWidgetKeys.ACTIVITY_FEED)) {
      return FeedsWidget;
    }
    if (widgetKey.startsWith(LandingPageWidgetKeys.DATA_ASSETS)) {
      return DataAssetsWidget;
    }
    if (widgetKey.startsWith(LandingPageWidgetKeys.MY_DATA)) {
      return MyDataWidget;
    }
    if (widgetKey.startsWith(LandingPageWidgetKeys.KPI)) {
      return KPIWidget;
    }
    if (widgetKey.startsWith(LandingPageWidgetKeys.TOTAL_DATA_ASSETS)) {
      return TotalDataAssetsWidget;
    }
    if (widgetKey.startsWith(LandingPageWidgetKeys.ANNOUNCEMENTS)) {
      return AnnouncementsWidget;
    }
    if (widgetKey.startsWith(LandingPageWidgetKeys.FOLLOWING)) {
      return FollowingWidget;
    }
    if (widgetKey.startsWith(LandingPageWidgetKeys.RECENTLY_VIEWED)) {
      return RecentlyViewed;
    }

    return (() => null) as React.FC;
  }

  public getWidgetImageFromKey(widgetKey: string, size?: number): string {
    switch (widgetKey) {
      case LandingPageWidgetKeys.ACTIVITY_FEED: {
        return ActivityFeedImg;
      }
      case LandingPageWidgetKeys.DATA_ASSETS: {
        return DataAssetsImg;
      }
      case LandingPageWidgetKeys.MY_DATA: {
        return MyDataImg;
      }
      case LandingPageWidgetKeys.KPI: {
        if (size === WidgetWidths.small) {
          return KPISmallImg;
        }

        return KPIImg;
      }
      case LandingPageWidgetKeys.TOTAL_DATA_ASSETS: {
        if (size === WidgetWidths.medium) {
          return TotalAssetsMediumImg;
        }

        return TotalAssetsImg;
      }
      case LandingPageWidgetKeys.ANNOUNCEMENTS: {
        return AnnouncementImg;
      }
      case LandingPageWidgetKeys.FOLLOWING: {
        return FollowingImg;
      }
      case LandingPageWidgetKeys.RECENTLY_VIEWED: {
        return RecentViewsImg;
      }
      case DetailPageWidgetKeys.DESCRIPTION:
      case GlossaryTermDetailPageWidgetKeys.DESCRIPTION:
        if (size === WidgetWidths.large) {
          return DescriptionLargeImg;
        }

        return DescriptionImg;
      case DetailPageWidgetKeys.CUSTOM_PROPERTIES:
      case GlossaryTermDetailPageWidgetKeys.CUSTOM_PROPERTIES:
        return CustomPropertyImg;
      case GlossaryTermDetailPageWidgetKeys.DOMAIN:
        return DomainImg;
      case GlossaryTermDetailPageWidgetKeys.OWNER:
        return OwnersImg;
      case GlossaryTermDetailPageWidgetKeys.REFERENCES:
        return ReferencesImg;
      case GlossaryTermDetailPageWidgetKeys.RELATED_TERMS:
        return RelatedTermsImg;
      case GlossaryTermDetailPageWidgetKeys.REVIEWER:
        return ReviewersImg;
      case GlossaryTermDetailPageWidgetKeys.SYNONYMS:
        return SynonymsImg;
      case GlossaryTermDetailPageWidgetKeys.TERMS_TABLE:
        return TermsImg;
      case GlossaryTermDetailPageWidgetKeys.TAGS:
        return TagsImg;
      case DetailPageWidgetKeys.DATA_PRODUCTS:
        return DataProductImg;
      case DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES:
        return FrequentlyJoinedTablesImg;
      case DetailPageWidgetKeys.GLOSSARY_TERMS:
        return GlossaryTermImg;
      case DetailPageWidgetKeys.TABLE_SCHEMA:
        return TablesSchemaImg;
      case DetailPageWidgetKeys.TABLE_CONSTRAINTS:
        return TableConstraints;
      case DetailPageWidgetKeys.API_ENDPOINTS:
        return ApiEndpointsImg;
      case DetailPageWidgetKeys.API_SCHEMA:
        return ApiSchemaImg;
      case DetailPageWidgetKeys.CONTAINER_SCHEMA:
        return ContainerSchemaImg;
      case DetailPageWidgetKeys.CONTAINER_CHILDREN:
        return ContainerChildrenImg;
      case DetailPageWidgetKeys.CHARTS_TABLE:
        return ChartsTableImg;
      case DetailPageWidgetKeys.DATA_MODEL:
        return DataModelImg;
      case DetailPageWidgetKeys.DATABASE_SCHEMA:
        return DatabaseSchemaImg;
      case DetailPageWidgetKeys.TABLES:
        return SchemaTablesImg;
      case DetailPageWidgetKeys.RELATED_METRICS:
        return RelatedMetricsImg;
      case DetailPageWidgetKeys.ML_MODEL_FEATURES:
        return MlModelFeaturesImg;
      case DetailPageWidgetKeys.PIPELINE_TASKS:
        return PipelineTasksImg;
      case DetailPageWidgetKeys.SEARCH_INDEX_FIELDS:
        return SearchIndexFieldsImg;
      case DetailPageWidgetKeys.STORED_PROCEDURE_CODE:
        return StoredProcedureCodeImg;
      case DetailPageWidgetKeys.TOPIC_SCHEMA:
        return TopicSchemaImg;
      default: {
        return '';
      }
    }
  }

  public getWidgetHeight(widgetName: string) {
    switch (widgetName) {
      case 'ActivityFeed':
        return this.landingPageWidgetDefaultHeights.activityFeed;
      case 'DataAssets':
        return this.landingPageWidgetDefaultHeights.DataAssets;
      case 'Announcements':
        return this.landingPageWidgetDefaultHeights.announcements;
      case 'Following':
        return this.landingPageWidgetDefaultHeights.following;
      case 'RecentlyViewed':
        return this.landingPageWidgetDefaultHeights.recentlyViewed;
      case 'MyData':
        return this.landingPageWidgetDefaultHeights.myData;
      case 'KPI':
        return this.landingPageWidgetDefaultHeights.kpi;
      case 'TotalAssets':
        return this.landingPageWidgetDefaultHeights.totalAssets;
      default:
        return this.defaultWidgetHeight;
    }
  }
}

const customizeMyDataPageClassBase = new CustomizeMyDataPageClassBase();

export default customizeMyDataPageClassBase;
export { CustomizeMyDataPageClassBase };
