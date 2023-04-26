const tmx = require("tmx-parser");

// kanw ena maion func me async giati thelw na kanw listen afou fortosoun ola
//episeis me to promise ayto den xreiazetai na kanw callback
async function loadMap() {
  const map = await new Promise((resolve, reject) => {
    tmx.parseFile("./src/map.tmx", function (err, loadedMap) {
      if (err) return reject(err);
      resolve(loadedMap);
    });
  });
  //kanw ena 2d map edw sigkekrimena me oti xreiazomai apo to map object!

  //edw ta allaksame. anti gia map2d exw ground kai decal(dentra kai petres)
  //giati exw 2 layers sto map kai thelw na kanw display kai ta duo
  // opote kathe ena thelei dika tou tales kai diko tou push mesa sta tiles
  const layer = map.layers[0];
  const groundTiles = layer.tiles;
  const decalTiles = map.layers[1].tiles;
  const ground2D = [];
  const decal2D = [];
  for (let row = 0; row < map.height; row++) {
    const groundRow = [];
    const decalRow = [];
    for (let col = 0; col < map.width; col++) {
      const groundTile = groundTiles[row * map.height + col];
      groundRow.push({ id: groundTile.id, gid: groundTile.gid });
      const decalTile = decalTiles[row * map.height + col];
      if (decalTile) {
        decalRow.push({
          id: decalTile.id,
          gid: decalTile.gid,
        });
      } else {
        decalRow.push(undefined);   // SOS to layer decal opou den exei dentra einai keno(diladi to perisotero meros tou)!
        //kai uparxei problem ama den tou pw opou keno vale null.
      }
    }
    ground2D.push(groundRow);
    decal2D.push(decalRow);
  }


  return {
    ground2D,
    decal2D,
  };
}

module.exports = loadMap;
