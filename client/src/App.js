import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

import './App.css';
import { fakeUsers } from './util/fakeUsers';
import NameHolder from './components/nameholder/NameHolder';
import LoginModal from './loginmodal/LoginModal';
import GoogleMap from './components/GoogleMap';
import ChatBox from './components/chatbox/ChatBox';
import ReCenterIcon from './components/button/ReCenterIcon';
import NumberOfUsers from './components/usercount/NumberOfUsers';

// const SERVER_URL = 'http://localhost:5000';
export const StateContext = React.createContext({});

const SG_POSITION = { lat: 1.3521, lng: 103.8198 };

const socket = io('/', {
  withCredentials: true,
});

function createUserObj(data) {
  return {
    ...data,
    lat: parseFloat(data.lat),
    lng: parseFloat(data.lng),
  };
}

function createMessageObj(data) {
  return {
    _id: data._id,
    sender: data.username,
    senderId: data.userId,
    text: data.text,
  };
}

function App() {
  // Global Variables
  const [name, setName] = useState('');
  const [image, setImage] = useState('boy1');
  const [mapOptions, setMapOptions] = useState(null);

  const [users, setUsers] = useState(fakeUsers);
  const [messages, setMessages] = useState([]);
  const [numOnline, setNumOnline] = useState(0);

  const [isUserInputted, setIsUserInputted] = useState(false);

  // Map Coordinates
  const [currLocation, setCurrLocation] = useState(SG_POSITION);

  useEffect(() => {
    socket.on('connect', (message) => {
      console.log('A new user has connected');
    });

    socket.on('status', (msg) => {
      console.log(msg);
    });

    socket.on('outputUser', (allUsers) => {
      allUsers.map((user) => console.log('user ' + user.username + ' joined'));
      const cleanedData = allUsers.map((user) => createUserObj(user));
      setUsers((prevUsers) => [...prevUsers, ...cleanedData]);
    });

    socket.on('outputMessage', (newMessages) => {
      const modifiedMsg = newMessages.map((msg) => createMessageObj(msg));
      setMessages((prevMessages) => [...prevMessages, ...modifiedMsg]);

      const ids = new Map();
      newMessages.forEach((msg) => {
        ids.set(msg.userId, msg.text);
      });

      setUsers((prevUsers) =>
        prevUsers.map((usr) => {
          if (ids.has(usr._id)) {
            return { ...usr, latestMessage: ids.get(usr._id) };
          } else {
            return usr;
          }
        })
      );
    });

    ['outputUpdateUser', 'outputPosition'].forEach((event) => {
      socket.on(event, (newUsers) => {
        newUsers.map((user) => console.log(user.username + ' was modified'));
        const cleanedData = newUsers.map((user) => createUserObj(user));
        const ids = new Set(cleanedData.map((u) => u._id));
        setUsers((prevUsers) => [...newUsers, ...prevUsers.filter((u) => !ids.has(u._id))]);
      });
    });

    socket.on('onlineUsers', (number) => {
      console.log('users: ' + number);
      setNumOnline(number + fakeUsers.length);
    });

    socket.on('userLeft', (userId) => {
      console.log('user ' + userId + ' left' + ' called by ' + socket.id);
      setUsers((prevUsers) => [...prevUsers.filter((u) => u._id !== userId)]);
    });

    // get location
    if ('geolocation' in navigator) {
      console.log('Location enabled');

      navigator.geolocation.getCurrentPosition((position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setCurrLocation(location);
        setMapOptions({ center: location, zoom: 15 });
      });

      if (isUserInputted) {
        navigator.geolocation.watchPosition((position) => {
          console.log('geolocation changed');
          if (
            currLocation.lat !== position.coords.latitude ||
            currLocation.lng !== position.coords.longitude
          ) {
            const location = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };

            setCurrLocation(location);
            console.log(location);
            socket.emit('inputPosition', location);
          }
        });
      }
    } else {
      console.log('Location disabled');
    }
  }, []);

  useEffect(() => {
    console.log('Changed name/avatar');
    socket.emit('inputUpdateUser', { username: name, avatar: image });
  }, [name, image]);

  const contextProviderValue = {
    name,
    setName,
    image,
    setImage,
    mapOptions,
    setMapOptions,
    socketId: socket.id,
    currLocation,
    numOnline,
    sendMessage: (text) => socket.emit('inputMessage', { text: text }),
    sendUserInput: (name, image) => {
      socket.emit('inputUser', {
        username: name,
        avatar: image,
        lat: currLocation.lat,
        lng: currLocation.lng,
      });
      setIsUserInputted(true);
    },
  };

  return (
    <div className="App">
      <StateContext.Provider value={contextProviderValue}>
        <LoginModal />
        <NameHolder />
        <NumberOfUsers />
        <GoogleMap users={users} />
        <ReCenterIcon handleClick={() => setMapOptions({ center: currLocation, zoom: 15 })} />
        <ChatBox messages={messages} />
      </StateContext.Provider>
      {/*<p className="app-name">HELLO WORLD!</p>*/}
    </div>
  );
}

export default App;
