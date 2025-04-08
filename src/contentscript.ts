import log from 'loglevel';
import { VideoPlayerContainer } from './video_player_container';

if (process.env.NODE_ENV === 'production') {
    log.setDefaultLevel(log.levels.ERROR);
} else {
    log.setDefaultLevel(log.levels.DEBUG);
}

const videoElement = document.querySelector('.video-player video');

const runExtension = (event: Event) => {
    event.stopPropagation();
    new VideoPlayerContainer().run();
    videoElement.removeEventListener('canplay', runExtension);
};

videoElement.addEventListener('canplay', runExtension);

