const mapImage = new Image();
mapImage.src = "snowy-sheet.png";

const santaImage = new Image();
santaImage.src = "santa.png";

const microphoneImage = new Image();
microphoneImage.src = "microphone.png";

const walkSnow = new Audio("walk-snow.mp3");

const canvasEl = document.getElementById("canvas");
canvasEl.width = window.innerWidth;
canvasEl.height = window.innerHeight;
const canvas = canvasEl.getContext("2d");

const socket = io(`ws://localhost:5000`);

//AGORA
const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

const localTracks = {
  audioTrack: null,
};

let isPlaying = true;
let undecided = true;

const remoteUsers = {};
const muteButton = document.getElementById("mute");
const uid = Math.floor(Math.random() * 1000000);

document.getElementById("mute").addEventListener("click", (e) => {
  e.stopPropagation();
  if (isPlaying) {
    localTracks.audioTrack.setEnabled(false);
    muteButton.innerText = "unmute";
    socket.emit("mute", true);
  } else {
    localTracks.audioTrack.stop(true);
    muteButton.innerText = "mute";
    socket.emit("mute", false);
  }
  isPlaying = !isPlaying;
});

document.getElementById("teamOne").addEventListener("click", (e) => {
  e.stopPropagation();
  let teamId = 1;
  let color = "#0000FF";
  socket.emit("teamOne", teamId, color);
  undecided = false;
  document.getElementById("teamOne").disabled = true;
  document.getElementById("teamTwo").disabled = true;
});

document.getElementById("teamTwo").addEventListener("click", (e) => {
  e.stopPropagation();
  let teamId = 2;
  let color = "#FF0000";
  socket.emit("teamTwo", teamId, color);
  undecided = false;
  document.getElementById("teamOne").disabled = true;
  document.getElementById("teamTwo").disabled = true;
});

// Agora client options
const options = {
  appid: "d3e3de4f11744493b52bca1542d413e4",
  channel: "game",
  uid: null,
  token:
    "007eJxTYLB6axoxOexnj7ndL/4/6QESU5fwVH9UmOKydEVAGR9PdbcCQ4pxqnFKqkmaoaG5iYmJpXGSqVFScqKhqYlRiomhcapJwoXdyQ2BjAwavLOYGBkgEMRnYUhPzE1lYAAA2+gdcA==d",
};

async function subscribe(user, mediaType) {
  // subscribe to a remote user
  await client.subscribe(user, mediaType);
  if (mediaType === "audio") {
    user.audioTrack.play();
    console.log("audio plays");
  }
}

function handleUserPublished(user, mediaType) {
  const id = user.uid;
  remoteUsers[id] = user;
  subscribe(user, mediaType);
}

function handleUserUnpublished(user) {
  const id = user.uid;
  delete remoteUsers[id];
}

async function join() {
  socket.emit("voiceId", uid);

  client.on("user-published", handleUserPublished);
  client.on("user-unpublished", handleUserUnpublished);

  [options.uid, localTracks.audioTrack] = await Promise.all([
    client.join(
      options.appid,
      options.channel,
      options.token || null,
      options.uid
    ),
    AgoraRTC.createMicrophoneAudioTrack(),
  ]);

  await client.publish(Object.values(localTracks));
}

join();

let groundMap = [[]];
let decalMap = [[]];
let players = [];
let snowballs = [];
let teams = [];

const TILE_SIZE = 32;
const SNOWBALL_RADIUS = 5;

socket.on("connect", () => {
  console.log("connect");
  console.log("socket_id", socket.id);
});

socket.on("map", (loadedMap) => {
  groundMap = loadedMap.ground;
  decalMap = loadedMap.decal;
});

socket.on("players", (serverPlayers) => {
  players = serverPlayers;
});

socket.on("snowballs", (serverSnowballs) => {
  snowballs = serverSnowballs;
});

//keep track of our inputs to walk

const inputs = {
  up: false,
  down: false,
  left: false,
  right: false,
};

const clickPosition = [];

let text = [" "];
window.addEventListener("keydown", (e) => {
  if (text.length > 100) {
    text = [" "];
  }
  text = [...text, e.key];
  let textNew = text.join("");
  if (textNew.includes("aezakmi")) {
    text = [" "];
    socket.emit("cheats", true);
  }
});

window.addEventListener("keydown", (e) => {
  if (e.key === "w") {
    inputs["up"] = true;
  } else if (e.key === "s") {
    inputs["down"] = true;
  } else if (e.key === "d") {
    inputs["right"] = true;
  } else if (e.key === "a") {
    inputs["left"] = true;
  }
  if (["w", "a", "s", "d"].includes(e.key) && walkSnow.paused) {
    walkSnow.play();
  }

  socket.emit("inputs", inputs);
});

window.addEventListener("keyup", (e) => {
  if (e.key === "w") {
    inputs["up"] = false;
  } else if (e.key === "s") {
    inputs["down"] = false;
  } else if (e.key === "d") {
    inputs["right"] = false;
  } else if (e.key === "a") {
    inputs["left"] = false;
  }
  if (["w", "a", "s", "d"].includes(e.key)) {
    walkSnow.pause();
    walkSnow.currentTime = 0;
  }

  socket.emit("inputs", inputs);
});

window.addEventListener("click", (e) => {
  const angle = Math.atan2(
    e.clientY - canvasEl.height / 2,
    e.clientX - canvasEl.width / 2
  );
  socket.emit("snowball", angle);
});

// document.addEventListener('mousemove', event => {
//   console.log(event.clientX ,event.clientY)
// })

//prepei na orisw kapos to refresh rate gia to paixnidi! na kanei render swsta kai na ananaionetai swsta.
// to max theoritika einia 60 fps gt o kodikas ousiatika tha perasei sto browser kai einai sthn othoni mou...an den kanw lathos

// kanw ena loop me auton ton aplo kodika gia na kanei astamatita refresh
//katw kalw thn loop() kai mesa sthn loop() exw pali ton idio kwdika na tn kalei

function loop() {
  //panda clear gia na min krataei kai ta palia apo pisw
  canvas.clearRect(0, 0, canvasEl.width, canvasEl.height);

  const myPlayer = players.find((player) => player.id === socket.id);
  let cameraX = 0;
  let cameraY = 0;
  if (myPlayer) {
    cameraX = parseInt(myPlayer.x - canvasEl.width / 2);
    cameraY = parseInt(myPlayer.y - canvasEl.height / 2);
  }

  const TILES_IN_ROW = 8;

  for (let row = 0; row < groundMap.length; row++) {
    for (let col = 0; col < groundMap[0].length; col++) {
      let { id } = groundMap[row][col];
      const imageRow = parseInt(id / TILES_IN_ROW);
      const imageCol = id % TILES_IN_ROW;
      //(mapImage, x , y)
      canvas.drawImage(
        mapImage,
        imageCol * TILE_SIZE,
        imageRow * TILE_SIZE,
        TILE_SIZE,
        TILE_SIZE,
        col * TILE_SIZE - cameraX,
        row * TILE_SIZE - cameraY,
        TILE_SIZE,
        TILE_SIZE
      );
    }
  }

  for (let row = 0; row < decalMap.length; row++) {
    for (let col = 0; col < decalMap[0].length; col++) {
      let { id } = decalMap[row][col] ?? { id: undefined };
      const imageRow = parseInt(id / TILES_IN_ROW);
      const imageCol = id % TILES_IN_ROW;

      canvas.drawImage(
        mapImage,
        imageCol * TILE_SIZE,
        imageRow * TILE_SIZE,
        TILE_SIZE,
        TILE_SIZE,
        col * TILE_SIZE - cameraX,
        row * TILE_SIZE - cameraY,
        TILE_SIZE,
        TILE_SIZE
      );
    }
  }

  //draw santa on every connect
  for (const player of players) {
    canvas.fillStyle = `${player.color}`;
    canvas.drawImage(santaImage, player.x - cameraX, player.y - cameraY);
    if (!player.isMuted) {
      canvas.drawImage(
        microphoneImage,
        player.x + 2 - cameraX,
        player.y - 25 - cameraY
      );
    }
    if (!undecided) {
      canvas.fillText(
        `${player.teamId}`,
        player.x + 10 - cameraX,
        player.y - 40 - cameraY
      );
    }
    canvas.font = "15px serif";
    canvas.fillText(
      `${player.healthBar}`,
      player.x + 30 - cameraX,
      player.y + 10 - cameraY
    );
    canvas.fillText(
      `${player.score}`,
      player.x - 20 - cameraX,
      player.y + 10 - cameraY
    );
  }

  for (const snowball of snowballs) {
    canvas.fillStyle = "#FFFFFF";
    canvas.beginPath();
    canvas.arc(
      snowball.x - cameraX,
      snowball.y - cameraY,
      SNOWBALL_RADIUS,
      0,
      2 * Math.PI
    );
    canvas.fill();
    canvas.strokeStyle = "#000000";
    canvas.stroke();
  }
  window.requestAnimationFrame(loop);
}

window.requestAnimationFrame(loop);
