import json
import os
import datetime
import math
from collections import defaultdict
from rdflib import Graph, Namespace, RDF, SKOS
import argparse

def createEntity(entity_name, entity_type, actions):
    ttl = f":{entity_name}\n" \
          f"  a skg:ConcreteEntity ;\n" \
          f"  skg:entityCategory :{entity_type} ;\n"
    for action_name in actions:
        ttl += f'  skg:concretePerforms :{action_name} ;\n'
    ttl += "."
    return ttl

def createAction(x1, y1, x2, y2, action, start_time, end_time, name, actsOn):
    z1 = z2 = 0
    ttl = f":{name}\n" \
          f"  a skg:ConcreteAction ;\n" \
          f"  skg:actionCategory :{action} ;\n" \
          f"  skg:concreteActsOn :{actsOn} ;\n" \
          f"  skg:startState [\n" \
          f'    pose:x "{x1}"^^xsd:decimal ;\n' \
          f'    pose:y "{y1}"^^xsd:decimal ;\n' \
          f'    pose:z "{z1}"^^xsd:decimal ;\n' \
          f"  ] ;\n" \
          f"  skg:endState [\n" \
          f'    pose:x "{x2}"^^xsd:decimal ;\n' \
          f'    pose:y "{y2}"^^xsd:decimal ;\n' \
          f'    pose:z "{z2}"^^xsd:decimal ;\n' \
          f"  ] ;\n" \
          f'  skg:startTime "{start_time}"^^xsd:dateTime ;\n' \
          f'  skg:endTime "{end_time}"^^xsd:dateTime ;\n' \
          "."
    return ttl

def convert(datapath, entities_to_extract, extract_entities, extract_actions):
    with open(datapath) as f:
        j = json.load(f)

    ttl = []
    features = j["features"]

    # entity_name -> [action]
    entities_actions = defaultdict(list)
    # entity_name -> entity_type
    entity_types = {}
    
    # Extract Actions
    for i, f in enumerate(features):
        entity_name = f["properties"]["entityName"]
        entity_type = f["properties"]["entityType"]
        if not entity_name in entities_to_extract:
            continue

        action = f["properties"]["action"]
        points = f["geometry"]["coordinates"]
        x1, y1 = points[0]
        x2, y2 = points[1]
        if "name" in f["properties"]:
            name = f["properties"]["name"]
        else:
            name = f"concreteAction{i+1}"
        start_time = f["properties"]["startTime"]
        end_time = f["properties"]["endTime"]
        if "actsOn" in f["properties"]:
            actsOn = f["properties"]["actsOn"]
        else:
            actsOn = "locLivingRoom"
        
        if extract_actions:
            ttl.append(createAction(x1, y1, x2, y2, action, start_time, end_time, name, actsOn))
        
        entities_actions[entity_name].append(name)
        if entity_name in entity_type:
            # Entity type should be consistent
            assert entity_types[entity_name] == entity_type 
        else:
            entity_types[entity_name] = entity_type
    
    for i, entity_name in enumerate(entities_actions):
        action_names = entities_actions[entity_name]
        entity_type = entity_types[entity_name]
        
        if extract_entities:
            ttl.append(createEntity(entity_name, entity_type, action_names))

    # TODO: Extract Sensors

    boilerplate = "@prefix : <http://signalkg.visualmodel.org/demo#> .\n" \
                  "@prefix pose: <http://signalkg.visualmodel.org/pose#> .\n" \
                  "@prefix skg: <http://signalkg.visualmodel.org/skg#> .\n" \
                  "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n\n"
    g = Graph().parse(format='ttl', data=boilerplate + "\n".join(ttl))
    return g


def main():
    parser = argparse.ArgumentParser(description='Convert GeoJSON scenairo to ttl')
    parser.add_argument('datapath', type=str,
                        help='GeoJSON file for scenario')
    parser.add_argument('entities', type=str, nargs='+',
                        help='entity names to extract')
    parser.add_argument('--out_actions', metavar="actions_output_file")
    parser.add_argument('--out_entities', metavar="entities_output_file")

    args = parser.parse_args()

    g1 = convert(args.datapath, args.entities, True, False)
    g1.serialize(destination=args.out_entities)

    g2 = convert(args.datapath, args.entities, False, True)
    g2.serialize(destination=args.out_actions)


if __name__ == "__main__":
    main()
