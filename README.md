# ApplyFlow

Personal Upwork job desk for Theofanis Markou. Isolated React Native CLI app (no Expo) plus a small Node server.

## Isolation

This project must not share Metro, Pods, or Node modules with VoiceAction, Prepper, or any other RN app.

- Node: `nvm use` from the repo `.nvmrc` (`22.13.0`)
- Metro port: **8088** (other apps usually use 8081)
- Bundle ID: `com.theofanis.applyflow`
- CocoaPods live only in `mobile/ios/Pods`

Do not run another Metro on 8088. If VoiceAction is on 8081, both can run.

## Freelancer personal token

Upwork API access is blocked until the account has enough history. Live search uses Freelancer.com.

1. Generate a **production** personal token at [accounts.freelancer.com/settings/develop](https://accounts.freelancer.com/settings/develop)
2. Put it in `server/.env` as `FREELANCER_TOKEN=` — do not paste the token into chat
3. Tokens last 30 days; only one active token per environment
4. Check it: `cd server && npm run check:freelancer`

## Upwork API key

Still stored in `.env` for later. Do not resubmit while the account is below $25k / 90% JSS.

## Run on iPhone 14 Pro Max (Xcode)

```bash
cd /Users/fanis/AIProjects/cursor/applyflow
nvm use
cd mobile
npm install
cd ios && bundle install && bundle exec pod install && cd ..
npm start
```

In a second terminal:

```bash
cd /Users/fanis/AIProjects/cursor/applyflow/mobile
nvm use
npx react-native run-ios --port 8088 --device
```

Or open `mobile/ios/ApplyFlow.xcworkspace` in Xcode, select the 14 Pro Max, Run. Metro must already be on **8088**.

Server (optional for the first device test — mocks are inside the app):

```bash
cd /Users/fanis/AIProjects/cursor/applyflow/server
nvm use
npm install
npm run dev
```
