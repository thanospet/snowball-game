//kapws san server file

const express = require("express");
const { createServer } = require("http");
const { mainModule, disconnect } = require("process");
const { Server } = require("socket.io");

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer);

const loadMap = require("./mapLoader");

const SPEED = 5;
const TICK_RATE = 60;
const SNOWBALL_SPEED = 11;
const PLAYER_SIZE = 32;
const TILE_SIZE = 32;

let players = [];
let snowballs = [];
const inputsMap = {}; // store the client input requests
let ground2D, decal2D;

function isColliding(rect1, rect2) {
  return (
    rect1.x < rect2.x + rect2.w &&
    rect1.x + rect1.w > rect2.x &&
    rect1.y < rect2.y + rect2.h &&
    rect1.h + rect1.y > rect2.y
  );
}

function isCollidingWithMap(val) {
  for (let row = 0; row < decal2D.length; row++) {
    for (let col = 0; col < decal2D[0].length; col++) {
      const tile = decal2D[row][col];
      if (
        tile &&
        isColliding(
          {
            x: val.x,
            y: val.y,
            w: val.w,
            h: val.h,
          },
          {
            x: col * TILE_SIZE,
            y: row * TILE_SIZE,
            w: TILE_SIZE,
            h: TILE_SIZE,
          }
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function tick(delta) {
  for (const player of players) {
    const inputs = inputsMap[player.id];
    const previousY = player.y;
    const previousX = player.x;
    if (inputs.up) {
      player.y -= SPEED;
    } else if (inputs.down) {
      player.y += SPEED;
    }

    if (isCollidingWithMap(player)) {
      player.y = previousY;
    }

    if (inputs.left) {
      player.x -= SPEED;
    } else if (inputs.right) {
      player.x += SPEED;
    }

    if (isCollidingWithMap(player)) {
      player.x = previousX;
    }
    for (const snowball of snowballs) {
      if (isCollidingWithMap(snowball)) {
        snowball.timeLeft = -1;
      }
    }
  }

  //loop over the snowballs ( to give them some physics)
  for (const snowball of snowballs) {
    snowball.x += Math.cos(snowball.angle) * SNOWBALL_SPEED;
    snowball.y += Math.sin(snowball.angle) * SNOWBALL_SPEED;
    snowball.timeLeft -= delta;

    const playerIdsToUpdateScore = [];

    for (const player of players) {
      if (player.id === snowball.playerId) continue;
      if (player.teamId === snowball.teamId) continue;
      const distance = Math.sqrt(
        (player.x + PLAYER_SIZE / 2 - snowball.x) ** 2 +
          (player.y + PLAYER_SIZE / 2 - snowball.y) ** 2
      );

      if (distance <= PLAYER_SIZE / 2) {
        snowball.timeLeft = -1;
        player.healthBar -= 34;
        if (player.healthBar <= 0) {
          player.x = Math.floor(Math.random() * 1500) + 30;

          player.y = Math.floor(Math.random() * 1500) + 30;

          player.healthBar = 100; //ama den einai nested kai einai mono tou xwria to if meta to break menei o paikths me -2 health mexri to epomeno click..pou einai h epomenh xionobala
          player.killedById = snowball.playerId;
          console.log("killedById", player.killedById);
          playerIdsToUpdateScore.push(snowball.playerId);

          for (const player of players) {
            if (playerIdsToUpdateScore.includes(player.id)) {
              player.score++;
              console.log("playerIdsToUpdateScore", playerIdsToUpdateScore);
              console.log("x,y", player.x, player.y);
            }
          }
        }

        break;
      }
    }
  }

  snowballs = snowballs.filter((snowball) => snowball.timeLeft > 0);

  // den uparxei tropos epikoinonias client me UI sthn arxh. Opote edw twra tha steiloume updates meta to tick
  io.emit("players", players);
  io.emit("snowballs", snowballs);
}

async function main() {
  ({ ground2D, decal2D } = await loadMap()); //ta kanei pull out gia na ta xrisimopoihsei pio panw. prin htan : const {ground2D,decal2D} = await loadMap();

  //io emit stelnei oti thelw stous users mesa sto channel
  //socket emite stelnei sigkerkimena ston ekastote user
  io.on("connect", (socket) => {
    console.log("user connected", socket.id);

    inputsMap[socket.id] = {
      up: false,
      down: false,
      left: false,
      right: false,
    };

    players.push({
      // insert player in players arrayds
      voiceId: Math.floor(Math.random() * 1000000),
      id: socket.id,
      x: 1000,
      y: 700,
      w: 32,
      h: 32,
      teamId: null,
      healthBar: 100,
      score: 0,
      killedById: null,
      color: null,
    });

    socket.emit("map", {
      ground: ground2D,
      decal: decal2D,
    });

    //basically whne the user connects you wanna start listening for events that come in from that socket
    socket.on("inputs", (inputs) => {
      inputsMap[socket.id] = inputs; //for every user (socket.id), here, we store the inputs
    });

    socket.on("mute", (isMuted) => {
      const player = players.find((player) => player.id === socket.id);
      player.isMuted = isMuted;
    });

    socket.on("voiceId", (voiceId) => {
      const player = players.find((player) => player.id === socket.id); //find the player
      player.voiceId = voiceId; //put the voiceId on the player object itself
    });

    socket.on("teamOne", (teamId, color) => {
      const player = players.find((player) => player.id === socket.id); //find the player
      player.teamId = teamId;
      player.color = color;//hard coded thn timh den thn pernei nomizw thelei emit apo brosta
      console.log(player.teamId);
    });

    socket.on("teamTwo", (teamId, color) => {
      const player = players.find((player) => player.id === socket.id); //find the player
      player.teamId = teamId;
      player.color = color;
      console.log(player.teamId);
    });

    socket.on("cheats", () => {
      const player = players.find((player) => player.id === socket.id); //find the player
      player.healthBar = 200;
    });

    //prepei na steilw plirofories snowball sto backend
    socket.on("snowball", (angle) => {
      const player = players.find((player) => player.id === socket.id);
      //gemizw to snowballs array
      snowballs.push({
        angle,
        x: player.x,
        y: player.y,
        w: 5,
        h: 5,
        timeLeft: 1000,
        playerId: socket.id,
        teamId: player.teamId,
        color: player.color,
      });
    });

    socket.on("disconnect", () => {
      players = players.filter((player) => player.id !== socket.id); //kaliyera splice, alla exoume ligous paiktes
    });
  });

  app.use(express.static("public"));

  httpServer.listen(5000);

  let lastUpdate = Date.now();
  setInterval(() => {
    const now = Date.now();
    const delta = now - lastUpdate;
    tick(delta);
    lastUpdate = now;
  }, 1000 / TICK_RATE);
}

main();
