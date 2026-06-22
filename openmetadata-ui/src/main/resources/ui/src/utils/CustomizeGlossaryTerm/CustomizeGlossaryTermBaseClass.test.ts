/*
 *  Copyright 2025 Collate.
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
import {
  DetailPageWidgetKeys,
  GlossaryTermDetailPageWidgetKeys,
} from '../../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../../enums/entity.enum';
import { WidgetConfig } from '../../pages/CustomizablePage/CustomizablePage.interface';
import customizeGlossaryTermPageClassBase from './CustomizeGlossaryTermBaseClass';

describe('CustomizeGlossaryTermBaseClass.getDefaultWidgetForTab', () => {
  const overviewLayout = customizeGlossaryTermPageClassBase.getDefaultWidgetForTab(
    EntityTabs.OVERVIEW
  );

  const leftPanel = overviewLayout.find(
    (widget: WidgetConfig) => widget.i === DetailPageWidgetKeys.LEFT_PANEL
  );

  const relatedTermsChild = leftPanel?.children?.find(
    (child: WidgetConfig) =>
      child.i === GlossaryTermDetailPageWidgetKeys.RELATED_TERMS
  );

  it('should render the left panel container', () => {
    expect(leftPanel).toBeDefined();
    expect(leftPanel?.children?.length).toBeGreaterThan(0);
  });

  it('should not register Related Terms as a top-level widget', () => {
    const topLevelRelatedTerms = overviewLayout.find(
      (widget: WidgetConfig) =>
        widget.i === GlossaryTermDetailPageWidgetKeys.RELATED_TERMS
    );

    expect(topLevelRelatedTerms).toBeUndefined();
  });

  it('should render Related Terms as a child of the left panel', () => {
    expect(relatedTermsChild).toBeDefined();
  });

  it('should render Related Terms at full width inside the left panel', () => {
    expect(relatedTermsChild?.w).toBe(1);
  });

  it('should position Related Terms below Tags', () => {
    const children = leftPanel?.children ?? [];
    const tagsIndex = children.findIndex(
      (child: WidgetConfig) => child.i === DetailPageWidgetKeys.TAGS
    );
    const relatedTermsIndex = children.findIndex(
      (child: WidgetConfig) =>
        child.i === GlossaryTermDetailPageWidgetKeys.RELATED_TERMS
    );

    expect(tagsIndex).toBeGreaterThanOrEqual(0);
    expect(relatedTermsIndex).toBeGreaterThan(tagsIndex);
  });
});
