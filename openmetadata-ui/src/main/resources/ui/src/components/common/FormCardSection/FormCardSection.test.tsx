/*
 *  Copyright 2024 Collate.
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
import FormCardSection from './FormCardSection';

describe('FormCardSection component', () => {
  it('should render heading, subheading and children properly', () => {
    render(
      <FormCardSection heading="heading" subHeading="subHeading">
        children
      </FormCardSection>
    );

    expect(screen.getByText('heading')).toBeInTheDocument();
    expect(screen.getByText('subHeading')).toBeInTheDocument();
    expect(screen.getByText('children')).toBeInTheDocument();
  });
});
