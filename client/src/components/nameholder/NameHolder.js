import React, { useContext, useState } from 'react';
import { StateContext } from '../../App';
import './styles.css';
import '../picturecontainer/styles.css';
import { listOfImages } from '../picturecontainer/imagesList';
import { Modal } from 'react-bootstrap';
import ListOfImages from '../picturecontainer/ListOfImages';

const NameHolder = () => {
  const { name, setName, image, setImage } = useContext(StateContext);
  const [isPickAvatar, showAvatarPicker] = useState(false);

  const handleSelection = (pic) => {
    setImage(pic);
    showAvatarPicker(false);
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
          style={{ width: `60px` }}
          onClick={() => showAvatarPicker(true)}
        />
        <input
          className="input-name"
          placeholder={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
    </>
  );
};

export default NameHolder;