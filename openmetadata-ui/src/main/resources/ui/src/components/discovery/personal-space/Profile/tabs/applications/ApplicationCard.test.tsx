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

import { fireEvent, render, screen } from '@testing-library/react';
import ApplicationCard from './ApplicationCard';

jest.mock('react-i18next', () => {
  const t = (key: string) => key;

  return { useTranslation: () => ({ t }) };
});

const onClick = jest.fn();

describe('ApplicationCard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the title, plain-text description and no antd markup', () => {
    const { container } = render(
      <ApplicationCard
        appName="SearchIndexingApplication"
        description="<p>Index <b>everything</b></p>"
        title="Search Indexing"
        onClick={onClick}
      />
    );

    expect(screen.getByText('Search Indexing')).toBeInTheDocument();
    expect(screen.getByText('Index everything')).toBeInTheDocument();
    expect(screen.queryByTestId('disabled-badge')).not.toBeInTheDocument();
    expect(container.querySelector('[class*="ant-"]')).toBeNull();
  });

  it('opens the app on click and on Enter', () => {
    render(<ApplicationCard appName="App" title="App" onClick={onClick} />);
    const card = screen.getByTestId('app-card');

    fireEvent.click(card);
    fireEvent.keyDown(card, { key: 'Enter' });

    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('shows the disabled badge but stays clickable so the app can be restored', () => {
    render(
      <ApplicationCard isDisabled appName="App" title="App" onClick={onClick} />
    );

    expect(screen.getByTestId('disabled-badge')).toHaveTextContent(
      'label.disabled'
    );

    fireEvent.click(screen.getByTestId('app-card'));

    expect(onClick).toHaveBeenCalled();
  });

  it('is not clickable when unavailable', () => {
    render(
      <ApplicationCard
        appName="App"
        title="App"
        unavailableReason="cache not configured"
        onClick={onClick}
      />
    );
    const card = screen.getByTestId('app-card');

    fireEvent.click(card);

    expect(card).toHaveAttribute('aria-disabled', 'true');
    expect(onClick).not.toHaveBeenCalled();
  });

  it('opens the app from a Configure link instead of the whole card', () => {
    render(
      <ApplicationCard
        actionLabel="label.configure"
        appName="App"
        title="App"
        onClick={onClick}
      />
    );
    const card = screen.getByTestId('app-card');

    expect(card).not.toHaveAttribute('role', 'button');

    fireEvent.click(card);

    expect(onClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('config-btn'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disables the Configure link when the app is unavailable', () => {
    render(
      <ApplicationCard
        actionLabel="label.configure"
        appName="App"
        title="App"
        unavailableReason="cache not configured"
        onClick={onClick}
      />
    );

    expect(screen.getByTestId('config-btn')).toBeDisabled();
  });
});
