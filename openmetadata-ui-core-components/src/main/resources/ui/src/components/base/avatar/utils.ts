/**
 * Extracts the initials from a full name.
 *
 * @param name - The full name from which to extract initials.
 * @returns The initials of the provided name. If the name contains only one word,
 *          it returns the first character of that word. If the name contains two words,
 *          it returns the first character of each word.
 */
export const getInitials = (name: string) => {
  const [firstName, lastName] = name.split(' ');

  return firstName.charAt(0) + (lastName ? lastName.charAt(0) : '');
};

/** Returns the first alphanumeric character of `name`, or '?' if none found. */
export const getFirstAlphanumeric = (name: string): string => {
  const match = name.match(/[a-zA-Z0-9]/);

  return match ? match[0] : '?';
};

/**
 * @deprecated Fixed-lightness HSL does not flip for dark mode (a 92%-light tint
 * stays glaring on a dark surface). Use {@link getAvatarColorClasses}, which
 * resolves to the `utility-*` Tailwind scale and adapts per theme.
 */
export const getAvatarColorTokens = (
  name: string
): { background: string; textColor: string; border: string } => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);

  return {
    background: `hsl(${hue}, 100%, 92%)`,
    textColor: `hsl(${hue}, 70%, 40%)`,
    border: `hsl(${hue}, 70%, 80%)`,
  };
};

export type AvatarColorVariant = 'outlined' | 'solid';

export interface AvatarColorClasses {
  /** Applied to the avatar root (surface + border). */
  container: string;
  /** Applied to the initials text. */
  text: string;
}

const TW_TEXT_FG_WHITE = 'tw:text-fg-white';

// Fixed 8-hue palette on the `utility-*` scale. Unlike raw HSL these flip with
// the theme (utility-blue-50 is a light tint in light mode, a dark tint in dark
// mode), so the same avatar reads correctly in both. Mirrors the OpenMetadata
// app palette (utils/ColorUtils.ts) so app and library avatars match.
const AVATAR_COLOR_CLASSES: Record<AvatarColorVariant, AvatarColorClasses>[] = [
  {
    solid: { container: 'tw:bg-utility-blue-500', text: TW_TEXT_FG_WHITE },
    outlined: {
      container: 'tw:bg-utility-blue-50 tw:border tw:border-utility-blue-200',
      text: 'tw:text-utility-blue-700',
    },
  },
  {
    solid: { container: 'tw:bg-utility-pink-500', text: TW_TEXT_FG_WHITE },
    outlined: {
      container: 'tw:bg-utility-pink-50 tw:border tw:border-utility-pink-200',
      text: 'tw:text-utility-pink-700',
    },
  },
  {
    solid: { container: 'tw:bg-utility-purple-500', text: TW_TEXT_FG_WHITE },
    outlined: {
      container:
        'tw:bg-utility-purple-50 tw:border tw:border-utility-purple-200',
      text: 'tw:text-utility-purple-700',
    },
  },
  {
    solid: { container: 'tw:bg-utility-indigo-500', text: TW_TEXT_FG_WHITE },
    outlined: {
      container:
        'tw:bg-utility-indigo-50 tw:border tw:border-utility-indigo-200',
      text: 'tw:text-utility-indigo-700',
    },
  },
  {
    solid: { container: 'tw:bg-utility-orange-500', text: TW_TEXT_FG_WHITE },
    outlined: {
      container:
        'tw:bg-utility-orange-50 tw:border tw:border-utility-orange-200',
      text: 'tw:text-utility-orange-700',
    },
  },
  {
    // green-500 is light enough that white initials fail WCAG contrast; use a
    // dark green glyph on the solid fill instead.
    solid: {
      container: 'tw:bg-utility-green-500',
      text: 'tw:text-utility-green-900',
    },
    outlined: {
      container: 'tw:bg-utility-green-50 tw:border tw:border-utility-green-200',
      text: 'tw:text-utility-green-700',
    },
  },
  {
    solid: { container: 'tw:bg-utility-fuchsia-500', text: TW_TEXT_FG_WHITE },
    outlined: {
      container:
        'tw:bg-utility-fuchsia-50 tw:border tw:border-utility-fuchsia-200',
      text: 'tw:text-utility-fuchsia-700',
    },
  },
  {
    // yellow-500 is light enough that white initials fail WCAG contrast; use a
    // dark yellow glyph on the solid fill instead.
    solid: {
      container: 'tw:bg-utility-yellow-500',
      text: 'tw:text-utility-yellow-900',
    },
    outlined: {
      container:
        'tw:bg-utility-yellow-50 tw:border tw:border-utility-yellow-200',
      text: 'tw:text-utility-yellow-700',
    },
  },
];

/**
 * Resolves a name to a consistent theme-adapting avatar color from the
 * `utility-*` scale. The same name always maps to the same hue; the returned
 * classes flip automatically between light and dark mode.
 */
export const getAvatarColorClasses = (
  name: string,
  variant: AvatarColorVariant = 'outlined'
): AvatarColorClasses => {
  let nameValue = 0;
  for (let i = 0; i < name.length; i++) {
    nameValue += name.charCodeAt(i);
  }
  const palette = AVATAR_COLOR_CLASSES[nameValue % AVATAR_COLOR_CLASSES.length];

  return palette[variant];
};
