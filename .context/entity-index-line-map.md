# Entity Index Line-Map (generated)

| Entity | Dimension | Rung | Elasticsearch | OpenSearch |
|--------|-----------|------|---------------|------------|
| table | description.size | 1KB | OK | OK |
| table | description.size | 1MB | OK | OK |
| table | description.size | 16MB | OK | OK |
| table | tags.count | 10 | OK | OK |
| table | tags.count | 1k | OK | OK |
| table | tags.count | 50k | OK | OK |
| table | owners.count | 50 | OK | OK |
| table | owners.count | 9k | OK | OK |
| table | owners.count | 12k | REJECT_NESTED | REJECT_NESTED |
| table | followers.count | 100 | OK | OK |
| table | followers.count | 50k | OK | OK |
| table | customProperties.breadth | 100 | OK | OK |
| table | customProperties.breadth | 2k | OK | OK |
| table | keyword.overIgnoreAbove | 300chars | DEGRADED_UNSEARCHABLE | DEGRADED_UNSEARCHABLE |
| table | columns.count | 100 | OK | OK |
| table | columns.count | 1k | OK | OK |
| table | columns.count | 10k | OK | OK |
| table | columns.count | 100k | OK | OK |
| table | column.depth | 20 | OK | OK |
| table | column.depth | 25 | OK | OK |
