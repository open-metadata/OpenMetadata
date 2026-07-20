package org.openmetadata.it.tests.search;

import java.util.List;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Seeds one entity type for the data-driven ranking suite ({@link SearchEntityRankingIT}). A seeder
 * knows how to create a parent container once ({@link #setup}) and then create entities into it with
 * a search token placed in exactly one field ({@link #seed}), so the ranking tests can isolate how
 * each field of that entity type's search config contributes to the score.
 *
 * <p>Placement contract — the token appears in <b>only</b> the named field; every other searchable
 * field is generic (token-free), so a query for the token isolates that field:
 *
 * <ul>
 *   <li>{@code NAME} — the entity name (token is the leading, clean sub-token).
 *   <li>{@code DISPLAY_NAME_EXACT} — displayName equals the token exactly (hits {@code
 *       displayName.keyword}, boost 20/exact).
 *   <li>{@code DISPLAY_NAME_PHRASE} — displayName contains the token in a longer phrase (hits {@code
 *       displayName}, boost 10/phrase — but not the exact keyword field).
 *   <li>{@code DESCRIPTION} — the description mentions the token (boost 2/standard).
 *   <li>{@code DISTINCTIVE} — the entity's distinctive nested field (columns / charts / tasks /
 *       queryText / synonyms / …); only when {@link #hasDistinctive()}.
 * </ul>
 *
 * {@code tier1=true} additionally tags the entity {@code Tier.Tier1} (global term boost) for the
 * text-tie ranking check.
 */
interface EntitySeeder {

  enum Placement {
    NAME,
    DISPLAY_NAME_EXACT,
    DISPLAY_NAME_PHRASE,
    DESCRIPTION,
    DISTINCTIVE
  }

  String entityType();

  String index();

  default boolean hasDistinctive() {
    return false;
  }

  /** Create the parent container (service / glossary / schema …) once; returns its FQN. */
  String setup(OpenMetadataClient client, TestNamespace ns);

  /** Create an entity with the token placed per {@code placement}; returns the indexed name. */
  String seed(
      OpenMetadataClient client,
      TestNamespace ns,
      String parent,
      String token,
      Placement placement,
      boolean tier1);

  // --- shared placement helpers so every seeder builds identical field content ---------------

  /** Unique entity name; the token is the leading clean sub-token only for {@code NAME}. */
  static String nameFor(TestNamespace ns, String token, Placement placement) {
    String lead = placement == Placement.NAME ? token : RankingSupport.uniqueTerm();
    return ns.prefix(lead + "-" + ns.uniqueShortId());
  }

  static String displayNameFor(String token, Placement placement) {
    return switch (placement) {
      case DISPLAY_NAME_EXACT -> token;
      case DISPLAY_NAME_PHRASE -> token + " reporting warehouse";
      default -> "gd " + RankingSupport.uniqueTerm();
    };
  }

  static String descriptionFor(String token, Placement placement) {
    return placement == Placement.DESCRIPTION
        ? "this asset mentions " + token + " once in prose"
        : "generic description body " + RankingSupport.uniqueTerm();
  }

  /** The token to write into the distinctive nested field, or a generic value for other placements. */
  static String distinctiveFor(String token, Placement placement) {
    return placement == Placement.DISTINCTIVE ? token : "generic_" + RankingSupport.uniqueTerm();
  }

  static List<TagLabel> tierTags(boolean tier1) {
    return tier1 ? List.of(RankingSupport.classificationTag(RankingSupport.TIER1_TAG)) : null;
  }
}
