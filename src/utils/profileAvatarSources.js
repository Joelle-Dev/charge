import bear from '../assets/profile-avatars/bear.svg';
import cat from '../assets/profile-avatars/cat.svg';
import dog from '../assets/profile-avatars/dog.svg';
import fox from '../assets/profile-avatars/fox.svg';
import frog from '../assets/profile-avatars/frog.svg';
import hamster from '../assets/profile-avatars/hamster.svg';
import koala from '../assets/profile-avatars/koala.svg';
import lion from '../assets/profile-avatars/lion.svg';
import panda from '../assets/profile-avatars/panda.svg';
import pig from '../assets/profile-avatars/pig.svg';
import rabbit from '../assets/profile-avatars/rabbit.svg';
import tiger from '../assets/profile-avatars/tiger.svg';

export const PROFILE_AVATAR_SOURCES = {
  bear,
  cat,
  dog,
  fox,
  frog,
  hamster,
  koala,
  lion,
  panda,
  pig,
  rabbit,
  tiger
};

export function profileAvatarSource(avatar) {
  if (avatar?.type === 'image') return avatar.value;
  if (avatar?.type === 'preset') return PROFILE_AVATAR_SOURCES[avatar.value] || '';
  return '';
}
