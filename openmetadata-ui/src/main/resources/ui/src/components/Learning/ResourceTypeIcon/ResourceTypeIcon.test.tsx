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

import { render, screen } from '@testing-library/react';
import { ResourceType } from '../../../generated/entity/learning/learningResource';
import { ResourceTypeIcon } from './ResourceTypeIcon';

describe('ResourceTypeIcon', () => {
  it.each([
    [ResourceType.Video, 'label.video'],
    [ResourceType.Storylane, 'label.storylane'],
    [ResourceType.Link, 'label.link'],
    [ResourceType.PDF, 'label.pdf'],
  ])(
    'should render the %s icon labelled with its type',
    (resourceType, labelKey) => {
      render(<ResourceTypeIcon resourceType={resourceType} />);

      const icon = screen.getByTestId(`resource-type-icon-${resourceType}`);

      expect(icon).toHaveAttribute('role', 'img');
      expect(icon).toHaveAttribute('aria-label', labelKey);
    }
  );

  it('should fall back to the video icon for a type without its own icon', () => {
    render(<ResourceTypeIcon resourceType={ResourceType.Article} />);

    expect(
      screen.getByTestId(`resource-type-icon-${ResourceType.Video}`)
    ).toHaveAttribute('aria-label', 'label.article');
  });

  it('should hide the icon from assistive technology when a visible label is present', () => {
    render(<ResourceTypeIcon aria-hidden resourceType={ResourceType.Link} />);

    expect(
      screen.getByTestId(`resource-type-icon-${ResourceType.Link}`)
    ).toHaveAttribute('aria-hidden', 'true');
  });
});
