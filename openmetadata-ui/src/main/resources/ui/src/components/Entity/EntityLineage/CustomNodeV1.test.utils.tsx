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
import { fireEvent, screen, within } from '@testing-library/react';

interface PaginationAssertionParams {
  columnsContainer: HTMLElement;
  expectedPageText: string;
  expectedColumns: string[];
  direction: 'next' | 'prev';
  shouldBeDisabled?: 'prev' | 'next';
}

export const getInsidePageColumns = (
  columnsContainer: HTMLElement
): string[] => {
  const insidePageContainer = columnsContainer.querySelector(
    '.inside-current-page-items'
  );

  return insidePageContainer
    ? Array.from(
        insidePageContainer.querySelectorAll('.inside-current-page-item')
      ).map((el) => el.textContent?.trim() ?? '')
    : [];
};

export const assertPaginationState = ({
  columnsContainer,
  expectedPageText,
  expectedColumns,
  direction,
  shouldBeDisabled,
}: PaginationAssertionParams): void => {
  const prevButton = within(columnsContainer).getByTestId('prev-btn');
  const nextButton = within(columnsContainer).getByTestId('next-btn');
  const button = direction === 'next' ? nextButton : prevButton;

  expect(screen.getByText(expectedPageText)).toBeInTheDocument();

  const visibleColumns = getInsidePageColumns(columnsContainer);

  expect(visibleColumns).toEqual(expectedColumns);

  if (shouldBeDisabled === 'prev') {
    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();
  } else if (shouldBeDisabled === 'next') {
    expect(prevButton).not.toBeDisabled();
    expect(nextButton).toBeDisabled();
  } else {
    expect(prevButton).not.toBeDisabled();
    expect(nextButton).not.toBeDisabled();
  }

  fireEvent.click(button);
};
