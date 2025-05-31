### This is a mirror. Check [main repository](https://codeberg.org/fpetros/twitch-audio-web-firefox) on Codeberg

# Twitch Radio Mode Firefox Extension

This extension for Firefox, it lets the users play the stream in radio mode(only audio).

### [Chrome Version](https://github.com/c-rainbow/twitch-audio-web)

## Install

<p align="left">
<a href="https://addons.mozilla.org/en-US/firefox/addon/twitch-radio-mode"><img src="https://user-images.githubusercontent.com/585534/107280546-7b9b2a00-6a26-11eb-8f9f-f95932f4bfec.png" alt="Get Twitch Radio Mode for Firefox"></a>
</p>

## Use

After installing the extension, go to a Twitch channel webpage. You will see a radio icon next to the volume slider in the video player area.

![Radio mode button](https://raw.githubusercontent.com/c-rainbow/twitch-audio-web/master/public/images/radiobutton.png)

Clicking the icon will start playing the audio_only stream, and the icon becomes yellow.

![Radio mode on](https://raw.githubusercontent.com/c-rainbow/twitch-audio-web/master/public/images/radiomode.png)

The volume can be adjusted in the same way as the video, using the same volume slider.

If you want to pause, just click the radio icon one more time. The audio will automatically stop if the video is played.

## Development

The extension is created with TypeScript and uses Webpack to build the code.

Please install webpack and other dependencies for the project.

```
pnpm
```

#### Development Build
```
pnpm build
```

#### Production Build
```
pnpm build:prod
```

#### Load Extension

- In Firefox, go to about:debugging
- On the top left, select "This Firefox"
- Click "Load Temporary Add-on..." and select <source_directory>/release_firefox.
