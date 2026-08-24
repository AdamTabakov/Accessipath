"""Institutional accessibility features from public campus sources.

Source: Toronto Metropolitan University Facilities Management and Development,
"Entrances with Accessibility Features".
"""

from ..schemas import AccessibilityPoint

TMU_ACCESSIBLE_ENTRANCES_SOURCE = (
    "https://www.torontomu.ca/facilities-management-development/"
    "facilities-help-desk/accessibility-amenity-information/"
    "entrances-accessibility-features/"
)

_ENTRANCES = [
    ("10 Dundas St. E. (DSQ)", "Main entrance; cinema staff onsite during class hours; access to subway via lower level.", 43.656528, -79.380478, False, True),
    ("147 Dalhousie Street (DAL)", "Main entrance to 1st floor.", 43.657552, -79.376854, False, True),
    ("159 Dalhousie Street (MER)", "Main entrance to 1st floor.", 43.657596, -79.376856, False, True),
    ("415 Yonge Street (YNG)", "Ramp from Yonge Street sidewalk.", 43.659711, -79.382193, True, True),
    ("Architecture Building (ARC) - East", "Intercom to TMU Security; door opener is greater than 2 m from activated door; card reader/intercom greater than 2 m from door-opener.", 43.659294, -79.377783, False, True),
    ("Architecture Building (ARC) - South", "Entrance to 1st floor corridor; Blue Phone to TMU Security on pole at southeast corner of ARC.", 43.659047, -79.377897, False, True),
    ("Balzac's Accessible", "Ramp to entrance from Bond Street; available during posted business hours; doorbell on post; inner door operator is far from door.", 43.657686, -79.379045, True, True),
    ("Campus Store (BKS)", "Main entrance available during Campus Store business hours; Blue Phone to TMU Security on pole across Gould St.", 43.657597, -79.380211, False, True),
    ("Carlton Cinema (CAR)", "Main entrance, cinema staff onsite during class hours; ramp from sidewalk.", 43.661507, -79.381561, True, True),
    ("Centre for Urban Innovation (CUI) - 44 Gerrard St. E.", "Main entrance to 1st floor; interior ramp; Blue Phone to TMU Security on CUI wall between building entrances.", 43.659741, -79.379718, True, True),
    ("Centre for Urban Innovation (CUI) - North Courtyard", "Courtyard entrance to first-floor vestibule near elevator; accessed via gate from McGill St.; gate does not have an automated opener.", 43.660335, -79.379924, False, False),
    ("Civil Engineering Building - Monetary Times (MON) - East", "Main entrance to 1st floor; Blue Phone to TMU Security on pole in laneway by EPH northwest corner.", 43.659821, -79.377937, False, True),
    ("College Park (CPK) - 424 Yonge St.", "Card reader required at 2nd floor interior entrance; accessible elevator shuttle in vestibule bypasses stairs to main elevator.", 43.660268, -79.382831, False, True),
    ("Creative Innovation Studio (CIS)", "Main entrance to 1st floor.", 43.656772, -79.378630, False, True),
    ("Daphne Cockwell Health Sciences Complex (DCC) - 288 Church St.", "Main entrance to 1st floor by north atrium and elevators; intercom connects with Residence Reception Desk.", 43.657341, -79.377596, False, True),
    ("Daphne Cockwell Health Sciences Complex (DCC) - Church St. south entrance", "Entrance to south end of 1st floor by the DCC Market kiosk.", 43.656855, -79.377394, False, True),
    ("Daphne Cockwell Health Sciences Complex (DCC) - West laneway", "Laneway entrance to 1st floor north atrium; Blue Phone to TMU Security on DCC wall at south end of laneway; TMU Security desk in atrium.", 43.657269, -79.378025, False, True),
    ("George Vari Engineering and Computing Centre (ENG) - 245 Church St.", "Main entrance to 1st floor; door-opener and card reader are greater than 1 m apart.", 43.657684, -79.377480, False, True),
    ("George Vari Engineering and Computing Centre (ENG) - North Church/Gould", "Entrance to 1st floor; ramp from Gould St. sidewalk east of Church St.", 43.658112, -79.377632, True, True),
    ("Eric Palin Hall (EPH) - West Pitman Quad", "Entrance to 1st floor vestibule from the Pitman Quad; intercom to TMU Security; no accessible route from Gerrard St.; alternate entrance via SHE using elevator to 2nd floor.", 43.659338, -79.377592, False, True),
    ("Heidelberg Centre (HEI)", "Main entrance to 1st floor; Blue Phone on wall in laneway north of HEI attached to southwest corner of SCC.", 43.657588, -79.378699, False, True),
    ("Image Arts (IMA) - 122 Bond St.", "Main entrance to 1st floor; ramp to entrance from Bond St.", 43.657589, -79.379017, True, True),
    ("Image Arts (IMA) - South laneway", "Entrance to 1st floor at southeast corner near laneway; entrance to student lounge area.", 43.657135, -79.378845, False, True),
    ("International Living / Learning Centre (ILC) - 133 Mutual St.", "Ramp from Mutual St. sidewalk; intercom is high on wall and connects with reception desk.", 43.658592, -79.376083, True, True),
    ("Jorgenson Hall (JOR) - 380 Victoria St.", "Main entrance to 1st floor; two ramps from Gerrard St. and Nelson Mandela Walk; intercom on bollard with card reader; Blue Phone pole by bottom of ramp.", 43.658911, -79.380779, True, True),
    ("Kerr Hall East (KHE) - 340 Church St.", "Main entrance to 1st floor; ramp from sidewalk at Gerrard St. and Church St.; intercom to TMU Security.", 43.659546, -79.378616, True, True),
    ("Kerr Hall East (KHE) - Quad north", "Quad entrance to 1st floor stairwell and corridor; intercom to TMU Security on bollard with card reader.", 43.659254, -79.378801, False, True),
    ("Kerr Hall North (KHN) - 43 Gerrard St. E.", "Quad entrance to 1st floor stairwell and corridor; intercom to TMU Security on bollard with card reader.", 43.659355, -79.379500, False, True),
    ("Kerr Hall North (KHN) - Quad East", "Quad entrance to 1st floor stairwell and corridor; intercom to TMU Security on bollard with card reader.", 43.659353, -79.379138, False, True),
    ("Kerr Hall North (KHN) - Quad West", "Quad entrance to 1st floor; ramp to door is steep and curved and may not be suitable for all; Blue Phone by Quad path near north archway.", 43.659073, -79.380043, True, True),
    ("Kerr Hall North/West (KHN) - 31 Gerrard St. E.", "Entrance to 1st floor; intercom to TMU Security; RAC accessible entrance via elevator to lower level; RAC interior entrance has additional card-reader and intercom.", 43.659290, -79.380470, False, True),
    ("Kerr Hall West (KHW) - Nelson Mandela Walk", "Centre Nelson Mandela Walk to 1st floor; ramp from Nelson Mandela Walk; intercom to TMU Security.", 43.658542, -79.380288, True, True),
    ("Kerr Hall West (KHW) - 379 Victoria St.", "North entrance from Nelson Mandela Walk to 1st floor; ramp from Nelson Mandela Walk; inner door is not barrier-free if closed; use 31 Gerrard St. E. entrance as alternate barrier-free route.", 43.659001, -79.380478, True, True),
    ("Library Building (LIB) - 350 Victoria St.", "Lower terrace entrance to Lower Ground floor; ramp via Gould Plaza just west of Nelson Mandela Walk; intercom to TMU Security.", 43.657926, -79.380313, True, True),
    ("MaRS Building (MRS) - 661 University Ave.", "Entrance to 1st floor during posted business hours; access to subway via concourse level.", 43.659526, -79.389871, False, True),
    ("Mattamy Athletic Centre (MAC) - 50 Carlton Street", "Main entrance to 1st floor; elevators at west end of lobby.", 43.661838, -79.380065, False, True),
    ("Oakham House (OAK) - 63 Gould St.", "Main entrance; ramp from Gould St.", 43.658006, -79.378138, True, True),
    ("Paintbox (PTB) - 563 Dundas St. E.", "Entrance to elevator lobby.", 43.660091, -79.362518, False, True),
    ("Parking Garage (PKG) - 300 Victoria St.", "Main entrance to elevator vestibule; intercom to TMU Security; door-opener is far from card reader and intercom.", 43.657270, -79.380074, False, True),
    ("Pitman Hall (PIT) - 160 Mutual St.", "Main entrance.", 43.659273, -79.376828, False, True),
    ("Pitman Hall (PIT) - West Pitman Quad", "Entrance to 1st floor from Pitman Quad; Blue Phone to TMU Security on pole at southeast corner of ARC.", 43.659235, -79.377061, False, True),
    ("Recreation and Athletics Centre Accessible (RAC) - via KHN 31 Gerrard St. E.", "Entrance to 1st floor KHN; intercom to TMU Security; RAC accessible entrance via elevator to Lower Ground floor; RAC interior entrance has additional card-reader and intercom.", 43.658401, -79.379189, False, True),
    ("Rogers Communications Centre (RCC) - 80 Gould St.", "Main entrance south to 1st floor; ramp from sidewalk west of entrance close to Church St. by the pillar; intercom to TMU Security.", 43.658542, -79.377328, True, True),
    ("Rogers Communications Centre (RCC) - North", "Main entrance north to 1st floor; entrance from Pitman Quad; intercom to TMU Security.", 43.658615, -79.377350, False, True),
    ("Rogers Communications Centre (RCC) - East Mutual St. staff entrance", "Staff entrance with limited card access; intercom goes to reception; entrance to elevator vestibule; alternate elevator to 3rd floor through dean's office with prior arrangements.", 43.658787, -79.376625, False, True),
    ("Sally Horsfall Eaton Centre (SHE) - 99 Gerrard St. E.", "Main entrance to elevator vestibule; intercom to TMU Security; intercom is greater than 3 m from card reader and door-opener to left of doors.", 43.660027, -79.377144, False, True),
    ("School of Interior Design (SID) - West laneway", "Entrance to 1st floor via laneway alongside HEI; ramp begins along HEI south wall; intercom/Blue Phone to TMU Security on wall next to entrance.", 43.657501, -79.378159, True, True),
    ("South Bond Building (SBB) - 105 Bond Street", "Main entrance to 1st floor; sidewalk-level door; interior ramp.", 43.656723, -79.378380, True, True),
    ("Student Campus Centre (SCC) - 55 Gould St.", "Main entrance to 1st floor.", 43.657949, -79.378402, False, True),
    ("Student Campus Centre (SCC) - West via Bond St.", "Entrance to 1st floor from Bond St. and O'Keefe House lawn; Blue Phone to TMU Security; door operator is greater than 2 m from card reader.", 43.657715, -79.378311, False, True),
    ("Student Learning Centre (SLC) - 341 Yonge St.", "Main entrance; ramp from sidewalk on Gould St.; elevator available to main entrance via southeast entrance by O'Keefe Lane.", 43.657558, -79.381203, True, True),
    ("Student Learning Centre (SLC) - Gould/O'Keefe Lane", "Entrance to vestibule and elevator at Gould St. and O'Keefe Lane.", 43.657661, -79.380844, False, True),
    ("Performance - Student Learning Centre (SLC) - 345 Yonge St.", "Yonge St. entrance to School of Performance and Box Office on ground floor; entrance and vestibule have door operators; elevator available to mezzanine and Lower Level.", 43.657677, -79.381348, False, True),
    ("Ted Rogers School of Management (TRS) - 55 Dundas St. W.", "Main entrance at 1st floor to elevator lobby.", 43.655803, -79.382657, False, True),
    ("The Chang School (CED) - 297 Victoria St.", "Main entrance to 1st floor with motion-sensor doors during posted business hours; sloped sidewalk/ramp to automated doors; Blue Phone to TMU Security.", 43.657148, -79.379699, True, True),
    ("The Chang School (CED) - North Lake Devo", "Lake Devo entrance under overhang to the 1st floor; intercom to TMU Security.", 43.657342, -79.379670, False, True),
    ("The Image Centre (IMC) - 33 Gould St.", "Main entrance to 1st floor available during posted gallery hours; Blue Phone pole to TMU Security across Gould St.", 43.657711, -79.379471, False, True),
    ("The Theatre (KHN) - 43 Gerrard St. E.", "The Theatre entrance on west side of archway; operational only during public performances or when staff onsite.", 43.659344, -79.379684, False, True),
    ("Toronto Eaton Centre (TEC) - Galleria Offices", "Entrance from Yonge St. near Roots; elevator access to Level 4 is via ramp by Indigo Books, elevator near Sephora to P1, then bridge from Parking toward Indigo Books.", 43.654738, -79.380557, True, True),
    ("Victoria Building (VIC) - 285 Victoria St.", "Main entrance to 1st floor; intercom to TMU Security.", 43.656999, -79.379730, False, True),
    ("Victoria Building (VIC) - East laneway", "Laneway entrance to 1st floor; Blue Phone to TMU Security on wall next to entrance.", 43.657070, -79.379356, False, True),
    ("Yonge-Dundas Intersection (YDI) - 1 Dundas St. W.", "Entrance to building lobby; concierge desk; Cadillac Fairview card required to access elevators to TMU 16th floor.", 43.656025, -79.381557, False, True),
]


INSTITUTIONAL_ACCESSIBILITY_POINTS = [
    AccessibilityPoint(
        id=f"tmu-accessible-entrance-{index + 1}",
        buildingName=name,
        type="entrance",
        latitude=lat,
        longitude=lon,
        wheelchair="accessible",
        ramp=has_ramp,
        automaticDoor=has_automatic_door,
        sourceType="institutional",
        sourceUrl=TMU_ACCESSIBLE_ENTRANCES_SOURCE,
        description=description,
        confidence=0.95,
    )
    for index, (name, description, lat, lon, has_ramp, has_automatic_door) in enumerate(_ENTRANCES)
]
