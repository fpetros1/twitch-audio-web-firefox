import browser from 'webextension-polyfill';

import log from 'loglevel';
import { tryFetchingPlaylist } from './fetch';
import { getChannelFromWebUrl, parseAudioOnlyUrl } from './url';
import Hls from 'hls.js';

// TODO: Any better way than HTML as string?
const initialButtonDom = `
<div class="tw-inline-flex tw-relative tw-tooltip__container radio-mode-button-wrapper">
    <button class="radio-mode-button tw-align-items-center tw-align-middle tw-border-bottom-left-radius-medium tw-border-bottom-right-radius-medium tw-border-top-left-radius-medium tw-border-top-right-radius-medium tw-button-icon tw-button-icon--overlay tw-core-button tw-core-button--overlay tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative"
            data-a-target="radio-mode-button"
            data-radio-mode-state="disabled"
            aria-label="Radio Mode">
        <div class="tw-align-items-center tw-flex tw-flex-grow-0">
            <span class="tw-button-icon__icon">
                <div class="button-icon-div" style="width: 2rem; height: 2rem;">
                    <!-- Google Material Design Radio Icon. Apache License v2.0 -->
                    <svg class="tw-icon__svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%">
                        <path d="M0 0h24v24H0z" fill="none"/>
                        <path d="M3.24 6.15C2.51 6.43 2 7.17 2 8v12c0 1.1.89 2 2 2h16c1.11 0 2-.9 2-2V8c0-1.11-.89-2-2-2H8.3l8.26-3.34L15.88 1 3.24 6.15zM7 20c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm13-8h-2v-2h-2v2H4V8h16v4z"/>
                    </svg>
                </div>
            </span>
        </div>
    </button>
    <div class="radio-tooltip radio-tooltip--align-left radio-tooltip--up" data-a-target="tw-tooltip-label" role="tooltip" direction="top">
        Radio mode
    </div>
</div>
`;

const processedAttr = 'data-radio-mode-processed';
const processedAttrVal = 'processed';

const videoPlayerStateAttr = 'data-a-player-state';

const radioModeStateAttr = 'data-radio-mode-state';
const playerIdAttr = 'data-radio-mode-player-id';

const videoPlayerClass = 'video-ref';
const videoPlayerProcessedClass = 'video-ref-processed';
const videoPlayerIdPrefix = videoPlayerProcessedClass + '-';
const controlGroupClass = 'player-controls__left-control-group';
const playButtonAttr = "button[data-a-target='player-play-pause-button']";
const volumeSliderAttr = "input[data-a-target='player-volume-slider']";

const attrObserverConfig = {
    attributes: true,
    childList: false,
    subtree: false,
};
const domObserverConfig = { attributes: false, childList: true, subtree: true };

/**
 * Create VideoPlayerContainer, add MutationObserver to
 * 1. document.body checks for one subtree change
 *   1-2. If div with class "video-ref", process it. Check #2
 *
 * 2. Create VideoPlayer, video-ref class div checks for 1 attribute change, 3 subtree changes
 *   2-1. attribute "data-a-player-type": "site", "site_mini", "clips-watch", "channel_home_carousel"
 *     2-2-2. Change the mode of VideoPlayer if necessary
 *     2-2-3. Mode: Tuple of (layout, video_type).
 *       2-2-3-1. layout: "site" | "site_mini"
 *       2-2-3-2. video_type: "live", "vod", "clip".. and more?????
 *   2-2. subtree div with class "vod-seekbar-time-labels" and "seekbar-interaction-area"
 *     2-2-1. This only appears in VOD watch
 *     2-2-2. If created, change the mode of VideoPlayer to VOD
 *     2-2-3. If removed (changed from VOD to live/clip), ????
 *   2-3. check for control group "player-controls__left-control-group"
 *     2-3-1. If created, check #3 for actions
 *     2-3-2. If removed, ?????
 *   2-4. check for "video" element in the player
 *     2-4-1. If created, check #6 for actions
 *     2-4-2. If removed, ?????
 *
 * 3. Control group "player-controls__left-control-group" checks for
 *   3-1. subtree button[data-a-target='player-play-pause-button'] for video play/pause button
 *     3-1-1. If created, check #4
 *     3-1-2. If removed (when player type changed from "site" to "site_mini", etc), ?????
 *   3-2. subtree input[data-a-target='player-volume-slider'] for volume slider
 *     3-2-1. If created, check #5
 *     3-2-2. If removed (when player type changed from "site" to "site_mini", etc), ?????
 *   3-3. If both components in 3-1 and 3-2 are ready:
 *     3-3-1. Create radio mode button, and put MutationObserver (see #4 and #5)
 *     3-3-2. If at least one component is removed (site->site_mini change, etc)
 *       3-3-2-1. also remove the radio mode button from DOM
 *
 * 4. Video play/pause button checks for
 *   4-1. Attribute change videoPlayerStateAttr: "playing" or "paused"
 *     4-1-1. If attribute value changed to "playing", stop all audio in the VideoPlayerContainer
 *
 * 5. Volume slider checks for
 *   5-1. Attribute "value" change: number between 0 <= num <= 1
 *     5-1-1. If change is detected, apply the new volume to audioElem.
 *
 * 6. original "video" element in video-player checks for
 *   6-1. Attribute "src" change: means that the video source changed (likely hosting another streamer)
 *     6-1-1. Radio mode button should be disabled? Re-configured with the new streamer's URL?
 *
 */

/**
 * How to detect the channel of the stream being played?
 * Getting channel name from URL has the folllowing issues
 * (1) Streamer hosting another channel
 * (2) Main page. Channel can change quickly in the carousel
 *
 * Proposed solution:
 * (1) Keep the last requested usher URL in the tab. Guess the channel from there
 * (2) For "site_mini" state, store the channel name in video player.
 *     In that case, it will be possible to resume playing in the right channel.
 * (3) Disable the radio mode button in the main page
 *
 */

/**
 * Add radio mode button in site_mini?
 * Don't store the playstate in DOM: only store it in VideoPlayer class as the single source of truth
 */

/**
 * ESports page: video miniplayer keeps playing even when the site player in Esports page is also being played.
 * Should the radio mode follow the same behavior?
 */

/**
 * Access token url has oauth code, which is undefined if the user is not logged in.
 * Not sure how Twitch returns correct response for anonymous user yet.
 * Calling the same access token URL from contentscript returns error.
 *
 * Proposed solution:
 * (1) Disable the button when user is not logged in.
 */

const enum PlayingState {
    DISABLED = 'disabled',
    PAUSED = 'paused',
    PLAYING = 'playing',
}

function isProcessed(element: Element): boolean {
    return element?.getAttribute(processedAttr) === processedAttrVal;
}

function markProcessed(element: Element) {
    element?.setAttribute(processedAttr, processedAttrVal);
}

class ControlGroup {
    controlGroupElem: HTMLElement;
    player: VideoPlayer;
    playButtonElem: HTMLElement;
    volumeSliderElem: HTMLInputElement;
    radioButton: HTMLElement;
    tooltipElem: HTMLElement;
    componentsObserver: MutationObserver;
    playButtonObserver: MutationObserver;
    volumeObserver: MutationObserver;

    constructor(player: VideoPlayer, controlGroupElem: HTMLElement) {
        this.player = player;
        this.controlGroupElem = controlGroupElem;

        this.tryUpdatingComponents();
        this.componentsObserver = new MutationObserver(
            this.tryUpdatingComponents.bind(this)
        );
        this.componentsObserver.observe(
            this.controlGroupElem,
            domObserverConfig
        );
    }

    tryUpdatingComponents() {
        // Check for new Play/Audio button and volume slider
        const playButtonElem: HTMLButtonElement =
            this.controlGroupElem.querySelector(playButtonAttr);
        this.tryUpdatingPlayButtonElem(playButtonElem);
        const volumeSliderElem: HTMLInputElement =
            this.controlGroupElem.querySelector(volumeSliderAttr);
        this.tryUpdatingVolumesliderElem(volumeSliderElem);
        // Add the radio button if not exists
        this.tryUpdatingRadioButton();
    }

    tryUpdatingPlayButtonElem(playButtonElem: HTMLButtonElement) {
        // play button cannot be found in the control group. Remove reference to the deleted node
        if (!playButtonElem) {
            this.playButtonObserver?.disconnect();
            this.playButtonElem = null;
            return;
        }

        // This element was already added to this.playButtonElem. Ignore.
        if (isProcessed(playButtonElem)) {
            return;
        }
        markProcessed(playButtonElem);

        // If exists, remove the existing one
        if (this.playButtonElem) {
            this.playButtonObserver?.disconnect();
            this.playButtonElem = null;
        }

        this.playButtonElem = playButtonElem;
        // Pause audio in all players if a video starts to play.
        // This is necesasry for a case when user browses to a non-channel page (e.g. main, esports)
        // which automatically plays a video.
        this.pauseAudioForVideo();
        this.playButtonObserver = new MutationObserver(
            this.pauseAudioForVideo.bind(this)
        );
        this.playButtonObserver.observe(
            this.playButtonElem,
            attrObserverConfig
        );
    }

    pauseAudioForVideo() {
        const state = this.playButtonElem.getAttribute(videoPlayerStateAttr);
        if (state === 'playing') {
            // Video state from paused to playing
            this.player.pauseAll(); // Pause audio in all player instances
        }
    }

    adjustVolume() {
        if (this.player.audioElem && this.volumeSliderElem) {
            const volume = this.volumeSliderElem.value;
            this.player.audioElem.volume = parseFloat(volume);
        }
    }

    tryUpdatingVolumesliderElem(volumeSliderElem: HTMLInputElement) {
        // volume slider cannot be found in the control group. Remove reference to the deleted node
        if (!volumeSliderElem) {
            this.volumeObserver?.disconnect();
            this.volumeSliderElem = null;
            return;
        }

        // This element was already added to this.volumeSliderElem. Ignore.
        if (isProcessed(volumeSliderElem)) {
            return;
        }
        markProcessed(volumeSliderElem);

        // If exists, remove the existing one
        if (this.volumeSliderElem) {
            this.volumeObserver?.disconnect();
            this.volumeSliderElem = null;
        }

        this.volumeSliderElem = volumeSliderElem;
        // MutationObserver to volumeSlider
        this.volumeObserver = new MutationObserver(
            this.adjustVolume.bind(this)
        );
        this.volumeObserver.observe(this.volumeSliderElem, attrObserverConfig);
    }

    tryUpdatingRadioButton() {
        // Don't proceed unless both playButtonElem and volumeSliderElem are available
        if (!this.playButtonElem || !this.volumeSliderElem) {
            return;
        }

        // If the button was already created, do nothing
        if (isProcessed(this.radioButton)) {
            return;
        }

        // TODO: Use webpack html loader
        const buttonWrapperDom = document.createElement('div');
        buttonWrapperDom.innerHTML = initialButtonDom;
        this.radioButton = buttonWrapperDom.getElementsByTagName('button')[0];
        markProcessed(this.radioButton);

        // Update radio button state
        const playingState = this.player.playingState;
        this.radioButton.setAttribute(
            radioModeStateAttr,
            this.player.playingState
        );
        this.radioButton.onclick = this.player.onRadioButtonClicked.bind(
            this.player
        );

        this.tooltipElem = buttonWrapperDom.getElementsByClassName(
            'radio-tooltip'
        )?.[0] as HTMLElement;
        this.updateTooltipText(playingState);

        this.controlGroupElem.appendChild(buttonWrapperDom);
    }

    updateForPlay() {
        // NOTE: There is 1~3 seconds of delay between radio-mode button click and sound being played.
        // It's better to show some intermediate state (icon change, mouse cursor change, etc) in the meanwhile

        // Change the radio button icon
        this.radioButton?.setAttribute(
            radioModeStateAttr,
            PlayingState.PLAYING
        );
        this.updateTooltipText(PlayingState.PLAYING);
    }

    updateForPause() {
        // Change the radio button icon
        this.radioButton?.setAttribute(radioModeStateAttr, PlayingState.PAUSED);
        this.updateTooltipText(PlayingState.PAUSED);
    }

    updateForDisabled() {
        // Change the radio button icon
        this.radioButton?.setAttribute(
            radioModeStateAttr,
            PlayingState.DISABLED
        );
        this.updateTooltipText(PlayingState.DISABLED);
    }

    updateTooltipText(newState: PlayingState) {
        if (!this.tooltipElem) {
            return;
        }

        let text = 'Radio mode';
        if (newState === PlayingState.DISABLED) {
            text = browser.i18n.getMessage('RADIO_MODE_DISABLED');
        } else if (newState === PlayingState.PAUSED) {
            text = browser.i18n.getMessage('RADIO_MODE_START');
        } else if (newState === PlayingState.PLAYING) {
            text = browser.i18n.getMessage('RADIO_MODE_END');
        } else {
            log.debug('updateTooltipText for state ' + newState);
        }
        this.tooltipElem.textContent = text;
    }

    destroy() {
        this.componentsObserver?.disconnect();
        this.playButtonObserver?.disconnect();
        this.volumeObserver?.disconnect();
        // Is this necessary?
        this.controlGroupElem = null;
        this.player = null;
        this.playButtonElem = null;
        this.volumeSliderElem = null;
        this.radioButton = null;
        this.tooltipElem = null;
        this.componentsObserver = null;
        this.playButtonObserver = null;
        this.volumeObserver = null;
    }
}

class VideoPlayer {
    playerId: string;
    container: VideoPlayerContainer;
    playerElem: HTMLElement;
    playingState: PlayingState;
    attributeObserver: MutationObserver;
    controlGroup: ControlGroup;
    controlGroupObserver: MutationObserver;
    hls: Hls;
    audioElem: HTMLAudioElement;
    videoElem: HTMLVideoElement;
    videoElemObserver: MutationObserver;

    constructor(
        playerId: string,
        container: VideoPlayerContainer,
        playerElem: HTMLElement
    ) {
        this.playerId = playerId;
        this.container = container;
        this.playerElem = playerElem;
        this.playingState = getChannelFromWebUrl()
            ? PlayingState.PAUSED
            : PlayingState.DISABLED;

        this.tryUpdatingComponents();
        this.controlGroupObserver = new MutationObserver(
            this.tryUpdatingComponents.bind(this)
        );
        this.controlGroupObserver.observe(this.playerElem, domObserverConfig);
    }

    tryUpdatingComponents() {
        this.tryUpdatingControlGroup();
        this.tryObservingVideoElem();
    }

    tryUpdatingControlGroup() {
        // Check if the control group DOM is ready
        const controlGroupElem =
            this.playerElem.getElementsByClassName(controlGroupClass)?.[0];
        if (!controlGroupElem) {
            // control group cannot be found in DOM
            this.controlGroup?.destroy(); // destroy reference to the removed DOM
            this.controlGroup = null;
            return;
        }

        // Add processed class name to prevent duplicate processing of this element
        if (isProcessed(controlGroupElem)) {
            return;
        }
        markProcessed(controlGroupElem);

        this.controlGroup?.destroy();
        this.controlGroup = new ControlGroup(
            this,
            controlGroupElem as HTMLElement
        );
    }

    tryObservingVideoElem() {
        const videoElem = this.playerElem.getElementsByTagName('video')?.[0];
        
        if (!videoElem) {
            this.videoElem = null;
            return;
        }

        const setupVideoElemObserver = () => {
            videoElem.removeEventListener('canplay', setupVideoElemObserver);

            if (!this.videoElemObserver) {
                const callback: MutationCallback = function (
                    mutations: MutationRecord[]
                ) {
                    for (let mutation of mutations) {
                        if (mutation.attributeName == 'src') {
                            this.updateStatus();
                        }
                    }
                };
                this.videoElemObserver = new MutationObserver(callback.bind(this));
            }


            if (isProcessed(videoElem)) {
                return;
            }
            this.videoElem = videoElem;
            markProcessed(this.videoElem);

            this.videoElemObserver.observe(this.videoElem, attrObserverConfig);
        }

        videoElem.addEventListener('canplay', setupVideoElemObserver);
    }

    updateStatus() {
        const channel = getChannelFromWebUrl();
        if (channel) {
            this.enable();
        } else {
            this.disable();
        }
    }

    enable() {
        const state = this.playingState;
        if (state === PlayingState.DISABLED) {
            this.pauseFromDisabled();
        }
    }

    disable() {
        if (this.playingState === PlayingState.DISABLED) {
            return;
        }
        if (this.playingState === PlayingState.PLAYING) {
            this.pause();
        }
        this.playingState = PlayingState.DISABLED;
        this.controlGroup?.updateForDisabled();
    }

    play(mediaUrl: string) {
        if (this.playingState !== PlayingState.PAUSED) {
            return;
        }

        if (!mediaUrl) {
            log.debug('No mediaUrl is found to play');
            return;
        }

        if (this.audioElem) {
            log.debug('Audio element already exists');
            return;
        }

        // Create a separate <video> element to play audio.
        // <audio> can be also used by hls.js, but Typescript forces this to be HTMLVideoElement.
        const startTime = Date.now();
        this.audioElem = document.createElement('audio');
        this.audioElem.classList.add('nodisplay');
        this.controlGroup?.adjustVolume(); // Match the initial volume with the slider value.
        this.playerElem.appendChild(this.audioElem);
        this.hls = new Hls({
            //debug: true,
            // backBufferLength: 1,
            // maxLoadingDelay: 2,
            // maxMaxBufferLength: 5,
            liveSyncDuration: 3,
            enableWorker: true,
            lowLatencyMode: true,
            liveDurationInfinity: true, // true for live stream
        });
        //this.hls.loadSource(mediaUrl);
        this.hls.attachMedia(this.audioElem);
        this.hls.on(
            Hls.Events.MEDIA_ATTACHED,
            function () {
                log.debug('Audio and hls.js are now bound together !');
                this.hls.loadSource(mediaUrl);
            }.bind(this)
        );
        // TODO: Is this safe to play right away after attaching the media?
        // The main example at hls.js website tells to use MANIFEST_PARSED event,
        // but for some reason the event is not triggered with typescript+webpack.
        const audioPlayCallback = function () {
            log.info('Play started');
            this.controlGroup?.updateForPlay();
            log.debug('Time to start playing:', Date.now() - startTime, 'ms');
        };
        this.controlGroup.radioButton.setAttribute(
            radioModeStateAttr,
            'loading'
        );
        this.audioElem.play().then(audioPlayCallback.bind(this));
        this.playingState = PlayingState.PLAYING;

        // Stop the video if playing
        this.pauseVideo();
        //this.controlGroup?.updateForPlay();
    }

    pauseFromDisabled() {
        const state = this.playingState;
        if (state !== PlayingState.DISABLED) {
            return;
        }
        this.playingState = PlayingState.PAUSED;
        this.controlGroup?.updateForPause();
    }

    pause() {
        const state = this.playingState;
        if (state === PlayingState.PAUSED || state === PlayingState.DISABLED) {
            return;
        }
        if (this.hls) {
            try {
                this.audioElem.pause();
            } catch (err) {
                // "DOMException: The play() request was interrupted by a call to pause()"
                // is thrown when user pauses the audio too quickly after playing.
                // No action is needed. The audio will be paused correctly anyway.
            }
            this.hls.stopLoad();
            this.hls.detachMedia();
            this.hls.destroy();
            // There seems to be a bug that the HLS object gets stuck after multiple plays and pauses
            // if it is re-used for the next play. Need to destroy the object and re-create it.
            this.hls = null;
            this.playerElem.removeChild(this.audioElem);
            this.audioElem = null;
        }
        this.playingState = PlayingState.PAUSED;
        this.controlGroup?.updateForPause();

        const onPause = function (result: any) {
            if (result.autoplay) {
                this.playVideo();
            }
        };
        browser.storage.local.get(['autoplay']).then(onPause.bind(this));
    }

    playVideo() {
        this.toggleVideoStateIf('paused');
    }

    pauseVideo() {
        this.toggleVideoStateIf('playing');
    }

    toggleVideoStateIf(expectedState: string) {
        const videoPlayButton = this.controlGroup?.playButtonElem;
        const videoState = videoPlayButton?.getAttribute(videoPlayerStateAttr);
        if (videoState === expectedState) {
            videoPlayButton.click();
        }
    }

    // Pause audio in all players
    pauseAll() {
        this.container.pauseExcept(null);
    }

    destroy() {
        // What else to do here?
        this.disable();
        this.controlGroup?.destroy();
    }

    async requestPlay() {
        const channel = getChannelFromWebUrl();
        if (!channel) {
            // Currently in a non-channel page. Disable
            this.disable();
            return;
        }

        const playlist = await tryFetchingPlaylist(channel);
        if (!playlist) {
            // Offline or hosting another channel. Disable
            this.disable();
            return;
        }

        const audioStreamUrl = parseAudioOnlyUrl(playlist);
        if (audioStreamUrl) {
            this.container.pauseExcept(this.playerId);
            this.play(audioStreamUrl);
        }
    }

    onRadioButtonClicked() {
        switch (this.playingState) {
            case PlayingState.DISABLED:
                break;
            case PlayingState.PAUSED:
                this.requestPlay();
                break;
            case PlayingState.PLAYING:
                this.pause();
                break;
        }
    }
}

export class VideoPlayerContainer {
    players: VideoPlayer[];
    nextId: number;
    observer: MutationObserver;

    constructor() {
        this.players = [];
        this.nextId = 10001; // Random start index for player.
    }

    run() {
        // Find existing video player elements to create VideoPlayer objects
        this.updateVideoPlayerList();
        // Detect future video player elements
        const mainElem = document.getElementsByTagName('main')[0];
        this.observer = new MutationObserver(
            this.updateVideoPlayerList.bind(this)
        );
        this.observer.observe(mainElem, domObserverConfig);
    }

    updateVideoPlayerList() {
        // TODO: Is it better to iterate only the mutated divs?
        const playerElems =
            document.body.getElementsByClassName(videoPlayerClass);
        for (let playerElem of playerElems) {
            // If the div is not already processed
            if (!isProcessed(playerElem)) {
                log.debug('New video player detected');
                this.createNewPlayer(playerElem as HTMLElement);
            }
        }

        // No need to proceed if there are the same number of players in the list and in DOM.
        if (playerElems.length === this.players.length) {
            return;
        }

        this.garbageCollectPlayers(playerElems);
    }

    // Remove video players not in DOM anymore.
    // This happens when a user browses from a non-channel page (main, directory, etc.) to a channel page,
    // or between non-channel pages.
    garbageCollectPlayers(playerElems: HTMLCollectionOf<Element>) {
        const allPlayerIdsInDom: string[] = [];
        for (let playerElem of playerElems) {
            allPlayerIdsInDom.push(playerElem.getAttribute(playerIdAttr));
        }
        log.debug('All playerIds in DOM: ' + allPlayerIdsInDom);

        const newlist = [];
        for (let player of this.players) {
            const playerId = player.playerId;
            if (allPlayerIdsInDom.indexOf(playerId) != -1) {
                newlist.push(player);
            } else {
                log.debug(
                    `Player ${playerId} is not in DOM anymore. Deleting..`
                );
                player.destroy();
            }
        }
        this.players = newlist;
    }

    createNewPlayer(playerElem: HTMLElement) {
        if (isProcessed(playerElem)) {
            return;
        }
        markProcessed(playerElem);

        const newPlayerId = videoPlayerIdPrefix + this.nextId;
        this.nextId += 1;
        playerElem.setAttribute(playerIdAttr, newPlayerId);

        const player = new VideoPlayer(newPlayerId, this, playerElem);
        this.players.push(player);
    }

    pauseExcept(playerId: string) {
        for (let player of this.players) {
            if (player.playerId !== playerId) player.pause();
        }
    }

    destroy() {
        // Will this function ever be used?
        this.observer?.disconnect();
        this.observer = null;
        for (let player of this.players) {
            player.destroy();
        }
        this.players = [];
    }
}
