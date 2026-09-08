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
import { render, renderHook, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { DataProduct } from '../../../../../generated/entity/domains/dataProduct';
import { useDomainCardTemplates } from './useDomainCardTemplates';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Avatar: () => <span data-testid="avatar" />,
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Grid: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    {
      Item: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    }
  ),
  Typography: ({
    children,
    className,
    weight,
  }: {
    children: ReactNode;
    className?: string;
    weight?: string;
  }) => (
    <span className={className} data-weight={weight}>
      {children}
    </span>
  ),
}));

jest.mock('../../../../../utils/TooltipUtils', () => ({
  renderBreakableTooltip: (value: string) => value,
}));

jest.mock('../../../../../utils/IconUtils', () => ({
  getEntityAvatarProps: () => ({}),
}));

jest.mock('../../../../../utils/EntityNameUtils', () => ({
  getEntityName: (entity: DataProduct) => entity.displayName ?? entity.name,
}));

jest.mock('../../../OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: (props: Record<string, unknown>) => (
    <div
      data-show-dash={String(props.showDashPlaceholder)}
      data-testid="owner-label"
    />
  ),
}));

jest.mock('../../../RichTextEditor/RichTextEditorPreviewNew', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => (
    <div
      data-testid="rich-text-previewer"
      data-view-more-class={String(props.viewMoreButtonClassName)}
    />
  ),
}));

jest.mock('./domainFieldRenderers', () => ({
  CARD_NAME_CLIP_CLASS: 'card-name-clip',
  CLIPPED_NAME_CLASS: 'clipped-name',
  renderDomainOwnersCell: jest.fn(
    (_entity: unknown, options?: { showDashPlaceholder?: boolean }) => (
      <div
        data-show-dash={String(options?.showDashPlaceholder)}
        data-testid="owners-cell"
      />
    )
  ),
  renderDomainGlossaryTagsCell: jest.fn(
    (_entity: unknown, options?: { emptyPlaceholder?: string }) => (
      <div
        data-empty-placeholder={String(options?.emptyPlaceholder)}
        data-testid="glossary-cell"
      />
    )
  ),
  renderDomainClassificationTagsCell: jest.fn(
    (_entity: unknown, options?: { emptyPlaceholder?: string }) => (
      <div
        data-empty-placeholder={String(options?.emptyPlaceholder)}
        data-testid="tags-cell"
      />
    )
  ),
  renderDomainTypeCell: jest.fn(),
}));

const DATA_PRODUCT_WITH_DESCRIPTION = {
  id: 'dp-1',
  name: 'fifth',
  displayName: 'Fifth',
  fullyQualifiedName: 'fifth',
  description: '<p>Hello world</p>',
} as DataProduct;

const DATA_PRODUCT_WITHOUT_DESCRIPTION = {
  ...DATA_PRODUCT_WITH_DESCRIPTION,
  description: '',
} as DataProduct;

describe('useDomainCardTemplates > renderDataProductCard', () => {
  it('styles all 5 field labels as 12px / medium / text-primary', () => {
    const { result } = renderHook(() => useDomainCardTemplates());

    render(
      <>{result.current.renderDataProductCard(DATA_PRODUCT_WITH_DESCRIPTION)}</>
    );

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

  it('renders the -- placeholder instead of the previewer when description is empty', () => {
    const { result } = renderHook(() => useDomainCardTemplates());

    render(
      <>
        {result.current.renderDataProductCard(DATA_PRODUCT_WITHOUT_DESCRIPTION)}
      </>
    );

    expect(screen.getByText('--')).toBeInTheDocument();
    expect(screen.queryByTestId('rich-text-previewer')).not.toBeInTheDocument();
  });

  it('renders the previewer (not --) when description has content', () => {
    const { result } = renderHook(() => useDomainCardTemplates());

    render(
      <>{result.current.renderDataProductCard(DATA_PRODUCT_WITH_DESCRIPTION)}</>
    );

    expect(screen.getByTestId('rich-text-previewer')).toBeInTheDocument();
    expect(screen.queryByText('--')).not.toBeInTheDocument();
  });

  it('passes viewMoreButtonClassName="tw:!text-xs" to the previewer', () => {
    const { result } = renderHook(() => useDomainCardTemplates());

    render(
      <>{result.current.renderDataProductCard(DATA_PRODUCT_WITH_DESCRIPTION)}</>
    );

    expect(screen.getByTestId('rich-text-previewer')).toHaveAttribute(
      'data-view-more-class',
      'tw:!text-xs'
    );
  });

  it('requests the dash placeholder for owners', () => {
    const { result } = renderHook(() => useDomainCardTemplates());

    render(
      <>{result.current.renderDataProductCard(DATA_PRODUCT_WITH_DESCRIPTION)}</>
    );

    expect(screen.getByTestId('owners-cell')).toHaveAttribute(
      'data-show-dash',
      'true'
    );
  });

  it('requests the dash placeholder for experts', () => {
    const { result } = renderHook(() => useDomainCardTemplates());

    render(
      <>{result.current.renderDataProductCard(DATA_PRODUCT_WITH_DESCRIPTION)}</>
    );

    expect(screen.getByTestId('owner-label')).toHaveAttribute(
      'data-show-dash',
      'true'
    );
  });

  it('requests the -- placeholder for glossary terms and tags', () => {
    const { result } = renderHook(() => useDomainCardTemplates());

    render(
      <>{result.current.renderDataProductCard(DATA_PRODUCT_WITH_DESCRIPTION)}</>
    );

    expect(screen.getByTestId('glossary-cell')).toHaveAttribute(
      'data-empty-placeholder',
      '--'
    );
    expect(screen.getByTestId('tags-cell')).toHaveAttribute(
      'data-empty-placeholder',
      '--'
    );
  });
});
