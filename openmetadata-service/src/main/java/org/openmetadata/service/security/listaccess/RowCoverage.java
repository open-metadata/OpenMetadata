package org.openmetadata.service.security.listaccess;

import static org.openmetadata.service.security.listaccess.RowPredicate.ApproxReason.TAGS;
import static org.openmetadata.service.security.listaccess.RowPredicate.ApproxReason.TYPE_NOT_COVERED;
import static org.openmetadata.service.security.listaccess.RowPredicate.FALSE;
import static org.openmetadata.service.security.listaccess.RowPredicate.TRUE;
import static org.openmetadata.service.security.listaccess.RowPredicate.unknown;

import org.openmetadata.service.security.listaccess.RowPredicate.And;
import org.openmetadata.service.security.listaccess.RowPredicate.Approx;
import org.openmetadata.service.security.listaccess.RowPredicate.Cond;
import org.openmetadata.service.security.listaccess.RowPredicate.Const;
import org.openmetadata.service.security.listaccess.RowPredicate.InDomains;
import org.openmetadata.service.security.listaccess.RowPredicate.NoDomain;
import org.openmetadata.service.security.listaccess.RowPredicate.NoOwner;
import org.openmetadata.service.security.listaccess.RowPredicate.Not;
import org.openmetadata.service.security.listaccess.RowPredicate.Or;
import org.openmetadata.service.security.listaccess.RowPredicate.OwnerMatch;
import org.openmetadata.service.security.listaccess.RowPredicate.ReviewedBy;
import org.openmetadata.service.security.listaccess.RowPredicate.TaggedAll;
import org.openmetadata.service.security.listaccess.RowPredicate.TaggedAny;
import org.openmetadata.service.security.listaccess.ValueSource.Absent;
import org.openmetadata.service.security.listaccess.ValueSource.Uncovered;

/**
 * Fits a plan to what SQL computes for the listed type. A leaf over a value the type does not have
 * becomes the constant that value gives, and a leaf over a value SQL does not compute becomes an
 * approximation, which makes the plan inexact and keeps the per-row check.
 */
final class RowCoverage {
  private RowCoverage() {}

  static RowPredicate bound(RowPredicate predicate, RowStorage storage) {
    return switch (predicate) {
      case And and -> RowPredicate.and(and.all().stream().map(p -> bound(p, storage)).toList());
      case Or or -> RowPredicate.or(or.any().stream().map(p -> bound(p, storage)).toList());
      case Not not -> RowPredicate.not(bound(not.negated(), storage));
      case Approx approx -> new Approx(
          bound(approx.lower(), storage), bound(approx.upper(), storage), approx.reason());
      case Const constant -> constant;
      case Cond leaf -> leaf(leaf, storage);
    };
  }

  private static RowPredicate leaf(Cond leaf, RowStorage storage) {
    return switch (leaf) {
      case OwnerMatch owned -> covered(storage.owners(), owned, FALSE);
      case NoOwner unowned -> covered(storage.owners(), unowned, TRUE);
      case InDomains inDomains -> covered(storage.domains(), inDomains, FALSE);
      case NoDomain noDomain -> covered(storage.domains(), noDomain, TRUE);
      case ReviewedBy reviewed -> covered(storage.reviewers(), reviewed, FALSE);
      case TaggedAny tagged -> tags(storage);
      case TaggedAll tagged -> tags(storage);
    };
  }

  /**
   * Tags a condition reads include tags derived from glossary terms, tags inherited while
   * propagation is on, and the tags of inline children such as columns, none of which SQL computes
   * yet. A type without tags has none, so no tag condition holds.
   */
  private static RowPredicate tags(RowStorage storage) {
    return storage.supportsTags() ? unknown(TAGS) : FALSE;
  }

  private static RowPredicate covered(ValueSource source, Cond leaf, RowPredicate whenAbsent) {
    return switch (source) {
      case Absent ignored -> whenAbsent;
      case Uncovered ignored -> unknown(TYPE_NOT_COVERED);
      default -> leaf;
    };
  }
}
