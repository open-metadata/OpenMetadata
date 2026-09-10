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
import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { forwardRef, ReactNode } from 'react';
import { DataProduct } from '../../../../../generated/entity/domains/dataProduct';
import { Domain } from '../../../../../generated/entity/domains/domain';
import {
  renderDomainClassificationTagsCell,
  renderDomainGlossaryTagsCell,
  renderDomainNameCell,
  renderDomainOwnersCell,
} from './domainFieldRenderers';
import { useDomainCardTemplates } from './useDomainCardTemplates';

jest.mock('@openmetadata/ui-core-components', () => ({
  Avatar: () => <span data-testid="avatar" />,
  Box: ({
    children,
    onClick,
    'data-testid': dataTestId,
  }: {
    children: ReactNode;
    onClick?: () => void;
    'data-testid'?: string;
  }) => (
    <div data-testid={dataTestId} onClick={onClick}>
      {children}
    </div>
  ),
  Grid: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    {
      Item: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    }
  ),
  Typography: forwardRef<
    HTMLSpanElement,
    { children: ReactNode; className?: string; weight?: string }
  >(({ children, className, weight }, ref) => (
    <span className={className} data-weight={weight} ref={ref}>
      {children}
    </span>
  )),
}));

jest.mock('../../../../../utils/TooltipUtils', () => ({
  renderBreakableTooltip: (value: string) => value,
}));

jest.mock('../../../../../utils/IconUtils', () => ({
  getEntityAvatarProps: () => ({}),
}));

jest.mock('../../../OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: ({ showDashPlaceholder }: { showDashPlaceholder?: boolean }) => (
    <div
      data-show-dash={String(showDashPlaceholder)}
      data-testid="owner-label"
    />
  ),
}));

jest.mock('../../../TagBadgeList/TagBadgeList.component', () => ({
  __esModule: true,
  default: ({ emptyPlaceholder }: { emptyPlaceholder?: string }) => (
    <div
      data-empty-placeholder={emptyPlaceholder}
      data-testid="tag-badge-list"
    />
  ),
}));

jest.mock('../../../RichTextEditor/RichTextEditorPreviewerV1', () =>
  jest
    .fn()
    .mockImplementation(({ markdown }: { markdown: string }) => (
      <div data-testid="rte-previewer">{markdown}</div>
    ))
);

const DOMAIN = {
  id: 'domain-id',
  name: 'engineering',
  displayName: 'Engineering',
  fullyQualifiedName: 'engineering',
} as Domain;

describe('renderDomainNameCell', () => {
  it('navigates once when the name cell is clicked', () => {
    const onClick = jest.fn();

    render(<>{renderDomainNameCell(DOMAIN, onClick)}</>);
    fireEvent.click(screen.getByText('Engineering'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('stops the click from bubbling to the row so navigation is not duplicated', () => {
    const onClick = jest.fn();
    const rowClick = jest.fn();

    render(
      <div onClick={rowClick}>{renderDomainNameCell(DOMAIN, onClick)}</div>
    );
    fireEvent.click(screen.getByText('Engineering'));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(rowClick).not.toHaveBeenCalled();
  });

  it('does not attach a click handler when no onClick is provided', () => {
    const rowClick = jest.fn();

    render(<div onClick={rowClick}>{renderDomainNameCell(DOMAIN)}</div>);
    fireEvent.click(screen.getByText('Engineering'));

    // With no cell handler the click falls through to the row unchanged.
    expect(rowClick).toHaveBeenCalledTimes(1);
  });
});

describe('renderDomainOwnersCell', () => {
  it('forwards showDashPlaceholder to OwnerLabel', () => {
    render(
      <>
        {renderDomainOwnersCell({ owners: [] }, { showDashPlaceholder: true })}
      </>
    );

    expect(screen.getByTestId('owner-label')).toHaveAttribute(
      'data-show-dash',
      'true'
    );
  });

  it('defaults showDashPlaceholder to undefined when no options are passed', () => {
    render(<>{renderDomainOwnersCell({ owners: [] })}</>);

    expect(screen.getByTestId('owner-label')).toHaveAttribute(
      'data-show-dash',
      'undefined'
    );
  });
});

describe('renderDomainGlossaryTagsCell / renderDomainClassificationTagsCell', () => {
  it('forwards emptyPlaceholder to TagBadgeList for glossary terms', () => {
    render(
      <>
        {renderDomainGlossaryTagsCell({ tags: [] }, { emptyPlaceholder: '--' })}
      </>
    );

    expect(screen.getByTestId('tag-badge-list')).toHaveAttribute(
      'data-empty-placeholder',
      '--'
    );
  });

  it('forwards emptyPlaceholder to TagBadgeList for classification tags', () => {
    render(
      <>
        {renderDomainClassificationTagsCell(
          { tags: [] },
          { emptyPlaceholder: '--' }
        )}
      </>
    );

    expect(screen.getByTestId('tag-badge-list')).toHaveAttribute(
      'data-empty-placeholder',
      '--'
    );
  });
});

const DATA_PRODUCT_BASE = {
  id: 'dp-1',
  name: 'fifth',
  displayName: 'Fifth',
  fullyQualifiedName: 'fifth',
} as DataProduct;

describe('useDomainCardTemplates > renderDataProductCard', () => {
  it('styles all 5 field labels as 12px / medium / text-primary', () => {
    const { result } = renderHook(() => useDomainCardTemplates());

    render(<>{result.current.renderDataProductCard(DATA_PRODUCT_BASE)}</>);

    [
      'label.description',
      'label.owner-plural',
      'label.expert-plural',
      'label.glossary-term-plural',
      'label.tag-plural',
    ].forEach((key) => {
      const label = screen.getByText(key);

      expect(label).toHaveClass('tw:text-primary');
      expect(label).toHaveAttribute('data-weight', 'medium');
    });
  });

  it('renders -- for description when empty', () => {
    const { result } = renderHook(() => useDomainCardTemplates());

    render(
      <>
        {result.current.renderDataProductCard({
          ...DATA_PRODUCT_BASE,
          description: '',
        })}
      </>
    );

    expect(screen.getByText('--')).toBeInTheDocument();
  });

  it('renders the description text and no "View more" when it fits within 2 lines', () => {
    const { result } = renderHook(() => useDomainCardTemplates());

    render(
      <>
        {result.current.renderDataProductCard({
          ...DATA_PRODUCT_BASE,
          description: '**A short description.**',
        })}
      </>
    );

    // The mock renders markdown verbatim (no actual parsing) - this just
    // confirms the raw description string reaches the previewer unmodified,
    // i.e. nothing is stripping it before it gets there.
    expect(screen.getByTestId('rte-previewer')).toHaveTextContent(
      '**A short description.**'
    );
    expect(screen.queryByText('label.view-more')).not.toBeInTheDocument();
  });

  it('shows "View more" when the description overflows 2 lines', () => {
    // jsdom never lays out real text, so scrollHeight/clientHeight always
    // report 0 unless overridden. The truncation check runs synchronously in
    // a mount-time useEffect, so the getters must already return the
    // overflowing values *before* render() flushes that effect - mocking
    // scrollHeight/clientHeight on an already-rendered node (and re-rendering
    // to retrigger the effect) doesn't work here: a fresh render() mounts a
    // fresh element, and re-rendering with the same description string
    // doesn't change the effect's dependency, so it wouldn't re-run anyway.
    const scrollHeightSpy = jest
      .spyOn(window.HTMLElement.prototype, 'scrollHeight', 'get')
      .mockReturnValue(60);
    const clientHeightSpy = jest
      .spyOn(window.HTMLElement.prototype, 'clientHeight', 'get')
      .mockReturnValue(32);

    try {
      const { result } = renderHook(() => useDomainCardTemplates());

      render(
        <>
          {result.current.renderDataProductCard({
            ...DATA_PRODUCT_BASE,
            description: 'A description long enough to wrap past two lines.',
          })}
        </>
      );

      const viewMore = screen.getByText('label.view-more');

      expect(viewMore).toBeInTheDocument();
      expect(viewMore).toHaveClass('tw:text-brand-secondary');
    } finally {
      scrollHeightSpy.mockRestore();
      clientHeightSpy.mockRestore();
    }
  });

  it('requests the dash placeholder for both owners and experts', () => {
    const { result } = renderHook(() => useDomainCardTemplates());

    render(<>{result.current.renderDataProductCard(DATA_PRODUCT_BASE)}</>);

    const ownerLabels = screen.getAllByTestId('owner-label');

    expect(ownerLabels).toHaveLength(2);

    ownerLabels.forEach((el) =>
      expect(el).toHaveAttribute('data-show-dash', 'true')
    );
  });

  it('requests the -- placeholder for both glossary terms and tags', () => {
    const { result } = renderHook(() => useDomainCardTemplates());

    render(<>{result.current.renderDataProductCard(DATA_PRODUCT_BASE)}</>);

    const tagBadgeLists = screen.getAllByTestId('tag-badge-list');

    expect(tagBadgeLists).toHaveLength(2);

    tagBadgeLists.forEach((el) =>
      expect(el).toHaveAttribute('data-empty-placeholder', '--')
    );
  });
});
