import log from 'loglevel';
import { VideoPlayerContainer } from './video_player_container';

if (process.env.NODE_ENV === 'production') {
    log.setDefaultLevel(log.levels.ERROR);
} else {
    log.setDefaultLevel(log.levels.DEBUG);
}

new VideoPlayerContainer().run();
