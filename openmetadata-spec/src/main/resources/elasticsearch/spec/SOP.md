# Index Mapping Generation — Standard

Every `elasticsearch/<lang>/<entity>_index_mapping.json` (and the OpenSearch
counterpart) is **generated**, never hand-written. This document is the defined
way to build them.

## 1. A mapping file is two generated components

```
<entity>_index_mapping.json = { "settings": <settings>,
                                "mappings": { "properties": <properties> } }
```

`settings` and `properties` are each assembled by generators from a declarative
spec. The generated output must equal what ships today — `IndexCodegen` diffs
every generated Elasticsearch mapping against the committed file and **fails the
build on any drift**.

## 2. The core rule — what depends on language

| Aspect | Language-dependent? |
| --- | --- |
| A field's semantic type (`keyword` / `text` / …) | **No** |
| The document's field set and structure | **No** |
| Analyzer / normalizer *definitions* (tokenizer, filters) | **Yes** |

An entity is **one** entity. There is **one** spec per entity. Language is an
*input* to generation — never a reason to copy the spec.

> If a field is `keyword` in `en` but `text` in `jp`, that is a **bug** in the
> `jp` file, not a language variant. The generator emits the field's one true
> type for every language; the parity check then reports the bug.

## 3. Properties — field generators

`field_types.json` is the registry of **field generators**. Each entry is a
generator: given a field declaration and a language, it emits the ES field
mapping. Authors *state a type* — they never hand-write ES JSON.

```
keyword | keyword_lc | text | text_search | text_search_full
description | flattened | boolean | integer | long | float
date_epoch_second | id | fqn_hash | entity_type | …
```

Analyzer / normalizer references inside a field are **logical names**
(`om_analyzer`, `lowercase_normalizer`). The language decides what they resolve
to — the name is stable across languages.

Composite shapes (`entityReference`, `tagLabel`, `upstreamLineage`, …) are
**fragments**: reusable multi-field generators, composed with `$fragment` and
patched with `overrides`.

A per-entity spec is therefore just: `field name → field generator (+ params)`.

## 4. Settings — component generators

```
settings = { index, analysis: { normalizer, tokenizer, filter, analyzer } }
```

Each analysis component kind has a generator with one signature:

```
generate(componentName, language, params) → component JSON
```

| Generator | Produces | Language-dependent? |
| --- | --- | --- |
| NormalizerGenerator | `lowercase_normalizer` | No — defined once |
| TokenizerGenerator | `n_gram`, `edge_ngram` (params: `min/max_gram`) | No |
| FilterGenerator | `stemmer`, `word_delimiter`, … | Mostly no |
| AnalyzerGenerator | `om_analyzer`, `om_ngram`, `om_compound` | **Yes** |

A **settings profile** is language-independent and declares only *which*
components an index uses:

```json
{ "index": { "max_ngram_diff": 17 },
  "uses": { "normalizers": ["lowercase"],
            "tokenizers":  { "n_gram": { "max_gram": 20 } },
            "analyzers":   ["om_analyzer", "om_ngram", "om_compound"] } }
```

`SettingsGenerator.build(profile, language)` walks `uses`, calls each component
generator with the language, and assembles the block. The per-language
knowledge for `om_analyzer` lives in **one** place — its generator entry — never
replicated across files.

## 5. Engines

The canonical mapping is Elasticsearch-flavoured. `EngineProfile`
(`engines/<engine>.json`) derives the OpenSearch variant declaratively
(`typeRewrites` such as `flattened → flat_object`, plus structural `overlay`).
The `*IndexDoc` document class is engine- and language-independent.

## 6. The build pipeline

`mvn generate-sources` → `IndexCodegen`:

1. for each entity × language × engine — generate the mapping;
2. diff each generated Elasticsearch mapping against the committed file;
3. **fail on drift.** A failure list is the per-language **bug report**.

## 7. How to …

| Task | Action |
| --- | --- |
| Add an entity | add `entities/<entity>.json` |
| Add a field type | add one entry to `field_types.json` |
| Add a shared shape | add a file under `fragments/` |
| Add a settings profile | add a profile; reference it from the entity spec |
| Add a language | add that language's component definitions — nothing else |
| Change an analyzer | edit one component generator entry |
