/**
 * Extracts the initials from a full name.
 *
 * @param name - The full name from which to extract initials.
 * @returns The initials of the provided name. If the name contains only one word,
 *          it returns the first character of that word. If the name contains two words,
 *          it returns the first character of each word.
 */
export const getInitials = (name: string) => {
    const [firstName, lastName] = name.split(" ");
    return firstName.charAt(0) + (lastName ? lastName.charAt(0) : "");
};
