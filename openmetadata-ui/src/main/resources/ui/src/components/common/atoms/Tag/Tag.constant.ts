import { TagSize } from './Tag.interface';

/**
 * Tailwind classes for size variants applied to the Badge wrapper and label span.
 *
 * xs → 16px height / 10px font
 * sm → 20px height / 12px font
 * md → 24px height / 14px font
 */
export const SIZE_CLASS: Record<TagSize, string> = {
  xs: 'tw:h-4 tw:text-[10px]',
  sm: 'tw:h-5 tw:text-xs',
  md: 'tw:h-6 tw:text-sm',
};

/** Icon pixel size matching each tag size. */
export const ICON_PX: Record<TagSize, number> = { xs: 10, sm: 12, md: 14 };
