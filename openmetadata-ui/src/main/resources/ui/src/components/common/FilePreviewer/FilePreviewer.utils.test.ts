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

import { PreviewRendererId, ResolveRendererArgs } from './FilePreviewer.interface';
import { resolveRenderer } from './FilePreviewer.utils';

const resolve = (a: ResolveRendererArgs) => resolveRenderer(a);

describe('resolveRenderer', () => {
  it('maps markdown by extension', () => {
    expect(resolve({ fileExtension: 'md' })).toBe(PreviewRendererId.Markdown);
    expect(resolve({ fileExtension: '.MARKDOWN' })).toBe(PreviewRendererId.Markdown);
  });

  it('maps text and pdf by extension', () => {
    expect(resolve({ fileExtension: 'txt' })).toBe(PreviewRendererId.Text);
    expect(resolve({ fileExtension: 'pdf' })).toBe(PreviewRendererId.Pdf);
  });

  it('maps raster images by extension', () => {
    ['png', 'jpg', 'jpeg', 'gif', 'webp'].forEach((e) =>
      expect(resolve({ fileExtension: e })).toBe(PreviewRendererId.Image)
    );
  });

  it('never renders svg inline', () => {
    expect(resolve({ fileExtension: 'svg' })).toBe(PreviewRendererId.Unsupported);
    expect(resolve({ mimeType: 'image/svg+xml' })).toBe(PreviewRendererId.Unsupported);
  });

  it('falls back to mime when no extension', () => {
    expect(resolve({ mimeType: 'application/pdf' })).toBe(PreviewRendererId.Pdf);
    expect(resolve({ mimeType: 'text/markdown' })).toBe(PreviewRendererId.Markdown);
    expect(resolve({ mimeType: 'text/plain' })).toBe(PreviewRendererId.Text);
    expect(resolve({ mimeType: 'image/png' })).toBe(PreviewRendererId.Image);
  });

  it('returns Unsupported for unknown', () => {
    expect(resolve({ fileExtension: 'exe', mimeType: 'application/x-msdownload' })).toBe(
      PreviewRendererId.Unsupported
    );
    expect(resolve({})).toBe(PreviewRendererId.Unsupported);
  });
});
