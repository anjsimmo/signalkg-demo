#!/bin/bash

# Directory for generated files
mkdir -p demo/generated

# Convert building plans (in geojson) to ttl
python3 bayesgen/building2ttl.py demo/data/building.geojson demo/data/building_named_areas.ttl --out demo/generated/building_geo.ttl
python3 bayesgen/building2ttl.py demo/data/city.geojson demo/data/city_named_areas.ttl --out demo/generated/city_geo.ttl

# Generate a Bayesian graph from the signal knowledge graph, sensor graph, and building graph
python3 bayesgen/skg2bayes.py demo/data/realtime.ttl demo/data/realtime_sensors.ttl demo/generated/building_geo.ttl --out demo/generated/realtime.json
python3 bayesgen/skg2bayes.py demo/data/meeting.ttl demo/data/meeting_sensors.ttl demo/generated/building_geo.ttl --out demo/generated/meeting.json
python3 bayesgen/skg2bayes.py demo/data/simple.ttl demo/data/simple_sensors.ttl demo/generated/building_geo.ttl --out demo/generated/simple.json
python3 bayesgen/skg2bayes.py demo/data/city.ttl demo/data/city_sensors.ttl demo/generated/city_geo.ttl --out demo/generated/city.json

# Convert scenario paths (in geojson) to ttl
python3 bayesgen/scenario2ttl.py demo/data/building_scenarios.geojson "attacker0" --out_entities demo/generated/meeting_scenario_spy.ttl --out_actions demo/generated/meeting_scenario_spy_actions.ttl
python3 bayesgen/scenario2ttl.py demo/data/building_scenarios.geojson "attacker1" --out_entities demo/generated/meeting_scenario_attack.ttl --out_actions demo/generated/meeting_scenario_attack_actions.ttl
python3 bayesgen/scenario2ttl.py demo/data/building_scenarios.geojson "employee1" --out_entities demo/generated/meeting_scenario_emp.ttl --out_actions demo/generated/meeting_scenario_emp_actions.ttl
python3 bayesgen/scenario2ttl.py demo/data/building_scenarios.geojson "attacker1" "employee1" --out_entities demo/generated/meeting_scenario.ttl --out_actions demo/generated/meeting_scenario_actions.ttl
python3 bayesgen/scenario2ttl.py demo/data/city_scenarios.geojson "safeDriver1" --out_entities demo/generated/city_scenario_safe_driver.ttl --out_actions demo/generated/city_scenario_safe_driver_actions.ttl
python3 bayesgen/scenario2ttl.py demo/data/city_scenarios.geojson "dangerousDriver1" "pedestrian1" --out_entities demo/generated/city_scenario_dangerous_driver.ttl --out_actions demo/generated/city_scenario_dangerous_driver_actions.ttl
python3 bayesgen/scenario2ttl.py demo/data/city_scenarios.geojson "dumper1" "employee1" --out_entities demo/generated/city_scenario_dumper.ttl --out_actions demo/generated/city_scenario_dumper_actions.ttl
python3 bayesgen/scenario2ttl.py demo/data/city_scenarios.geojson "evader1" --out_entities demo/generated/city_scenario_evader.ttl --out_actions demo/generated/city_scenario_evader_actions.ttl

# Generate ontology documentation
python3 ontology/generate_doc.py

# Build webapp
cd demo
npm run build
