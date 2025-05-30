import browser from 'webextension-polyfill';

import { setTwitchClientId, setTwitchOauthToken } from './storageManager';

const headerActions: Record<string, (value: string) => void> = {
    'client-id': async (value: string) => {
        await setTwitchClientId(value);
    },
    authorization: async (value: string) => {
        if (value) {
            await setTwitchOauthToken(value);
            return;
        }

        await setTwitchOauthToken(null);
    },
};

browser.webRequest.onSendHeaders.addListener(
    async function (details) {
        if (details.requestHeaders) {
            for (const header of details.requestHeaders) {
                const headerName: string = header.name.toLocaleLowerCase();
                headerActions[headerName] &&
                    headerActions[headerName](header.value);
            }
        }
    },
    { urls: ['*://gql.twitch.tv/gql*'] },
    ['requestHeaders']
);
