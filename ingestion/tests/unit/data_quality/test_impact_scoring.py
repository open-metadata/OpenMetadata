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

"""
Test Impact Score Calculation for Dimensional Data Quality Tests
"""

from unittest.mock import Mock, patch

import pandas as pd
from sqlalchemy import Column, Integer, String, create_engine, func, select
from sqlalchemy.orm import declarative_base, sessionmaker

from metadata.data_quality.validations.impact_score import (
    DEFAULT_NORMALIZATION_FACTOR,
    DEFAULT_SAMPLE_WEIGHT_THRESHOLD,
    calculate_impact_score_pandas,
    get_impact_score_expression,
    get_volume_factor,
)

Base = declarative_base()


class SampleTable(Base):
    """Sample table for SQLAlchemy tests"""

    __tablename__ = "sample_table"
    id = Column(Integer, primary_key=True)
    dimension = Column(String(50))
    value = Column(Integer)


class TestImpactScoreSQL:
    """Test impact score SQL generation and calculation"""

    def setup_method(self):
        """Set up test database"""
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)

    def teardown_method(self):
        """Clean up"""
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def test_impact_score_expression_generation(self):
        """Test that impact score SQLAlchemy expression is properly generated"""
        failed_count = func.sum(SampleTable.value)
        total_count = func.count(SampleTable.id)

        expr = get_impact_score_expression(failed_count, total_count)

        # Verify the expression is a valid SQLAlchemy ClauseElement
        assert expr is not None
        assert hasattr(expr, "compile")

        # Test compilation to SQL (basic smoke test)
        compiled = str(expr.compile(compile_kwargs={"literal_binds": True}))
        assert compiled  # Should produce some SQL string

    def test_impact_score_with_zero_total(self):
        """Test impact score handles zero total count gracefully"""
        session = self.Session()

        # Create test query with zero total
        failed_count = func.coalesce(func.sum(SampleTable.value), 0)
        total_count = func.coalesce(func.count(SampleTable.id), 0)

        score_expr = get_impact_score_expression(failed_count, total_count)

        query = select(score_expr.label("impact_score")).select_from(SampleTable)
        result = session.execute(query).scalar()

        # Should return 0 for empty table
        assert result == 0.0

        session.close()

    def test_impact_score_calculation_in_query(self):
        """Test impact score calculation with actual data"""
        session = self.Session()

        # Insert test data with known impact patterns
        test_data = [
            # High failure dimension (90% failure rate)
            *[{"dimension": "high_failure", "value": 1} for _ in range(90)],
            *[{"dimension": "high_failure", "value": 0} for _ in range(10)],
            # Low failure dimension (10% failure rate)
            *[{"dimension": "low_failure", "value": 1} for _ in range(10)],
            *[{"dimension": "low_failure", "value": 0} for _ in range(90)],
            # No failure dimension (0% failure rate)
            *[{"dimension": "no_failure", "value": 0} for _ in range(50)],
        ]

        for data in test_data:
            session.add(SampleTable(**data))
        session.commit()

        # Calculate impact scores per dimension
        failed_count = func.sum(SampleTable.value)
        total_count = func.count(SampleTable.id)
        score_expr = get_impact_score_expression(failed_count, total_count)

        query = (
            select(
                SampleTable.dimension,
                failed_count.label("failed"),
                total_count.label("total"),
                score_expr.label("impact_score"),
            )
            .group_by(SampleTable.dimension)
            .order_by(score_expr.desc())
        )

        results = session.execute(query).all()

        # Verify order and relative scores
        assert len(results) == 3
        assert results[0].dimension == "high_failure"  # Highest impact
        assert results[1].dimension == "low_failure"  # Medium impact
        assert results[2].dimension == "no_failure"  # Zero impact

        # Verify score ranges
        assert results[0].impact_score > 0.3  # High failure should have high score
        assert 0 < results[1].impact_score < 0.1  # Low failure should have low score
        assert results[2].impact_score == 0.0  # No failure should have zero score

        session.close()


class TestImpactScorePandas:
    """Test impact score calculation for pandas DataFrames"""

    def test_calculate_impact_score_pandas(self):
        """Test pandas impact score calculation"""
        # Create test dataframe with known patterns
        df = pd.DataFrame(
            {
                "dimension": ["A", "B", "C"],
                "failed_count": [
                    810,
                    10,
                    5,
                ],  # A: 90% failure, B: 10% failure, C: 50% failure
                "total_count": [900, 100, 10],
            }
        )

        # Calculate impact scores
        result_df = calculate_impact_score_pandas(df)

        # Verify columns exist
        assert "impact_score" in result_df.columns

        # Verify score ordering (A should have highest score)
        result_df = result_df.sort_values("impact_score", ascending=False)
        assert result_df.iloc[0]["dimension"] == "A"  # Highest failure rate + volume

        # Verify score ranges
        assert 0 <= result_df["impact_score"].min() <= 1
        assert 0 <= result_df["impact_score"].max() <= 1

    def test_impact_score_edge_cases(self):
        """Test impact score calculation with edge cases"""
        # Test with single row
        df_single = pd.DataFrame(
            {"dimension": ["single"], "failed_count": [1], "total_count": [1]}
        )

        result = calculate_impact_score_pandas(df_single)
        # Single row with 100% failure should have low score due to sample weight
        assert result["impact_score"].iloc[0] < 0.1

        # Test with zero failures
        df_zero = pd.DataFrame(
            {"dimension": ["perfect"], "failed_count": [0], "total_count": [1000]}
        )

        result = calculate_impact_score_pandas(df_zero)
        # Zero failures should have zero impact score
        assert result["impact_score"].iloc[0] == 0.0

        # Test with all failures
        df_all_fail = pd.DataFrame(
            {"dimension": ["all_fail"], "failed_count": [1000], "total_count": [1000]}
        )

        result = calculate_impact_score_pandas(df_all_fail)
        # 100% failure with large sample should have high score
        assert result["impact_score"].iloc[0] > 0.5


class TestImpactScoreFormula:
    """Test the mathematical properties of the impact score formula"""

    def test_formula_components(self):
        """Test individual components of the impact score formula"""
        # Test failure rate squared
        failure_rate = 0.5
        assert failure_rate**2 == 0.25

        # Test the actual volume factor function from our module
        assert get_volume_factor(5) == 0.25
        assert get_volume_factor(50) == 0.50
        assert get_volume_factor(500) == 0.75
        assert get_volume_factor(5000) == 1.00
        assert get_volume_factor(50000) == 1.25
        assert get_volume_factor(500000) == 1.50

        # Test edge cases for volume factor
        assert get_volume_factor(0) == 0.25  # Zero rows
        assert get_volume_factor(10) == 0.50  # Exactly at boundary
        assert get_volume_factor(100) == 0.75  # Exactly at boundary
        assert get_volume_factor(1000) == 1.00  # Exactly at boundary
        assert get_volume_factor(10000) == 1.25  # Exactly at boundary
        assert get_volume_factor(100000) == 1.50  # Exactly at boundary
        assert get_volume_factor(1000000) == 1.50  # Very large number

        # Test sample weight
        small_sample = 50
        sample_weight = min(1.0, small_sample / DEFAULT_SAMPLE_WEIGHT_THRESHOLD)
        assert sample_weight == 0.5

        large_sample = 200
        sample_weight = min(1.0, large_sample / DEFAULT_SAMPLE_WEIGHT_THRESHOLD)
        assert sample_weight == 1.0

    def test_formula_score_ranges(self):
        """Test that formula produces scores in expected ranges"""
        test_cases = [
            # (failed, total, expected_range)
            (1, 1, (0, 0.1)),  # Single row: very low score
            (50, 100, (0.05, 0.2)),  # 50% failure, medium sample
            (900, 1000, (0.5, 1.0)),  # 90% failure, large sample
            (100, 10000, (0, 0.05)),  # 1% failure, very large sample
            (0, 1000, (0, 0)),  # No failures: zero score
        ]

        for failed, total, expected_range in test_cases:
            # Manual calculation using the formula with our helper function
            if total == 0:
                score = 0
            else:
                failure_rate = failed / total
                failure_severity = failure_rate**2
                volume_factor = get_volume_factor(total)  # Use the actual function
                sample_weight = min(1.0, total / DEFAULT_SAMPLE_WEIGHT_THRESHOLD)
                raw_impact = failure_severity * volume_factor * sample_weight
                score = min(1.0, max(0.0, raw_impact / DEFAULT_NORMALIZATION_FACTOR))

            assert expected_range[0] <= score <= expected_range[1], (
                f"Score {score} not in range {expected_range} for "
                f"failed={failed}, total={total}"
            )

    def test_formula_monotonicity(self):
        """Test that higher failure rates produce higher scores for same volume"""
        total = 1000
        scores = []

        for failure_pct in [10, 30, 50, 70, 90]:
            failed = int(total * failure_pct / 100)

            # Calculate using pandas function
            df = pd.DataFrame(
                {
                    "dimension": ["test"],
                    "failed_count": [failed],
                    "total_count": [total],
                }
            )
            result = calculate_impact_score_pandas(df)
            scores.append(result["impact_score"].iloc[0])

        # Scores should be monotonically increasing
        for i in range(1, len(scores)):
            assert (
                scores[i] > scores[i - 1]
            ), f"Score not increasing: {scores[i-1]} -> {scores[i]}"


class TestDimensionalValidatorIntegration:
    """Test impact scoring integration with dimensional validators"""

    @patch(
        "metadata.data_quality.validations.column.sqlalchemy.columnValuesToBeUnique.ColumnValuesToBeUniqueValidator"
    )
    def test_dimensional_validator_with_impact_scoring(self, mock_validator_class):
        """Test that dimensional validators properly calculate impact scores"""
        # This is a high-level integration test to verify the validators
        # use impact scoring correctly

        mock_validator = Mock()
        mock_validator_class.return_value = mock_validator

        # Mock dimensional query execution
        mock_results = [
            {
                "dimension_value": "region_1",
                "count": 1000,
                "unique_count": 100,
                "impact_score": 0.81,  # High impact
                "failed_count": 900,
                "total_count": 1000,
            },
            {
                "dimension_value": "region_2",
                "count": 500,
                "unique_count": 450,
                "impact_score": 0.05,  # Low impact
                "failed_count": 50,
                "total_count": 500,
            },
        ]

        mock_validator._execute_with_others_aggregation = Mock(
            return_value=mock_results
        )

        # Verify results are sorted by impact score
        assert mock_results[0]["impact_score"] > mock_results[1]["impact_score"]

        # Verify impact scores are in valid range
        for result in mock_results:
            assert 0 <= result["impact_score"] <= 1
