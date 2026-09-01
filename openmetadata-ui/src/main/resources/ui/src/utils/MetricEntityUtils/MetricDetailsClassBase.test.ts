/*
 *  Copyright 2026 Collate.
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
import { DetailPageWidgetKeys } from '../../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../../enums/entity.enum';
import { MetricDetailsClassBase } from './MetricDetailsClassBase';

jest.mock('./MetricUtils', () => ({
  getMetricDetailsPageTabs: jest.fn(),
  getMetricWidgetsFromKey: jest.fn(),
}));

describe('MetricDetailsClassBase', () => {
  const metricDetails = new MetricDetailsClassBase();

  it('exposes exactly the six primary Metric tabs', () => {
    const tabs = metricDetails.getMetricDetailPageTabsIds();

    expect(tabs.map(({ id }) => id)).toEqual([
      EntityTabs.OVERVIEW,
      EntityTabs.LINEAGE,
      EntityTabs.ASSETS,
      EntityTabs.DATA_OBSERVABILITY,
      EntityTabs.ACTIVITY_FEED,
      EntityTabs.APPROVAL,
    ]);
    expect(
      tabs.find(({ id }) => id === EntityTabs.ACTIVITY_FEED)?.displayName
    ).toBe('label.activity-and-task-plural');
  });

  it('keeps custom properties inside the Overview layout', () => {
    expect(
      metricDetails
        .getDefaultLayout(EntityTabs.OVERVIEW)
        .some(({ i }) => i === DetailPageWidgetKeys.CUSTOM_PROPERTIES)
    ).toBe(true);
    expect(
      metricDetails.getDefaultLayout(EntityTabs.CUSTOM_PROPERTIES)
    ).toEqual([]);
  });

  it('stacks dimensions and measures inside the wide left panel', () => {
    const layout = metricDetails.getDefaultLayout(EntityTabs.OVERVIEW);
    const leftPanel = layout.find(
      (widget) => widget.i === DetailPageWidgetKeys.LEFT_PANEL
    );

    expect(leftPanel?.w).toBe(6);

    const childKeys = leftPanel?.children?.map((child) => child.i);

    expect(childKeys).toEqual([
      DetailPageWidgetKeys.METRIC_HIERARCHY,
      DetailPageWidgetKeys.DESCRIPTION,
      DetailPageWidgetKeys.METRIC_DEFINITION,
      DetailPageWidgetKeys.METRIC_DIMENSIONS,
      DetailPageWidgetKeys.METRIC_MEASURES,
    ]);
  });

  it('offers both widgets in the customization widget list', () => {
    const widgetKeys = metricDetails
      .getCommonWidgetList()
      .map((widget) => widget.fullyQualifiedName);

    expect(widgetKeys).toContain(DetailPageWidgetKeys.METRIC_DIMENSIONS);
    expect(widgetKeys).toContain(DetailPageWidgetKeys.METRIC_MEASURES);
  });

  it('returns a configured height for both widgets', () => {
    expect(
      metricDetails.getWidgetHeight(DetailPageWidgetKeys.METRIC_DIMENSIONS)
    ).toBeGreaterThan(1);
    expect(
      metricDetails.getWidgetHeight(DetailPageWidgetKeys.METRIC_MEASURES)
    ).toBeGreaterThan(1);
  });
});
