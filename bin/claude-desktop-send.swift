import AppKit
import ApplicationServices

func finish(_ status: String, _ code: Int32 = 1) -> Never {
    print(status)
    exit(code)
}

func attribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success else { return nil }
    return value
}

func axElement(_ value: CFTypeRef?) -> AXUIElement? {
    guard let value, CFGetTypeID(value) == AXUIElementGetTypeID() else { return nil }
    return (value as! AXUIElement)
}

func matchesChat(_ value: CFTypeRef?, _ id: String) -> Bool {
    let url = (value as? URL) ?? (value as? String).flatMap { URL(string: $0) }
    guard let url, url.scheme == "https",
          ["claude.ai", "claude.com"].contains(url.host ?? "") else { return false }
    return ["/code/", "/epitaxy/", "/claude-code-desktop/"].contains { url.path == $0 + id }
}

let args = CommandLine.arguments
if args.count == 2 && args[1] == "--authorize" {
    let key = kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String
    finish(AXIsProcessTrustedWithOptions([key: true] as CFDictionary) ? "ready" : "accessibility", 0)
}
guard AXIsProcessTrusted() else { finish("accessibility") }
if args.count == 2 && args[1] == "--check" { finish("ready", 0) }
guard args.count == 2, args[1].range(of: #"^local_[A-Za-z0-9-]{1,64}$"#, options: .regularExpression) != nil,
      let prompt = String(data: FileHandle.standardInput.readDataToEndOfFile(), encoding: .utf8),
      !prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, prompt.utf16.count <= 8000,
      let app = NSRunningApplication.runningApplications(withBundleIdentifier: "com.anthropic.claudefordesktop").first
else { finish("unavailable") }

let axApp = AXUIElementCreateApplication(app.processIdentifier)
AXUIElementSetMessagingTimeout(axApp, 1)
guard let window = axElement(attribute(axApp, kAXFocusedWindowAttribute)) else { finish("unavailable") }

// Bind the controls to the web area for the exact Desktop session. Never select a
// chat by its title, send a global keystroke, or interact with a permission dialog.
func chatArea() -> AXUIElement? {
    var search = [window]
    var matches = [AXUIElement]()
    var visited = 0
    while let element = search.popLast(), visited < 2500 {
        visited += 1
        let role = attribute(element, kAXRoleAttribute) as? String
        if role == "AXWebArea" && matchesChat(attribute(element, kAXURLAttribute), args[1]) {
            matches.append(element)
            continue
        }
        search.append(contentsOf: attribute(element, kAXChildrenAttribute) as? [AXUIElement] ?? [])
    }
    return matches.count == 1 && search.isEmpty ? matches[0] : nil
}

let sendLabels = Set(["Send", "Send message", "Senden", "Nachricht senden"])
let queueLabels = Set(["Queue message", "Queue follow-up", "Nachricht in Warteschlange stellen"])
func controls(in area: AXUIElement) -> (AXUIElement?, [AXUIElement]) {
    var search = [area]
    var inputs = [AXUIElement]()
    var buttons = [AXUIElement]()
    var visited = 0
    while let element = search.popLast(), visited < 3000 {
        visited += 1
        let role = attribute(element, kAXRoleAttribute) as? String
        if role == "AXTextArea" {
            var writable = DarwinBoolean(false)
            if AXUIElementIsAttributeSettable(element, kAXValueAttribute as CFString, &writable) == .success && writable.boolValue {
                inputs.append(element)
            }
        }
        if role == "AXButton" {
            let labels = [kAXDescriptionAttribute, kAXTitleAttribute].compactMap { attribute(element, $0) as? String }
            if labels.contains(where: { sendLabels.contains($0) || queueLabels.contains($0) }) {
                buttons.append(element)
            }
        }
        search.append(contentsOf: attribute(element, kAXChildrenAttribute) as? [AXUIElement] ?? [])
    }
    return (inputs.count == 1 && search.isEmpty ? inputs[0] : nil, buttons)
}

guard let area = chatArea(), let input = controls(in: area).0,
      let value = attribute(input, kAXValueAttribute) as? String, value.isEmpty
else { finish("unavailable") }

guard AXUIElementSetAttributeValue(input, kAXValueAttribute as CFString, prompt as CFString) == .success
else { finish("unavailable") }

func stillInChat() -> Bool {
    guard let current = axElement(attribute(axApp, kAXFocusedWindowAttribute)),
          CFEqual(current, window),
          let currentArea = chatArea(), CFEqual(currentArea, area) else { return false }
    return true
}

for _ in 0..<12 {
    if !stillInChat() { finish("draft") }
    let (currentInput, buttons) = controls(in: area)
    guard let currentInput, CFEqual(currentInput, input),
          attribute(input, kAXValueAttribute) as? String == prompt else { finish("draft") }
    let enabled = buttons.filter { attribute($0, kAXEnabledAttribute) as? Bool == true }
    if enabled.count == 1 {
        guard stillInChat(), attribute(input, kAXValueAttribute) as? String == prompt,
              AXUIElementPerformAction(enabled[0], kAXPressAction as CFString) == .success
        else { finish("draft") }
        for _ in 0..<15 {
            guard stillInChat() else { finish("unconfirmed") }
            if attribute(input, kAXValueAttribute) as? String == "" { finish("sent", 0) }
            Thread.sleep(forTimeInterval: 0.08)
        }
        finish("unconfirmed")
    }
    Thread.sleep(forTimeInterval: 0.08)
}
finish("draft")
