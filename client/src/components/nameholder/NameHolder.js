import React, { useContext, useState } from 'react';
import { StateContext } from '../../App';
import './styles.css';
import '../picturecontainer/styles.css';
import { listOfImages } from '../picturecontainer/imagesList';
import { Modal } from 'react-bootstrap';
import ListOfImages from '../picturecontainer/ListOfImages';
import io from 'socket.io-client';

const NameHolder = () => {
  const socket = io('/', {
    withCredentials: true,
    extraHeaders: {
      'my-custom-header': 'abcd',
    },
  });

  const { name, setName, image, setImage } = useContext(StateContext);
  const [isPickAvatar, showAvatarPicker] = useState(false);

  const handleSelection = (pic) => {
    setImage(pic);
    showAvatarPicker(false);
    socket.emit('inputUpdateUser', {
      avatar: pic,
    });
  };

  const handleNameChange = (event) => {
    const newName = event.target.value;
    setName(newName);
    socket.emit('inputUpdateUser', {
      username: newName,
    });
  };

  return (
    <>
      <Modal
        show={isPickAvatar}
        onHide={() => showAvatarPicker(false)}
        size="lg"
        dialogClassName="appear-on-left"
        aria-labelledby="contained-modal-title-vcenter"
      >
        <ListOfImages currentSelected={image} handleSelection={handleSelection} />
      </Modal>
      <div className="row-flex">
        <img
          src={image ? listOfImages[image] : listOfImages['boy1']}
          alt="none"
          className="image-style"
          style={{ width: `50px` }}
          onClick={() => showAvatarPicker(true)}
        />
        <input className="input-name" placeholder={name} onChange={handleNameChange} />
      </div>
    </>
  );
};

export default NameHolder;
