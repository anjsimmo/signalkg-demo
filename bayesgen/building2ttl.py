import json
import os
import datetime
from rdflib import Graph, Namespace, RDF, SKOS
import math
import argparse

WALL_HEIGHT = 2.0 # 2 metres
WALL_THICKNESS = 0.1 # assume 0.1 metre thick barriers
BARRIER_HEIGHT = 0.5

def createBarrier(x1, y1, x2, y2, barrier_type, name):
    x_center = (x1 + x2) / 2
    y_center = (y1 + y2) / 2
    z_center = 0
    
    if barrier_type == "asset:BarrierAsset":
        height = BARRIER_HEIGHT
    else:
        height = WALL_HEIGHT

    width = math.sqrt((x2-x1)**2 + (y2-y1)**2)
    thickness = WALL_THICKNESS
    # Flat wall with 0 yaw is treated as plane in y-z axis. Compute yaw (about z-axis) of normal pointing in x-axis (-90 degree rotation).
    # See https://www.varsitytutors.com/hotmath/hotmath_help/topics/rotations for explanation of why we swap x and y
    x_normal = (y2-y1)
    y_normal = -(x2-x1)
    yaw = math.atan2(y_normal, x_normal)
    roll = 0
    pitch = 0
    ttl = f":{name}\n" \
          f"  a {barrier_type} ;\n" \
          f'  pose:width "{width}"^^xsd:decimal ;\n' \
          f'  pose:height "{height}"^^xsd:decimal ;\n' \
          f'  pose:thickness "{thickness}"^^xsd:decimal ;\n' \
          f'  pose:x "{x_center}"^^xsd:decimal ;\n' \
          f'  pose:y "{y_center}"^^xsd:decimal ;\n' \
          f'  pose:z "{z_center}"^^xsd:decimal ;\n' \
          f'  pose:roll "{roll}"^^xsd:decimal ;\n' \
          f'  pose:pitch "{pitch}"^^xsd:decimal ;\n' \
          f'  pose:yaw "{yaw}"^^xsd:decimal ;\n' \
          "."
    return ttl


barrier_type_mapping = {
    # "door": "asset:Door",
    "wall": "building:Wall",
    "barrier": "asset:BarrierAsset",
    "window": "asset:Window"
}


def convert(datapath):
    with open(datapath) as f:
        j = json.load(f)

    ttl = []
    features = j["features"]

    # Extract Barriers
    for i, f in enumerate(features):
        ftype = f["properties"]["type"]
        if not ftype in barrier_type_mapping:
            continue
        barrier_type = barrier_type_mapping[ftype]
        points = f["geometry"]["coordinates"]
        x1, y1 = points[0]
        x2, y2 = points[1]
        if "name" in f["properties"]:
            name = f["properties"]["name"]
        else:
            name = f"barrier{i}"
        ttl.append(createBarrier(x1, y1, x2, y2, barrier_type, name))

    # TODO: Extract Sensors

    boilerplate = "@prefix : <http://signalkg.visualmodel.org/demo#> .\n" \
                  "@prefix asset: <https://w3id.org/rec/asset/> .\n" \
                  "@prefix building: <https://w3id.org/rec/building/> .\n" \
                  "@prefix pose: <http://signalkg.visualmodel.org/pose#> .\n" \
                  "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n\n"
    g = Graph().parse(format='ttl', data=boilerplate + "\n".join(ttl))
    return g


def main():
    parser = argparse.ArgumentParser(description='Convert GeoJSON building to ttl')
    parser.add_argument('datapath', type=str,
                        help='GeoJSON file for building')
    parser.add_argument('extra_ttl_files', type=str, nargs='+',
                        help='additional ttl files to include')
    parser.add_argument('--out', metavar="output_file")

    args = parser.parse_args()

    g = convert(args.datapath)

    for extra_file in args.extra_ttl_files:
        g += Graph().parse(extra_file, format='ttl')

    g.serialize(destination=args.out)


if __name__ == "__main__":
    main()
