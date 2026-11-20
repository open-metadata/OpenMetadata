package org.openmetadata.service.security.listaccess;

/** How SQL finds one effective value, such as the owners, of a listed type's rows. */
public sealed interface ValueSource {
  /** The row's own relationships, with nothing inherited. */
  record Own() implements ValueSource {}

  /** The row is its own value: a user owns itself, and a domain is its own domain. */
  record Self() implements ValueSource {}

  /** The type has no such field, so the value is always empty. */
  record Absent() implements ValueSource {}

  /** SQL does not compute this value for this type, so conditions on it are approximated. */
  record Uncovered() implements ValueSource {}

  /**
   * The row's own value or, when it has none, the effective value of its parent, the row of {@code
   * parent} whose hash is the first {@code parentSegments} segments of the row's fqnHash. The
   * nearest level with a value wins, as {@code inheritOwners} and {@code inheritDomains} decide.
   */
  record Inherited(RowStorage parent, int parentSegments) implements ValueSource {}
}
