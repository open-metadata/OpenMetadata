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
import { render, screen } from '@testing-library/react';
import { EntityTitleSection } from './EntityTitleSection';

describe('EntityTitleSection', () => {
  it('should render entity title section', () => {
    render(
      <EntityTitleSection
        entityDetails={{ name: 'Test Entity' }}
        entityLink="test-link"
      />
    );

    expect(screen.getByText('Test Entity')).toBeInTheDocument();
  });

  it('should render entity title section with tooltip', () => {
    render(
      <EntityTitleSection
        entityDetails={{ name: 'Test Entity <b>bold</b>' }}
        entityLink="test-link"
      />
    );

    expect(screen.getByText('Test Entity')).toBeInTheDocument();
    expect(screen.getByText('bold')).toBeInTheDocument();
  });
});
