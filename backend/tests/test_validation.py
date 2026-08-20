"""Port of the Node validation tests (zod -> pydantic)."""

import pytest
from pydantic import ValidationError

from app.api.deps import parse_coordinates
from app.schemas import ReportBody, RoutesQuery


class TestCoordinates:
    def test_accepts_valid_coordinates(self):
        assert parse_coordinates("43.6577,-79.3802").model_dump() == {
            "latitude": 43.6577,
            "longitude": -79.3802,
        }

    @pytest.mark.parametrize("value", ["999,-79.38", "43.65,181", "garbage"])
    def test_rejects_invalid_coordinates(self, value):
        with pytest.raises(ValueError):
            parse_coordinates(value)


class TestRoutesQuery:
    def test_accepts_valid_query(self):
        result = RoutesQuery(
            start="43.6577,-79.3802",
            end="43.658112,-79.377632",
            profile="wheelchair",
            mode="most_accessible",
        )
        assert result.profile == "wheelchair"
        assert result.mode == "most_accessible"

    def test_rejects_invalid_profile(self):
        with pytest.raises(ValidationError):
            RoutesQuery(
                start="43.6577,-79.3802",
                end="43.658112,-79.377632",
                profile="jetpack",
            )


class TestReportBody:
    def test_accepts_valid_body(self):
        result = ReportBody(
            type="blocked_ramp",
            description="Ramp blocked by construction.",
            latitude=43.6577,
            longitude=-79.3802,
        )
        assert result.type == "blocked_ramp"

    def test_rejects_empty_description(self):
        with pytest.raises(ValidationError):
            ReportBody(
                type="blocked_ramp",
                description="  ",
                latitude=43.6577,
                longitude=-79.3802,
            )

    def test_rejects_out_of_range_coordinates(self):
        with pytest.raises(ValidationError):
            ReportBody(
                type="other",
                description="Something",
                latitude=200,
                longitude=-79.3802,
            )