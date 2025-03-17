# Twitch Radio Mode Chrome Extension

This extension for Google Chrome and Firefox, it lets the users play the stream in radio mode.

Korean version of README can be found [here](https://github.com/c-rainbow/twitch-audio-web/blob/master/readme/README.ko.md).
한국어 설명서는 [여기](https://github.com/c-rainbow/twitch-audio-web/blob/master/readme/README.ko.md)로

## Use

After installing the extension, go to a Twitch channel webpage. You will see a radio icon next to the volume slider in the video player area.

![Radio mode button](https://raw.githubusercontent.com/c-rainbow/twitch-audio-web/master/public/images/radiobutton.png)

Clicking the icon will start playing the audio_only stream, and the icon becomes yellow.

![Radio mode on](https://raw.githubusercontent.com/c-rainbow/twitch-audio-web/master/public/images/radiomode.png)

The volume can be adjusted in the same way as the video, using the same volume slider.

If you want to pause, just click the radio icon one more time. The audio will automatically stop if the video is played.


## Install

WIP

## Development

The extension is created with TypeScript and uses Webpack to build the code.

Please install webpack and other dependencies for the project.

```
yarn
```
### Chrome

#### Development
```
yarn build
```

#### Production
```
yarn build:prod
```

#### Load Extension

- In Google Chrome, go to chrome://extensions
- On the top right, enable "Developer Mode"
- Click "Load Unpacked" and select <source_directory>/release.

### Firefox

#### Development
```
WIP
```

#### Production
```
yarn build:firefox:prod
```

#### Load Extension

- In Firefox, go to about:debugging
- On the top left, select "This Firefox"
- Click "Load Temporary Add-on..." and select <source_directory>/release_firefox.
