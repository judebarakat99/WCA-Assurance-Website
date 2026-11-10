# Map geometry

`sa-regions.geo.json` holds Saudi Arabia's 13 administrative regions (ADM1),
used by the assurance map.

- **Source:** geoBoundaries gbOpen, SAU ADM1 (release `9469f09`, boundary year
  2017), simplified edition:
  `https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/SAU/ADM1/geoBoundaries-SAU-ADM1_simplified.geojson`
- **Underlying data:** OpenStreetMap contributors (via Wambacher).
- **Licence:** Open Data Commons Open Database License 1.0 (ODbL). The map must
  show the credit "© OpenStreetMap contributors". Changes to the data itself
  must be shared under the same licence.
- **Processing:** simplified further for the web (Ramer–Douglas–Peucker at
  0.01°, about 1 km; coordinates rounded to 3 decimals; islands under
  0.002 square degrees dropped; only the region name kept). 41 KB.

Boundaries are illustrative. Public datasets differ at some borders; use
official boundaries from the General Authority for Survey and Geospatial
Information (GASGI) for anything shown to the client as authoritative.
