---
title: votes
slug: /main-concepts/metadata-standard/schemas/type/votes
---

# Votes

*This schema defines the Votes for a Data Asset.*

## Properties

- **`upVotes`** *(integer)*: Total up-votes the entity has. Default: `0`.
- **`downVotes`** *(integer)*: Total down-votes the entity has. Default: `0`.
- **`upVoters`**: List of all the Users who upVoted. Refer to *./entityReferenceList.json#/definitions/entityReferenceList*.
- **`downVoters`**: List of all the Users who downVoted. Refer to *./entityReferenceList.json#/definitions/entityReferenceList*.
## Definitions

- **`voteType`** *(string)*: Vote Type. Must be one of: `['votedUp', 'votedDown', 'unVoted']`. Default: `unVoted`.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
