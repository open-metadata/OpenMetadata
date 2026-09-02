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
import {
  DEFAULT_QUERY_BUILDER_PORTAL_ID,
  getQueryBuilderPortalContainer,
} from './portal';

describe('getQueryBuilderPortalContainer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should create the container on first use', () => {
    const container = getQueryBuilderPortalContainer();

    expect(container.id).toBe(DEFAULT_QUERY_BUILDER_PORTAL_ID);
    expect(document.getElementById(DEFAULT_QUERY_BUILDER_PORTAL_ID)).toBe(
      container
    );
  });

  it('should reuse the same node rather than stacking duplicates', () => {
    const first = getQueryBuilderPortalContainer();
    const second = getQueryBuilderPortalContainer();

    expect(second).toBe(first);
    expect(
      document.querySelectorAll(`#${DEFAULT_QUERY_BUILDER_PORTAL_ID}`)
    ).toHaveLength(1);
  });

  it('should opt the node into react-aria stacking above the overlay ceiling', () => {
    const container = getQueryBuilderPortalContainer();

    // Without both of these a popup renders *behind* a react-aria overlay,
    // which is the entire reason this helper exists.
    expect(container.getAttribute('data-react-aria-top-layer')).toBe('true');
    expect(container.style.zIndex).toBe('10001');
    expect(container.style.position).toBe('absolute');
  });

  it('should keep separate containers for callers that ask for their own id', () => {
    const workflow = getQueryBuilderPortalContainer('workflow-portal');
    const wizard = getQueryBuilderPortalContainer('wizard-portal');

    expect(workflow).not.toBe(wizard);
    expect(workflow.id).toBe('workflow-portal');
    expect(wizard.id).toBe('wizard-portal');
  });
});
