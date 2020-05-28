

import {getChannelFromWebUrl} from "./url_utils";
import "./usher_url";
import "./fetch";
import { Hls } from "./hls.js";


// TODO: Any better way than HTML as string?
var initialButtonDom = `
<div class="tw-inline-flex tw-relative tw-tooltip-wrapper">
    <button class="audio-only-button audio-only-inactive tw-align-items-center tw-align-middle tw-border-bottom-left-radius-medium tw-border-bottom-right-radius-medium tw-border-top-left-radius-medium tw-border-top-right-radius-medium tw-button-icon tw-button-icon--overlay tw-core-button tw-core-button--overlay tw-inline-flex tw-interactive tw-justify-content-center tw-overflow-hidden tw-relative"
            data-a-target="audio-only-button"
            data-a-player-state="video"
            aria-label="Audio only">
        <div class="tw-align-items-center tw-flex tw-flex-grow-0">
            <span class="tw-button-icon__icon">
                <div style="width: 2rem; height: 2rem;">
                    <svg class="tw-icon__svg audio_only_icon" width="100%" height="100%"
                            version="1.1" xmlns="http://www.w3.org/2000/svg" x="0px" y="0px"
                            viewBox="0 0 100 100">
                    
                    </svg>
                </div>
            </span>
        </div>
    </button>
    <div class="tw-tooltip tw-tooltip--align-left tw-tooltip--up" data-a-target="tw-tooltip-label" role="tooltip">
        Audio only
    </div>
</div>
`;
   
var inactiveRect = '<rect width="100" height="100" style="fill:#CCCCCC" />';
var activeRect = '<rect width="100" height="100" style="fill:#00CC55" />';





const videoPlayerClass = "video-player";
const videoPlayerProcessedClass = "video-player-processed";
const controlGroupClass = "player-controls__left-control-group";
const playButtonAttr = "button[data-a-target='player-play-pause-button']";
const volumnSliderAttr = "button[data-a-target='player-volume-slider']";

/**
 * VideoPlayer class
 * 1. create(element)
 *      1-1. MutationObserver for DOM change, wait for the player/pause button
 *      1-2. 
 * 2. play(url)
*       3-1. Get video url, and then
*       3-2-1-1. Pause the video play/pause button if necessary,
*                by clicking the video play/pause button
*       3-2-1-2. Get audio_only video url
*       3-2-1-3. If url is null, not do anything
*       3-2-1-3. Create Hls, attach the <audio> element, startLoad the url, play.
*       3-2-1-4. Stop all videos or audios in other video-player elements, if exists.
*       3-2-1-5. Change audio-only button to "activated"
 * 3. pause()
 *      3-2-2. If clicked from play to pause
*              3-2-2-1. Pause the audio, stopLoad, detach the element (if necessary),
*                       destroy Hls (if necessary)
*              3-2-2-2. Change audio-only button to "deactivated"
 * 4. destroy()
 * 
 * 
 * 
 */
class VideoPlayer {
    playerId: string;
    container: VideoPlayerContainer;
    playerElem: HTMLElement;
    controlGroupElem: HTMLElement;
    playButtonElem: HTMLElement;
    volumeSliderElem: HTMLElement;
    hls: typeof Hls;
    audioElem: HTMLAudioElement;
    playButtonObserver: MutationObserver;
    volumeObserver: MutationObserver;

    constructor(
            playerId: string,
            container: VideoPlayerContainer,
            playerElem: HTMLElement,
            controlGroupElem: HTMLElement,
            playButtonElem: HTMLElement,
            volumeSliderElem: HTMLElement) {
        this.playerId = playerId;
        this.container = container;
        this.playerElem = playerElem;
        this.controlGroupElem = controlGroupElem;
        this.playButtonElem = playButtonElem;
        this.volumeSliderElem = volumeSliderElem;
    }

    run() {
        this.hls = new Hls({
            //debug: true,
            liveSyncDuration: 0,
            liveMaxLatencyDuration: 5,
            liveDurationInfinity: true  // true for live stream
        });

        // Create a separate <audio> tag to play audio
        this.audioElem = document.createElement("audio");
        this.audioElem.style.display = "none";
        this.playerElem.appendChild(this.audioElem);
        this.populateComponents();
    }

    populateComponents() {
        this.appendAudioOnlyButton();

        const buttonConfig = { attributes: true, childList: false, subtree: false };
            
        // MutationObserver to playButtonElem
        let playButtonCallback: MutationCallback = function(mutationList, observer) {
            const state = this.playButtonElem.getAttribute("data-a-player-state");
            if(state == "playing") {  // From paused to playing
                this.pause();  // Pause audio
            }                
        }
        this.playButtonObserver = new MutationObserver(playButtonCallback);
        this.playButtonObserver.observe(this.playButtonElem, buttonConfig);
        
        // MutationObserver to volumeSlider
        let volumeChangeCallback: MutationCallback = function(mutationList, observer) {
            const volume = this.volumeSliderElem.value;
            this.audioElem.volume = volume;
        }
        this.volumeObserver = new MutationObserver(volumeChangeCallback);
        this.volumeObserver.observe(this.volumeSliderElem, buttonConfig);
    }

    play(mediaUrl: string) {
        if(!mediaUrl) {
            console.log("No mediaUrl is found to play")
            return;
        }
        this.hls.loadSource(mediaUrl);
        this.hls.attachMedia(this.audioElem); 
        this.hls.on(Hls.Events.MANIFEST_PARSED, function() {
            this.audioElem.play().then(function() {
                console.log("Play started");
            });
        });
    }

    pause() {
        if(this.hls) {
            this.audioElem.pause();
            this.hls.stopLoad();
            this.hls.detachMedia();
        }
    }

    destroy() {  // What else to do here?
        this.pause();
        this.playButtonObserver.disconnect();
        this.volumeObserver.disconnect();
    }

    appendAudioOnlyButton() {
        // TODO: Use webpack html loader
        // TODO: Disable the button in clip and (also VOD?)
        let buttonWrapperDom = document.createElement("div")
        buttonWrapperDom.innerHTML = initialButtonDom;
    
        let svgDom = buttonWrapperDom.getElementsByClassName("tw-icon__svg")[0]
        svgDom.innerHTML = inactiveRect;
        this.controlGroupElem.appendChild(buttonWrapperDom);
        return buttonWrapperDom;
    }

    requestPlay() {
        const channel = getChannelFromWebUrl(); 
        chrome.runtime.sendMessage({message: "get_audio_url", channel: channel}, function(response) {
            this.container.pauseExcept(this.playerId);
            this.play(response.audioStreamUrl);
        }); 
    }
}




/**
 * VideoPlayerContainer
 *  1. CreateNewPlayer(element)
 *      1-1. create a new VideoPlayer object with the element
 *  2. PauseAll(playerId) 
 *      2-1. Iterate all elements managed by this manager
 *      2-2. If the element does not match the argument (differnet ID?), call pause()
 *  3. Play(playerId)
 *      3-1. Call PauseAll(playerId)
 *      3-2. Iterate all elements managed by this manager
 *          3-2-1. If its ID matches playerId, play()

 *      3-1. Get video url, and then
 *      3-2-1-1. Pause the video play/pause button if necessary,
 *               by clicking the video play/pause button
 *      3-2-1-2. Get audio_only video url
 *      3-2-1-3. If url is null, not do anything
 *      3-2-1-3. Create Hls, attach the <audio> element, startLoad the url, play.
 *      3-2-1-4. Stop all videos or audios in other video-player elements, if exists.
 *      3-2-1-5. Change audio-only button to "activated"
 */
export default class VideoPlayerContainer {
    players: VideoPlayer[];
    nextId: number;
    observer: MutationObserver;


    constructor() {
        this.players = [];
        this.nextId = 10001;  // Random start index for player.
    }

    run() {
        // Find existing video player elements to create VideoPlayer objects
        this.findVideoPlayerElems();

        // Detect future video player elements
        const config = { attributes: false, childList: true, subtree: true };
        this.observer = new MutationObserver(this.findVideoPlayerElems);
        this.observer.observe(document.body, config);
    }

    findVideoPlayerElems() {
        // TODO: Is it better to iterate only the mutated divs?
        const playerElems = document.body.getElementsByClassName(videoPlayerClass);
        for(let playerElem of playerElems) {
            this.tryCreatingNewPlayer(playerElem as HTMLElement);
        }
    }

    tryCreatingNewPlayer(playerElem: HTMLElement) {
        // Check if all required DOMs are ready
        let controlGroupElems = playerElem.getElementsByClassName(controlGroupClass);
        if(!controlGroupElems) {
            return;
        }
        let playButtonElem = playerElem.querySelector(playButtonAttr);
        let volumeSliderElem = playerElem.querySelector(volumnSliderAttr);
        if(!playButtonElem || !volumeSliderElem) {
            return;
        }

        // All required DOMs are ready.
        const newPlayerId = videoPlayerProcessedClass + "-" + this.nextId;
        this.nextId += 1;
        playerElem.classList.add(videoPlayerProcessedClass);
        playerElem.classList.add(newPlayerId);

        const controlGroupElem = controlGroupElems[0] as HTMLElement

        let player = new VideoPlayer(
            newPlayerId, this, playerElem, controlGroupElem, playButtonElem as HTMLElement,
            volumeSliderElem as HTMLElement);
        this.players.push(player);
    }

    pauseExcept(playerId: string) {
        for(let player of this.players) {
            if(player.playerId != playerId) player.pause();
        }
    }

    destroy() {
        this.observer.disconnect();
        for(let player of this.players) {
            player.destroy();
        }
        this.players = [];
    }
}




//chrome.onTabUpdate()