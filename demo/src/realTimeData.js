import { firebaseDb } from "./firebase.js";
import { ref, onValue } from "firebase/database";

const realTimeData = (makeObsFunc) => {
  // Array to store data from firebase
  let objectData = [];
  // let objectNTripleData = [];
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
    // convertToNTriple(objectData);
    convertToTurtleTerseRDF(objectData);

    // showObjectNTripleData();
    // showObjectTurtleTerseRDFData();
    showTotalObjectTurtleTerseRDFData();
  });

  // Convert to N-Triple
  // function convertToNTriple(Data) {
  //   let nTripleData = [];
  //   Data.forEach((data) => {
  //     nTripleData.push(
  //       `<http://signalkg.visualmodel.org/demo#observation1> <http://www.w3.org/ns/sosa/observedProperty> <http://signalkg.visualmodel.org/demo#${data.name}>`
  //     );
  //   });
  //   objectNTripleData = nTripleData;
  // }

  // convertToNTriple(objectData);

  // Convert to Turtle Terse RDF
  function convertToTurtleTerseRDF(Data) {
    let turtleTerseRDFData = [];
    Data.forEach((data, index) => {
      data.name = data.name.replace(/ /g, "");

      turtleTerseRDFData.push(
        `:observation${index + 1}
          a sosa:Observation ;
          sosa:observedProperty :${data.name} ;
          sosa:madeBySensor :cam0 ;
          sosa:hasSimpleResult true ;
          sosa:resultTime "2022-06-28T00:00:05.000Z"^^xsd:dateTime . `
      );
    });
    objectTurtleTerseRDFData = turtleTerseRDFData;
  }

  convertToTurtleTerseRDF(objectData);

  // Show objectNTripleData
  // function showObjectNTripleData() {
  //   console.log("objectNTripleData");
  //   {
  //     objectNTripleData.map((object, index) => {
  //       {
  //         console.log("index", index);
  //       }
  //       {
  //         console.log("object", object);
  //       }
  //     });
  //   }
  // }

  // Show objectTurtleTerseRDFData
  // function showObjectTurtleTerseRDFData() {
  //   console.log("objectTurtleTerseRDFData");
  //   {
  //     objectTurtleTerseRDFData.map((object, index) => {
  //       {
  //         console.log("index", index);
  //       }
  //       {
  //         console.log("object", object);
  //       }
  //     });
  //   }
  // }

  // Show totalObjectTurtleTerseRDFData for inference from a last minute
  function showTotalObjectTurtleTerseRDFData() {
    console.log("Show objectTurtleTerseRDFData");

    var prefixRDFTurtle = `
      @prefix : <http://signalkg.visualmodel.org/demo#> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      @prefix sosa: <http://www.w3.org/ns/sosa/> . `;

    var totalObjectTurtleTerseRDFData = prefixRDFTurtle + "\n";

    {
      objectTurtleTerseRDFData.map((object) => {
        totalObjectTurtleTerseRDFData += object;
      });
    }

    console.log(totalObjectTurtleTerseRDFData);

    makeObsFunc(totalObjectTurtleTerseRDFData);
  }
};

export { realTimeData };
