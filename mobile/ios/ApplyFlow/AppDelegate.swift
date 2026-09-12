import BackgroundTasks
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import UIKit
import UserNotifications

@main
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  private let watchTaskId = "com.theofanis.applyflow.watch"
  private let watchBases = [
    "http://192.168.100.45:8787",
    "http://192.168.100.37:8787",
    "http://100.97.186.113:8787",
  ]

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    UNUserNotificationCenter.current().delegate = self
    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }

    BGTaskScheduler.shared.register(forTaskWithIdentifier: watchTaskId, using: nil) { task in
      guard let refresh = task as? BGAppRefreshTask else {
        task.setTaskCompleted(success: false)
        return
      }
      self.handleWatch(task: refresh)
    }
    application.setMinimumBackgroundFetchInterval(UIApplication.backgroundFetchIntervalMinimum)
    scheduleWatch()

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "ApplyFlow",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }

  func applicationDidEnterBackground(_ application: UIApplication) {
    scheduleWatch()
  }

  func application(
    _ application: UIApplication,
    performFetchWithCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    checkDesk { completionHandler($0) }
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    completionHandler([.banner, .sound])
  }

  private func scheduleWatch() {
    let request = BGAppRefreshTaskRequest(identifier: watchTaskId)
    request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
    try? BGTaskScheduler.shared.submit(request)
  }

  private func handleWatch(task: BGAppRefreshTask) {
    scheduleWatch()
    var finished = false
    task.expirationHandler = {
      if !finished {
        task.setTaskCompleted(success: false)
      }
    }
    checkDesk { result in
      finished = true
      task.setTaskCompleted(success: result != .failed)
    }
  }

  private func checkDesk(completion: @escaping (UIBackgroundFetchResult) -> Void) {
    probe(index: 0, completion: completion)
  }

  private func probe(index: Int, completion: @escaping (UIBackgroundFetchResult) -> Void) {
    if index >= watchBases.count {
      completion(.failed)
      return
    }

    guard let url = URL(string: "\(watchBases[index])/watch") else {
      probe(index: index + 1, completion: completion)
      return
    }

    var request = URLRequest(url: url)
    request.timeoutInterval = 8
    URLSession.shared.dataTask(with: request) { data, response, _ in
      let status = (response as? HTTPURLResponse)?.statusCode ?? 0
      guard status == 200, let data else {
        self.probe(index: index + 1, completion: completion)
        return
      }
      self.handleWatchData(data, completion: completion)
    }.resume()
  }

  private func handleWatchData(_ data: Data, completion: @escaping (UIBackgroundFetchResult) -> Void) {
    struct WatchPayload: Decodable {
      let verdict: String
      let jobId: String?
      let title: String?
    }

    guard let payload = try? JSONDecoder().decode(WatchPayload.self, from: data) else {
      completion(.failed)
      return
    }

    let defaults = UserDefaults.standard
    let lastId = defaults.string(forKey: "applyflow.lastBidId")
    if payload.verdict == "BID", let jobId = payload.jobId, jobId != lastId {
      defaults.set(jobId, forKey: "applyflow.lastBidId")
      notifyBid(title: payload.title ?? "New listing")
      completion(.newData)
      return
    }
    if payload.verdict != "BID" {
      defaults.removeObject(forKey: "applyflow.lastBidId")
    }
    completion(.noData)
  }

  private func notifyBid(title: String) {
    let content = UNMutableNotificationContent()
    content.title = "ApplyFlow BID"
    content.body = title
    content.sound = .default
    let request = UNNotificationRequest(
      identifier: "applyflow.bid.\(UUID().uuidString)",
      content: content,
      trigger: nil
    )
    UNUserNotificationCenter.current().add(request)
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
