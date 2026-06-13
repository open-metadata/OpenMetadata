# OpenMetadata Semantic Encoder (Fine-Tuning)

This module provides a self-supervised training pipeline to fine-tune a semantic search encoder for OpenMetadata.

## Overview
General-purpose embedding models (like `all-MiniLM-L6-v2` or OpenAI's `text-embedding-3`) are unaware of metadata semantics. They often struggle to distinguish between similar column names across unrelated tables (e.g., `order_id` in `orders` vs `session_id` in `sessions`). 

This package extracts implicit relationships from your OpenMetadata graph (lineage edges, table co-membership, glossary terms) and uses them to fine-tune a model using contrastive learning. This drastically improves Mean Reciprocal Rank (MRR) and semantic cohesion in search results.

## Usage

### 1. Extract Training Pairs
Extract synthetic positive/negative pairs from your OpenMetadata instance:
```bash
python -m metadata.ml.training_data --config <path_to_openmetadata.yaml> --output pairs.json
```

### 2. Fine-Tune the Encoder
Train `answerdotai/ModernBERT-base` (or `all-MiniLM-L6-v2`) on the generated pairs:
```bash
python -m metadata.ml.train_encoder --data pairs.json --output openmetadata-finetuned-encoder/
```

### 3. Evaluate Results
Compare the fine-tuned model against the baseline:
```bash
python -m metadata.ml.evaluate_encoder --model openmetadata-finetuned-encoder/ --data pairs.json
```

### Serving
The resulting `openmetadata-finetuned-encoder/` directory should be placed in the OpenMetadata server root. The `EmbeddingService.java` provider (using DJL) will automatically detect and load it for search indexing.
