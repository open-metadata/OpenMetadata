/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.ontology;

import java.util.Set;

/**
 * Words the ANSI dialect cannot read as a plain column or table name. Every other dialect quotes
 * every identifier, so it needs no list.
 */
final class OntologySqlReservedWords {
  /** Vendor lists of the ANSI engines: PostgreSQL 14, Redshift, Trino, Presto, Athena SELECT. */
  static final Set<String> ANSI =
      words(
          """
          aes128 aes256 all allowoverwrite alter analyse analyze and any array as asc asymmetric
          authorization auto az64 backup between binary blanksasnull both by bytedict bzip2 case cast
          check collate collation column concurrently constraint create credentials cross cube
          current_catalog current_date current_path current_role current_schema current_time
          current_timestamp current_user current_user_id deallocate default deferrable deflate defrag
          delete delta delta32k desc describe disable distinct do drop else emptyasnull enable encode
          encrypt encryption end escape except execute exists explicit extract false fetch first for
          foreign freeze from full globaldict256 globaldict64k grant group grouping gzip having identity
          ignore ilike in initially inner insert intersect interval into is isnull join json_array
          json_exists json_object json_query json_serialize json_table json_value last lateral leading
          left like limit listagg localtime localtimestamp lun luns lzo lzop minus mostly16 mostly32
          mostly8 natural new normalize not notnull null nulls of off offline offset oid old on only open
          or order outer overlaps parallel partition percent permissions pivot placing prepare primary raw
          readratio recover recursive references rejectlog resort respect restore returning right rollup
          select session_user similar skip snapshot some symmetric sysdate system table tablesample tag
          tdes text255 text32k then timestamp to top trailing trim true truncatecolumns uescape union
          unique unnest unpivot user using values variadic verbose wallet when where window with without
          """);

  private OntologySqlReservedWords() {}

  private static Set<String> words(final String list) {
    return Set.of(list.strip().split("\\s+"));
  }
}
