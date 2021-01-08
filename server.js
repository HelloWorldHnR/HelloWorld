// Retrieve confidential information from .env file
const result = require("dotenv").config();

if (result.error) {
  throw result.error;
}

// import statements
const express = require("express");
const mongoose = require("mongoose");
const { queryParser } = require("express-query-parser");
const helmet = require("helmet");
const compression = require("compression");
const Message = require("./models/Message");
const User = require("./models/User");
const isEmpty = require("lodash/isEmpty");

// Initialize app to a server
const app = express();
const server = require("http").createServer(app);

const io = require("socket.io")(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:64226"],
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true,
  },
});
const cors = require("cors");

var corsOptions = {
  // Specifies the origin(s) from which a server request can occur aside from its own origin
  origin: ["http://localhost:3000", "http://localhost:64226"],
};

app.use(cors(corsOptions));

// Increase security by configuring headers
app.use(helmet());
// Compresses the request from client
app.use(compression());

// Allows parsing of JSON from client
app.use(express.json());

// Allows parsing of x-www-form-urlencoded
app.use(
  express.urlencoded({
    extended: false,
  })
);

// Converts booleans in url parameter into actual booleans instead of treating them like string, similarly for null
app.use(
  queryParser({
    parseNull: true,
    parseBoolean: true,
  })
);

// Gets the URI of the MongoDB database used by app
const db = require("./config/keys").mongoURI; // Can change to mongoAtlasURI to connect to cloud database

// mongoDB settings
const options = {
  useNewUrlParser: true,
  useCreateIndex: true,
  // autoIndex: true, // Will result in rejection of duplicate entries
  keepAlive: true,
  poolSize: 10,
  bufferMaxEntries: 0,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  family: 4, // Use IPv4, skip trying IPv6
  useFindAndModify: false,
  useUnifiedTopology: true,
};

// Socket.io connections between client and server
io.on("connection", (socket) => {
  User.find({})
    .sort({ _id: 1 })
    .then((users) => {
      socket.emit("outputUser", users);
      socket.emit("onlineUsers", users.length);

      Message.find({})
        .limit(100)
        .sort({ _id: 1 })
        .then((messages) => {
          socket.emit("outputMessage", messages);
        })
        .catch((err) => console.log(err));
    })
    .catch((err) => console.log(err));

  const setStatus = (msg) => {
    socket.emit("status", msg);
  };

  socket.on("inputUser", (data) => {
    const newUser = new User({
      _id: socket.id,
      username: data.username,
      avatar: data.avatar,
      lat: data.lat,
      lng: data.lng,
    });

    newUser
      .save()
      .then((user) => {
        io.emit("outputUser", [user]);
        User.find({}).then((users) => {
          io.emit("onlineUsers", users.length);
        });
      })
      .catch((err) => console.log(err));
  });

  socket.on("inputMessage", (data) => {
    if (isEmpty(data.text)) {
      setStatus("Please enter name and text");
    } else {
      User.findOne({ _id: socket.id })
        .then((user) => {
          console.log(user);
          const newMessage = new Message({
            username: user.username,
            text: data.text,
          });

          newMessage
            .save()
            .then((message) => {
              io.emit("outputMessage", [message]);
            })
            .catch((err) => {
              console.log(err);
            });
        })
        .catch((err) => console.log(err));
    }
  });

  socket.on("inputPosition", (data) => {
    if (isEmpty(data.lng) || isEmpty(data.lat)) {
      setStatus("No lng or lat included");
    } else {
      User.findOne({ _id: socket.id })
        .then((userToUpdate) => {
          if (!userToUpdate) {
            console.log(`User with ID ${socket.id} does not exist in database`);
          } else {
            userToUpdate.lng = data.lng;
            userToUpdate.lat = data.lat;
            userToUpdate
              .save()
              .then((updatedUser) => {
                io.emit("outputPosition", [updatedUser]);
              })
              .catch((err) => console.log(err));
          }
        })
        .catch((err) => console.log(err));
    }
  });

  socket.on("disconnect", () => {
    User.findOneAndDelete({ _id: socket.id })
      .then(() => {
        socket.broadcast.emit("userLeft", socket.id);
        User.count({}, (err, count) => {
          socket.broadcast.emit("onlineUsers", count);
        });
      })
      .catch((err) => console.log(err));
  });
});

// Connect to the specified MongoDB database
mongoose
  .connect(db, options)
  .then(() => {
    console.log("MongoDB successfully connected");
  })
  .catch((err) => console.log(err));

// Uses process.env.PORT if available otherwise 5000
const port = process.env.PORT || 5000;

const cleanDatabase = async () => {
  await mongoose.connection.db.dropDatabase();
  server.close();
};

// listen for TERM signal .e.g. kill
process.on("SIGTERM", () => cleanDatabase());

// listen for INT signal e.g. Ctrl-C
process.on("SIGINT", () => cleanDatabase());

// or even exit event
process.on("exit", () => cleanDatabase());

// Tells the server which port to listen on
server.listen(port, () =>
  console.log(`Server up and running on port ${port}!`)
);
