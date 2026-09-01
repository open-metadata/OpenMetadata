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
 * Generates consistent background / text / border HSL colors from a name string.
 * Uses a simple djb2-style hash so the same name always resolves to the same hue.
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
    background: `hsl(${hue}, 100%, 89%)`,
    textColor: `hsl(${hue}, 70%, 40%)`,
    border: `hsl(${hue}, 70%, 75%)`,
  };
};
