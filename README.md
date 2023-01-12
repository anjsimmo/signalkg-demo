# SignalKG Demo

Signal Knowledge Graph (SignalKG) supports machines to reason about the underlying causes of sensor observations.

Interactive demo: https://signalkg.visualmodel.org

Paper: Anj Simmons, Rajesh Vasa, Antonio Giardina, SignalKG: Towards reasoning about the underlying causes of sensor observations. In _ISWC (Posters/Demos/Industry)_. 2022. https://arxiv.org/abs/2208.05627

## Dependencies

Code to generate a Bayesian network from a SignalKG knowledge graph is implemented in Python3. The web demo is implemented in node.js. To install all dependencies in a [conda](https://conda.io/) environment run:

```
conda create -n skg python=3
conda activate skg
conda install -c conda-forge nodejs==18.7.0
pip install -r requirements.txt
cd demo; npm install
```

## Building

To rebuild everything, run `./build.sh`

If you just want to build the web demo:
```
cd demo
npm run build
```

## Adding a new knowledge graphs

* Place the new knowledge graphs in the `demo/data/` directory.
* Run `bayesgen/skg2bayes.py` to generate a Bayesian network from the knowledge graphs. See `build.sh` for examples.
* Add the knowledge graphs to the `demoSelect` select box in `index.html`.
  * Set the `value=` property to the path to the signal graph, sensor graph, and building graph (space separated).
  * Set the `data-graph=` property to the generated Bayesian network.

## Adding a new scenario

* Place new concrete entities and concrete actions files for the scenario in the `demo/data/` directory.
* Add the scenario to the `demoScenarioSelect` select box in `index.html`.
  * Set the `value=` property to the path to the concrete entities and concrete action files (space separated).
  * Set the `data-applies-to-graphs=` property to the Bayesian network for the graph the scenario should be listed for (space separated if the scenario should be listed for multiple graphs)

## Convenience scripts

* To make specification of building graphs and scenarios easier, scripts are available to extract the information from GeoJSON files and convert this to ttl. See `build.sh` for examples.

## Limitations

* The knowledge graphs in the interactive demo are currently read only, as we would need to rerun the Python scripts to regenerate the Bayesian network if they were modified. Future work would be to create a REST service to perform the conversion, or to port the Python scripts to node.
* When generating the Bayesian networks, only the name (the part of the URI after the `#`) is used rather than the full URI. This leads to more convenient names, but may result in errors if there are naming conflicts. Future work would be to use the full URI consistently throughout the entire pipeline.
* Simulated scenarios are assumed to start at 2022-06-28T10:00:00. Modify `SIM_START_DATETIME` in `vis.js` to change this. Future work would be to implement time controls, or to automatically extract the start time from the scenario files.

## License

* Code is shared under the MIT License.
* The 3D model of a car is extracted from [Generic passenger car pack](https://skfb.ly/6sUFy) by Comrade1280 licensed under [Creative Commons Attribution](http://creativecommons.org/licenses/by/4.0/).
