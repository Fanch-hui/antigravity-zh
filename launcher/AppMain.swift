import AppKit
import Foundation

func showFailure(_ message: String) {
    let application = NSApplication.shared
    application.setActivationPolicy(.accessory)
    application.activate(ignoringOtherApps: true)
    let alert = NSAlert()
    alert.messageText = "Antigravity 中文启动失败"
    alert.informativeText = message
    alert.alertStyle = .warning
    alert.addButton(withTitle: "好")
    alert.runModal()
}

let candidates = [
    "/opt/homebrew/opt/node@22/bin/node",
    "/opt/homebrew/bin/node",
    "/usr/local/bin/node"
]
guard let node = candidates.first(where: { FileManager.default.isExecutableFile(atPath: $0) }),
      let resources = Bundle.main.resourceURL else {
    showFailure("请先安装 Node.js 22，再通过中文入口启动。")
    exit(1)
}

let log = FileManager.default.temporaryDirectory.appendingPathComponent("agy-zh-launcher.log")
do {
    FileManager.default.createFile(atPath: log.path, contents: Data())
    let output = try FileHandle(forWritingTo: log)
    defer { try? output.close() }
    let process = Process()
    process.executableURL = URL(fileURLWithPath: node)
    process.arguments = [resources.appendingPathComponent("bin/agy-zh.mjs").path, "launch"]
    process.currentDirectoryURL = resources
    process.standardOutput = output
    process.standardError = output
    try process.run()
    process.waitUntilExit()
    if process.terminationStatus != 0 {
        let details = (try? String(contentsOf: log, encoding: .utf8))?.trimmingCharacters(in: .whitespacesAndNewlines)
        showFailure(details?.isEmpty == false ? details! : "启动未完成，请使用命令行入口查看详细原因。")
    }
} catch {
    showFailure("无法运行汉化启动器：\(error.localizedDescription)")
    exit(1)
}
