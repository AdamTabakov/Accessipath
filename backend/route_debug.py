import asyncio
from app.services.osm import fetch_corridor_data
from app.controllers.routing import get_candidate_routes, institutional_points_near
from app.schemas import Coordinates, ProfilePreferences
from app.services.scoring import build_evidence
from collections import Counter

async def main():
    # ROM to Union
    start = Coordinates(latitude=43.6505, longitude=-79.3768)  # ROM
    end = Coordinates(latitude=43.6426, longitude=-79.3871)    # Union Station

    print('=== ROM to Union Station ===')
    corridor = await fetch_corridor_data(start, end)
    print(f'Corridor points: {len(corridor["points"])}')
    types = Counter(p.type for p in corridor['points'])
    print(f'Types: {dict(types)}')
    
    inst_points = institutional_points_near(start, end)
    print(f'Institutional points: {len(inst_points)}')
    
    profile = ProfilePreferences(mobilityProfile='wheelchair', avoidStairs=True, preferRamps=True, preferElevators=True, maxSlope='moderate', preferSmoothSurface=True, maxWalkDistanceMeters=2000)
    
    result = await get_candidate_routes(start, end, corridor['ways'])
    print(f'Candidate routes: {len(result["routes"])}')
    
    if result['routes']:
        route = result['routes'][0]
        evidence_result = build_evidence(route, corridor['points'] + inst_points, profile)
        print(f'Evidence items: {len(evidence_result.evidence)}')
        print(f'Unknown sections: {evidence_result.factors.unknownSections}')
        print(f'Known samples: {evidence_result.known_samples}/{evidence_result.total_samples}')
        
        ev_types = Counter(e.type for e in evidence_result.evidence)
        print(f'Evidence types: {dict(ev_types)}')
        
        from app.schemas import AccessibilityStatus
        statuses = Counter(e.status for e in evidence_result.evidence)
        print(f'Statuses: {dict(statuses)}')
    
    # Now Union to ROM
    print('\n=== Union to ROM ===')
    start2 = Coordinates(latitude=43.6426, longitude=-79.3871)  # Union Station
    end2 = Coordinates(latitude=43.6505, longitude=-79.3768)    # ROM
    
    corridor2 = await fetch_corridor_data(start2, end2)
    print(f'Corridor points: {len(corridor2["points"])}')
    types2 = Counter(p.type for p in corridor2['points'])
    print(f'Types: {dict(types2)}')
    
    inst_points2 = institutional_points_near(start2, end2)
    print(f'Institutional points: {len(inst_points2)}')
    
    profile = ProfilePreferences(mobilityProfile='wheelchair', avoidStairs=True, preferRamps=True, preferElevators=True, maxSlope='moderate', preferSmoothSurface=True, maxWalkDistanceMeters=2000)
    
    result2 = await get_candidate_routes(start2, end2, corridor2['ways'])
    print(f'Candidate routes: {len(result2["routes"])}')
    
    if result2['routes']:
        route = result2['routes'][0]
        evidence_result = build_evidence(route, corridor2['points'] + inst_points2, profile)
        print(f'Evidence items: {len(evidence_result.evidence)}')
        print(f'Unknown sections: {evidence_result.factors.unknownSections}')
        print(f'Known samples: {evidence_result.known_samples}/{evidence_result.total_samples}')
        
        ev_types = Counter(e.type for e in evidence_result.evidence)
        print(f'Evidence types: {dict(ev_types)}')
        
        from app.schemas import AccessibilityStatus
        statuses = Counter(e.status for e in evidence_result.evidence)
        print(f'Statuses: {dict(statuses)}')

asyncio.run(main())