import AlarmKit
import AppIntents
import ExpoModulesCore
import SwiftUI
import UIKit

@available(iOS 26.1, *)
public struct WakeWordAlarmMetadata: AlarmMetadata {}

@available(iOS 26.1, *)
public struct WakeWordStopIntent: LiveActivityIntent {
  public static var title: LocalizedStringResource = "Stop WakeWord"
  public static var openAppWhenRun = false

  @Parameter(title: "Alarm ID") public var alarmID: String
  @Parameter(title: "Schedule token") public var token: String

  public init() {}
  public init(alarmID: String, token: String) {
    self.alarmID = alarmID
    self.token = token
  }

  public func perform() async throws -> some IntentResult {
    let defaults = UserDefaults.standard
    // Ignore an old stop action after the alarm has been rescheduled.
    if defaults.string(forKey: "wakeword.oneTimeToken.\(alarmID)") == token {
      defaults.set(token, forKey: "wakeword.dismissed.\(alarmID)")
    }
    return .result()
  }
}

@available(iOS 26.1, *)
public struct WakeWordSnoozeIntent: LiveActivityIntent {
  public static var title: LocalizedStringResource = "Snooze WakeWord"
  public static var openAppWhenRun = false

  @Parameter(title: "Alarm ID") public var alarmID: String
  @Parameter(title: "Wake-up phrase") public var phrase: String

  public init() {}

  public init(alarmID: String, phrase: String) {
    self.alarmID = alarmID
    self.phrase = phrase
  }

  public func perform() async throws -> some IntentResult {
    try await scheduleWakeWordSnooze(alarmID: alarmID, phrase: phrase)
    return .result()
  }
}

@available(iOS 26.1, *)
private func scheduleWakeWordSnooze(alarmID: String, phrase: String) async throws {
  let manager = AlarmManager.shared
  let sourceID = wakeWordAlarmID(alarmID)
  if try manager.alarms.contains(where: { $0.id == sourceID }) {
    // The app may already have stopped the ringing system alarm.
    try? manager.stop(id: sourceID)
  }

  let snoozeKey = "wakeword.snooze.\(alarmID)"
  let snoozeID = UserDefaults.standard.string(forKey: snoozeKey).flatMap(UUID.init(uuidString:)) ?? UUID()
  UserDefaults.standard.set(snoozeID.uuidString, forKey: snoozeKey)
  if try manager.alarms.contains(where: { $0.id == snoozeID }) {
    try manager.cancel(id: snoozeID)
  }

  let alert = AlarmPresentation.Alert(
    title: LocalizedStringResource(stringLiteral: phrase),
    secondaryButton: AlarmButton(text: "Snooze", textColor: .white, systemImageName: "moon.zzz.fill"),
    secondaryButtonBehavior: .custom
  )
  let attributes = AlarmAttributes(
    presentation: AlarmPresentation(alert: alert),
    metadata: WakeWordAlarmMetadata(),
    tintColor: Color(red: 0.90, green: 0.42, blue: 0.31)
  )
  let snoozeConfiguration = AlarmManager.AlarmConfiguration<WakeWordAlarmMetadata>(
    countdownDuration: nil,
    schedule: .fixed(Date().addingTimeInterval(5 * 60)),
    attributes: attributes,
    stopIntent: wakeWordStopIntent(alarmID),
    secondaryIntent: WakeWordSnoozeIntent(alarmID: alarmID, phrase: phrase),
    sound: .default
  )
  _ = try await manager.schedule(id: snoozeID, configuration: snoozeConfiguration)
}

@available(iOS 26.1, *)
private func wakeWordStopIntent(_ alarmID: String) -> WakeWordStopIntent? {
  guard let token = UserDefaults.standard.string(forKey: "wakeword.oneTimeToken.\(alarmID)") else { return nil }
  return WakeWordStopIntent(alarmID: alarmID, token: token)
}

@available(iOS 26.1, *)
private func wakeWordAlarmID(_ key: String) -> UUID {
  let storageKey = "wakeword.alarmkit.\(key)"
  if let raw = UserDefaults.standard.string(forKey: storageKey), let id = UUID(uuidString: raw) { return id }
  let id = UUID()
  UserDefaults.standard.set(id.uuidString, forKey: storageKey)
  return id
}

public final class WakeWordAlarmsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WakeWordAlarms")

    AsyncFunction("scheduleAlarm") { (input: [String: Any]) async throws -> [String: Any] in
      guard #available(iOS 26.1, *) else {
        return [
          "available": false,
          "scheduled": false,
          "permissionGranted": false,
          "platform": "ios",
          "reason": "Native iPhone alarms require iOS 26.1 or later."
        ]
      }
      let alarmID = input["id"] as? String ?? UUID().uuidString
      let hour = input["hour"] as? Int ?? 7
      let minute = input["minute"] as? Int ?? 0
      let phrase = input["phrase"] as? String ?? "Wake up"
      let days = input["days"] as? [Int] ?? []
      let manager = AlarmManager.shared
      let authorization = try await manager.requestAuthorization()
      guard authorization == .authorized else {
        return [
          "available": true,
          "scheduled": false,
          "permissionGranted": false,
          "platform": "ios",
          "reason": "Allow WakeWord to create alarms in iOS Settings."
        ]
      }

      let id = wakeWordAlarmID(alarmID)
      let defaults = UserDefaults.standard
      defaults.removeObject(forKey: "wakeword.dismissed.\(alarmID)")
      if days.isEmpty {
        defaults.set(UUID().uuidString, forKey: "wakeword.oneTimeToken.\(alarmID)")
      } else {
        defaults.removeObject(forKey: "wakeword.oneTimeToken.\(alarmID)")
      }
      cancelWakeWordSnooze(alarmID)
      if try manager.alarms.contains(where: { $0.id == id }) {
        try manager.cancel(id: id)
      }
      let schedule: Alarm.Schedule
      if days.isEmpty {
        var next = Calendar.current.dateComponents([.year, .month, .day], from: Date())
        next.hour = hour
        next.minute = minute
        next.second = 0
        var date = Calendar.current.date(from: next) ?? Date().addingTimeInterval(60)
        if date <= Date() { date = Calendar.current.date(byAdding: .day, value: 1, to: date) ?? date }
        schedule = .fixed(date)
      } else {
        let weekdays = days.compactMap(Self.weekday(forMondayFirstIndex:))
        let time = Alarm.Schedule.Relative.Time(hour: hour, minute: minute)
        schedule = .relative(.init(time: time, repeats: .weekly(weekdays)))
      }
      let alert = AlarmPresentation.Alert(
        title: LocalizedStringResource(stringLiteral: phrase),
        secondaryButton: AlarmButton(text: "Snooze", textColor: .white, systemImageName: "moon.zzz.fill"),
        secondaryButtonBehavior: .custom
      )
      let attributes = AlarmAttributes(
        presentation: AlarmPresentation(alert: alert),
        metadata: WakeWordAlarmMetadata(),
        tintColor: Color(red: 0.90, green: 0.42, blue: 0.31)
      )
      let configuration = AlarmManager.AlarmConfiguration(
        countdownDuration: nil,
        schedule: schedule,
        attributes: attributes,
        stopIntent: wakeWordStopIntent(alarmID),
        secondaryIntent: WakeWordSnoozeIntent(alarmID: alarmID, phrase: phrase),
        sound: .default
      )
      _ = try await manager.schedule(id: id, configuration: configuration)
      UserDefaults.standard.set(id.uuidString, forKey: Self.storageKey(for: alarmID))
      return ["available": true, "scheduled": true, "permissionGranted": true, "platform": "ios"]
    }

    AsyncFunction("snoozeAlarm") { (alarmID: String, phrase: String) async throws -> Bool in
      guard #available(iOS 26.1, *) else { return false }
      try await scheduleWakeWordSnooze(alarmID: alarmID, phrase: phrase)
      return true
    }

    AsyncFunction("stopRinging") { (alarmID: String) throws in
      guard #available(iOS 26.1, *) else { return }
      let id = wakeWordAlarmID(alarmID)
      if try AlarmManager.shared.alarms.contains(where: { $0.id == id }) {
        try? AlarmManager.shared.stop(id: id)
      }
      if let raw = UserDefaults.standard.string(forKey: "wakeword.snooze.\(alarmID)"),
         let snoozeID = UUID(uuidString: raw),
         try AlarmManager.shared.alarms.contains(where: { $0.id == snoozeID }) {
        try? AlarmManager.shared.stop(id: snoozeID)
      }
    }

    AsyncFunction("cancelAlarm") { (alarmID: String) async throws in
      guard #available(iOS 26.1, *) else { return }
      guard let raw = UserDefaults.standard.string(forKey: Self.storageKey(for: alarmID)), let id = UUID(uuidString: raw) else { return }
      if try AlarmManager.shared.alarms.contains(where: { $0.id == id }) {
        try AlarmManager.shared.cancel(id: id)
      }
      cancelWakeWordSnooze(alarmID)
      UserDefaults.standard.removeObject(forKey: Self.storageKey(for: alarmID))
    }

    AsyncFunction("getDismissedOneTimeAlarms") { () -> [String] in
      let defaults = UserDefaults.standard
      let prefix = "wakeword.dismissed."
      return defaults.dictionaryRepresentation().keys.compactMap { key in
        guard key.hasPrefix(prefix), let token = defaults.string(forKey: key) else { return nil }
        let alarmID = String(key.dropFirst(prefix.count))
        return defaults.string(forKey: "wakeword.oneTimeToken.\(alarmID)") == token ? alarmID : nil
      }
    }

    AsyncFunction("acknowledgeDismissedOneTimeAlarms") { (ids: [String]) in
      for id in ids {
        UserDefaults.standard.removeObject(forKey: "wakeword.dismissed.\(id)")
      }
    }

    AsyncFunction("requestAlarmPermission") { () async -> Bool in
      guard #available(iOS 26.1, *) else { return false }
      do { return try await AlarmManager.shared.requestAuthorization() == .authorized }
      catch { return false }
    }

    AsyncFunction("openAlarmSettings") { () async in
      guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
      await MainActor.run { UIApplication.shared.open(url) }
    }
  }

  @available(iOS 26.1, *)
  private static func weekday(forMondayFirstIndex day: Int) -> Locale.Weekday? {
    switch day {
    case 0: return .monday
    case 1: return .tuesday
    case 2: return .wednesday
    case 3: return .thursday
    case 4: return .friday
    case 5: return .saturday
    case 6: return .sunday
    default: return nil
    }
  }

  private static func storageKey(for id: String) -> String { "wakeword.alarmkit.\(id)" }
}

@available(iOS 26.1, *)
private func cancelWakeWordSnooze(_ alarmID: String) {
  let key = "wakeword.snooze.\(alarmID)"
  guard let raw = UserDefaults.standard.string(forKey: key), let id = UUID(uuidString: raw) else { return }
  if (try? AlarmManager.shared.alarms.contains(where: { $0.id == id })) == true {
    try? AlarmManager.shared.cancel(id: id)
  }
  UserDefaults.standard.removeObject(forKey: key)
}
