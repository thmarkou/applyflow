# ApplyFlow

Personal Upwork job desk for Theofanis Markou. Isolated React Native CLI app (no Expo) plus a small Node server.

## Isolation

This project must not share Metro, Pods, or Node modules with VoiceAction, Prepper, or any other RN app.

- Node: `nvm use` from the repo `.nvmrc` (`22.13.0`)
- Metro port: **8088** (other apps usually use 8081)
- Bundle ID: `com.theofanis.applyflow`
- CocoaPods live only in `mobile/ios/Pods`

Do not run another Metro on 8088. If VoiceAction is on 8081, both can run.

## Upwork API key

Do not paste the client secret into chat.

1. Copy `server/.env.example` to `server/.env`
2. Put `UPWORK_CLIENT_ID` and `UPWORK_CLIENT_SECRET` there
3. Keys stay **Disabled** until Upwork review finishes — the app uses mock jobs until then
4. Callback already registered: `https://theofanis-markou.vercel.app/oauth/upwork/callback`

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
