"""Port of the Node OSM element-conversion tests."""

from app.services.osm import osm_elements_to_accessibility_points


def _node(id, lat, lon, tags=None):
    element = {"type": "node", "id": id, "lat": lat, "lon": lon}
    if tags:
        element["tags"] = tags
    return element


def _way(id, nodes, tags):
    return {"type": "way", "id": id, "nodes": nodes, "tags": tags}


class TestOsmElementsToAccessibilityPoints:
    def test_steps_way_becomes_stairs_at_centroid(self):
        elements = [
            _node(1, 43.6577, -79.3802),
            _node(2, 43.6578, -79.3801),
            _way(100, [1, 2], {"highway": "steps"}),
        ]
        points = osm_elements_to_accessibility_points(elements)
        assert len(points) == 1
        point = points[0]
        assert point.id == "osm-way-100"
        assert point.type == "stairs"
        assert point.stairs is True
        assert point.sourceType == "osm"
        assert abs(point.latitude - 43.65775) < 1e-9
        assert abs(point.longitude - -79.38015) < 1e-9

    def test_elevator_node(self):
        elements = [_node(50, 43.658, -79.3776, {"highway": "elevator"})]
        points = osm_elements_to_accessibility_points(elements)
        assert len(points) == 1
        assert points[0].id == "osm-node-50"
        assert points[0].type == "elevator"
        assert points[0].elevator is True

    def test_crossing_with_dropped_kerb_is_accessible(self):
        elements = [
            _node(
                60,
                43.6571,
                -79.3812,
                {
                    "highway": "crossing",
                    "crossing": "traffic_signals",
                    "kerb": "lowered",
                    "tactile_paving": "yes",
                },
            )
        ]
        points = osm_elements_to_accessibility_points(elements)
        assert len(points) == 1
        assert points[0].type == "crossing"
        assert points[0].wheelchair == "accessible"
        assert "traffic signals" in points[0].description
        assert "Dropped/level kerb" in points[0].description

    def test_steep_incline_and_rough_surface(self):
        elements = [
            _node(201, 43.6577, -79.3802),
            _node(202, 43.6578, -79.3801),
            _way(200, [201, 202], {"highway": "footway", "incline": "12%", "surface": "cobblestone"}),
        ]
        points = osm_elements_to_accessibility_points(elements)
        assert len(points) == 1
        assert points[0].incline == "steep"
        assert points[0].surface == "rough"

    def test_barrier_with_wheelchair_no_is_inaccessible(self):
        elements = [
            _node(70, 43.6575, -79.3782, {"barrier": "gate", "wheelchair": "no"})
        ]
        points = osm_elements_to_accessibility_points(elements)
        assert points[0].type == "barrier"
        assert points[0].wheelchair == "inaccessible"

    def test_ignores_elements_without_tags(self):
        elements = [
            _node(90, 43.66, -79.38, {}),
            {"type": "node", "id": 91, "lat": 43.66, "lon": -79.38},
        ]
        assert osm_elements_to_accessibility_points(elements) == []