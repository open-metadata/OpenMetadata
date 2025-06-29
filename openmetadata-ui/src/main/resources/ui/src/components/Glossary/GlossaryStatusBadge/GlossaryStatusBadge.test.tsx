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
import { Status } from '../../../generated/entity/data/glossaryTerm';
import { GlossaryStatusBadge } from './GlossaryStatusBadge.component';

describe('GlossaryStatusBadge', () => {
  it('renders the correct status', () => {
    render(<GlossaryStatusBadge status={Status.Approved} />);
    const statusElement = screen.getByText('Approved');

    expect(statusElement).toHaveClass('success');
  });

  it('renders the correct class based on draft status', () => {
    render(<GlossaryStatusBadge status={Status.Draft} />);
    const statusElement = screen.getByText('Draft');

    expect(statusElement).toHaveClass('pending');
  });

  it('renders the correct class based on rejected status', () => {
    render(<GlossaryStatusBadge status={Status.Rejected} />);
    const statusElement = screen.getByText('Rejected');

    expect(statusElement).toHaveClass('failure');
  });

  it('renders the correct class based on Deprecated status', () => {
    render(<GlossaryStatusBadge status={Status.Deprecated} />);
    const statusElement = screen.getByText('Deprecated');

    expect(statusElement).toHaveClass('deprecated');
  });
});
