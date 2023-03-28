import { firebaseDb } from "./firebase.js";
import { ref, onValue } from "firebase/database";

const realTimeData = (makeObsFunc) => {
  // Array to store data from firebase
  let objectData = [];
  let objectTurtleTerseRDFData = [];

  // firebase useEffect to fetch data
  const dbref = ref(firebaseDb, "video/");

  onValue(dbref, (snapshot) => {
    const data = snapshot.val();
    var newObjects = Object.keys(data).map((key) => ({
      id: key,
      ...data[key],
    }));
    newObjects = newObjects.filter((object) => {
      var objectTimeFromString = Date.parse(object.datetime);
      var objectTime = new Date(objectTimeFromString);
      var currentTime = new Date();
      var oneMinuteAgo = new Date(currentTime - 60 * 1000);

      if (objectTime > oneMinuteAgo) {
        // keep object
        return true;
      } else {
        // discard
        return false;
      }
    });

    objectData = newObjects;
    convertToTurtleTerseRDF(objectData);
    showTotalObjectTurtleTerseRDFData();
  });

  // Convert to Turtle Terse RDF
  function convertToTurtleTerseRDF(Data) {
    let turtleTerseRDFData = [];
    Data.forEach((data, index) => {
      data.name = data.name.replace(/ /g, "");
      data.name = data.name.replace(/\W/g, "");
      data.name = data.name.toLowerCase();

      turtleTerseRDFData.push(
        `:observation${index + 1}
          a sosa:Observation ;
          sosa:observedProperty :${data.name} ;
          sosa:madeBySensor :${data.sensorId} ;
          sosa:hasSimpleResult true ;
          sosa:resultTime "${data.datetime}"^^xsd:dateTime . `
      );
    });
    objectTurtleTerseRDFData = turtleTerseRDFData;
  }

  convertToTurtleTerseRDF(objectData);

  // Show totalObjectTurtleTerseRDFData for inference from a last minute
  function showTotalObjectTurtleTerseRDFData() {
    var prefixRDFTurtle = `
      @prefix : <http://signalkg.visualmodel.org/demo#> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      @prefix sosa: <http://www.w3.org/ns/sosa/> . `;

    var totalObjectTurtleTerseRDFData = prefixRDFTurtle + "\n";

    objectTurtleTerseRDFData.map((object) => {
      totalObjectTurtleTerseRDFData += object;
    });

    makeObsFunc(totalObjectTurtleTerseRDFData);
  }
};

export { realTimeData };
