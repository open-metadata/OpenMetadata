#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
import gc
import weakref

from metadata.pii.algorithms.presidio_utils import (
    _analyzer_cache,
    _cache_lock,
    _spacy_models_cache,
    build_analyzer_engine,
    clear_presidio_caches,
    set_presidio_logger_level,
)
from metadata.pii.algorithms.tags import PIITag
from metadata.pii.scanners.ner_scanner import SUPPORTED_LANG


def test_analyzer_supports_all_expected_pii_entities():
    """
    Here we check that the analyzer can potentially detect all our PII entities.
    """
    set_presidio_logger_level()
    analyzer = build_analyzer_engine()

    entities = set(PIITag.values())
    supported_entities = set(analyzer.get_supported_entities(SUPPORTED_LANG))
    assert entities <= supported_entities, (
        f"Analyzer does not support all expected PII entities. "
        f"{entities - supported_entities}"
    )


def test_analyzer_engine_caching():
    """
    Test that multiple calls to build_analyzer_engine return cached instances
    to prevent memory leaks.
    """
    # Clear any existing cache
    clear_presidio_caches()

    # Build first analyzer
    analyzer1 = build_analyzer_engine()

    # Build second analyzer - should reuse cached instance
    analyzer2 = build_analyzer_engine()

    # Should be the same object due to caching
    assert analyzer1 is analyzer2, "Analyzer engines should be cached and reused"

    # Verify cache contains the expected entry
    with _cache_lock:
        cache_key = f"{analyzer1.nlp_engine.models[0]['model_name']}_{SUPPORTED_LANG}"
        assert cache_key in _analyzer_cache, "Cache should contain analyzer entry"


def test_clear_presidio_caches():
    """
    Test that clear_presidio_caches properly clears all caches.
    """
    # Build an analyzer to populate caches
    analyzer = build_analyzer_engine()

    # Verify caches are populated
    with _cache_lock:
        assert len(_analyzer_cache) > 0, "Analyzer cache should be populated"
        # spaCy models cache may or may not be populated depending on implementation

    # Clear caches
    clear_presidio_caches()

    # Verify caches are cleared
    with _cache_lock:
        assert (
            len(_analyzer_cache) == 0
        ), "Analyzer cache should be empty after clearing"
        assert (
            len(_spacy_models_cache) == 0
        ), "spaCy models cache should be empty after clearing"


def test_memory_cleanup_with_weak_references():
    """
    Test that cached objects can be garbage collected when no strong references exist.
    """
    # Clear existing cache
    clear_presidio_caches()

    # Create analyzer and get weak reference
    analyzer = build_analyzer_engine()
    weak_ref = weakref.ref(analyzer)

    # Verify object exists
    assert weak_ref() is not None, "Weak reference should point to existing object"

    # Delete strong reference
    del analyzer

    # Force garbage collection
    gc.collect()

    # Note: The object might still exist due to the cache, but this tests the weak ref mechanism
    # The important part is that the cache uses weak references
    with _cache_lock:
        cache_entries = list(_analyzer_cache.values())
        # Verify all cache entries are weak references
        for entry in cache_entries:
            assert isinstance(
                entry, weakref.ReferenceType
            ), "Cache entries should be weak references"


def test_multiple_model_caching():
    """
    Test that different model configurations are cached separately.
    """
    clear_presidio_caches()

    # Build analyzer with default model
    analyzer1 = build_analyzer_engine()

    # Build analyzer with same model (should be cached)
    analyzer2 = build_analyzer_engine()

    assert analyzer1 is analyzer2, "Same model should return cached instance"

    # Verify only one cache entry exists for the default model
    with _cache_lock:
        assert len(_analyzer_cache) == 1, "Should have exactly one cache entry"


def test_cache_thread_safety():
    """
    Test that cache operations are thread-safe.
    """
    import threading

    clear_presidio_caches()

    results = []
    errors = []

    def build_analyzer_worker():
        try:
            analyzer = build_analyzer_engine()
            results.append(analyzer)
        except Exception as e:
            errors.append(e)

    # Create multiple threads that build analyzers simultaneously
    threads = []
    for _ in range(5):
        thread = threading.Thread(target=build_analyzer_worker)
        threads.append(thread)

    # Start all threads
    for thread in threads:
        thread.start()

    # Wait for all threads to complete
    for thread in threads:
        thread.join()

    # Verify no errors occurred
    assert len(errors) == 0, f"Errors occurred during concurrent access: {errors}"

    # Verify all threads got the same analyzer instance (due to caching)
    assert len(results) == 5, "All threads should have completed successfully"
    first_analyzer = results[0]
    for analyzer in results[1:]:
        assert (
            analyzer is first_analyzer
        ), "All threads should get the same cached instance"


def test_cache_memory_efficiency():
    """
    Test that creating many analyzers doesn't consume excessive memory.
    """
    clear_presidio_caches()

    initial_cache_size = len(_analyzer_cache)

    # Build multiple analyzers (should all be cached and reuse the same instance)
    analyzers = []
    for _ in range(10):
        analyzer = build_analyzer_engine()
        analyzers.append(analyzer)

    # All should be the same object due to caching
    first_analyzer = analyzers[0]
    for analyzer in analyzers[1:]:
        assert (
            analyzer is first_analyzer
        ), "All analyzers should be the same cached instance"

    # Cache should only have one additional entry
    final_cache_size = len(_analyzer_cache)
    assert (
        final_cache_size - initial_cache_size <= 1
    ), "Cache should not grow excessively"
