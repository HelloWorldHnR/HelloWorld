// Retrieve confidential information from .env file
// const result = require('dotenv').config();

// if (result.error) {
//   throw result.error;
// }

// import statements
const express = require('express');
const mongoose = require('mongoose');
const { queryParser } = require('express-query-parser');
const helmet = require('helmet');
const compression = require('compression');
const Message = require('./models/Message');
const User = require('./models/User');
const isEmpty = require('lodash/isEmpty');

// Initialize app to a server
const app = express();
const server = require('https').createServer(app);

const io = require('socket.io')(server, {
  cors: {
    origin: 'https://hello-world-hacknroll.netlify.app',
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
  },
});
const cors = require('cors');

var corsOptions = {
  // Specifies the origin(s) from which a server request can occur aside from its own origin
  origin: 'https://hello-world-hacknroll.netlify.app',
  credentials: true,
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
const db = require('./config/keys').mongoAtlasURI; // Can change to mongoAtlasURI to connect to cloud database

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
io.on('connection', (socket) => {
  User.find({})
    .sort({ _id: 1 })
    .then((users) => {
      // console.log(users);
      socket.emit('outputUser', users);
      socket.emit('onlineUsers', users.length);

      Message.find({})
        .limit(100)
        .sort({ _id: 1 })
        .then((messages) => {
          socket.emit('outputMessage', messages);
        })
        .catch((err) => console.log(err));
    })
    .catch((err) => console.log(err));

  const setStatus = (msg) => {
    socket.emit('status', msg);
  };

  socket.on('inputUser', (data) => {
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
        io.emit('outputUser', [user]);
        User.find({}).then((users) => {
          io.emit('onlineUsers', users.length);
        });
      })
      .catch((err) => console.log(err));
  });

  socket.on('inputMessage', (data) => {
    if (isEmpty(data.text)) {
      setStatus('Please enter text');
    } else {
      User.findOne({ _id: socket.id })
        .then((user) => {
          if (user) {
            const newMessage = new Message({
              _id: Math.floor(Date.now() / 1000) + '-' + socket.id,
              username: user.username,
              userId: socket.id,
              text: data.text,
            });

            console.log('going to emit');
            newMessage
              .save()
              .then((message) => {
                console.log('emitting');
                io.emit('outputMessage', [message]);
              })
              .catch((err) => {
                console.log(err);
              });
          }
        })
        .catch((err) => console.log(err));
    }
  });

  socket.on('inputPosition', (data) => {
    if (!data.lng || !data.lat) {
      setStatus('No lng or lat included', data);
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
                io.emit('outputPosition', [updatedUser]);
              })
              .catch((err) => console.log(err));
          }
        })
        .catch((err) => console.log(err));
    }
  });

  socket.on('inputUpdateUser', (updatedData) => {
    User.findOne({ _id: socket.id })
      .then((userToUpdate) => {
        if (userToUpdate) {
          userToUpdate.username = isEmpty(updatedData.username)
            ? userToUpdate.username
            : updatedData.username;
          userToUpdate.avatar = isEmpty(updatedData.avatar)
            ? userToUpdate.avatar
            : updatedData.avatar;
          userToUpdate.lat = isEmpty(updatedData.lat) ? userToUpdate.lat : updatedData.lat;
          userToUpdate.lng = isEmpty(updatedData.lng) ? userToUpdate.lng : updatedData.lng;

          userToUpdate
            .save()
            .then((updatedUser) => {
              io.emit('outputUpdateUser', [updatedUser]);
            })
            .catch((err) => console.log(err));
        }
      })
      .catch((err) => console.log(err));
  });

  socket.on('disconnect', () => {
    User.findOneAndRemove({ _id: socket.id })
      .then((user) => {
        if (user) {
          console.log('emitting disconnect for user ' + user.username);
          socket.broadcast.emit('userLeft', socket.id);
          User.count({}, (err, count) => {
            socket.broadcast.emit('onlineUsers', count);
          });
        }
      })
      .catch((err) => console.log(err));
  });
});

// Connect to the specified MongoDB database
mongoose
  .connect(db, options)
  .then(() => {
    console.log('MongoDB successfully connected');
  })
  .catch((err) => console.log(err));

// Uses process.env.PORT if available otherwise 5000
const port = process.env.PORT || 5000;

const cleanDatabase = async () => {
  await mongoose.connection.db.dropDatabase();
  server.close();
};

// listen for TERM signal .e.g. kill
process.on('SIGTERM', () => cleanDatabase());

// listen for INT signal e.g. Ctrl-C
process.on('SIGINT', () => cleanDatabase());

// or even exit event
process.on('exit', () => cleanDatabase());

// Tells the server which port to listen on
server.listen(port, () => console.log(`Server up and running on port ${port}!`));
