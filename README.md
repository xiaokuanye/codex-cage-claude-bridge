# Codex Cage Claude Bridge

在本机 Codex 里说「问 Claude……」，这个独立的 MCP 服务会通过 SSH 把问题发给 Cage 客机上已登录的 Claude Code。你可以接着追问、发送本地附件，或稍后取回长任务的回答。每个 Codex 聊天有独立的上下文，Cage 桌面窗口可以保持最小化。

## 获取工具

本机需要 Node.js 20+ 和 OpenSSH 客户端，脚本只使用标准库。下面的 PowerShell 命令会下载仓库，并打印 Codex 配置需要的服务入口绝对路径。

~~~powershell
git clone https://github.com/xiaokuanye/codex-cage-claude-bridge.git
Set-Location codex-cage-claude-bridge
(Resolve-Path ./server.mjs).Path
~~~

## 连接 Cage SSH 主机

先在 Cage 中配置一台可以用 SSH 密钥登录的 Linux 云主机。桥接读取本机 `~/.claude-cage/desktop-entry/remote-hosts.json` 的 `hosts` 列表，按 `id` 选主机，连接时使用对应的 `host`、`port`、`user` 和 `auth.identity_file`。SSH 主机密钥须已在本机 OpenSSH 的 `known_hosts` 中受信任。用 PowerShell 查看可选主机并记下目标的 `id`。

~~~powershell
(Get-Content -Raw "$env:USERPROFILE/.claude-cage/desktop-entry/remote-hosts.json" | ConvertFrom-Json).hosts | Select-Object id,host,user,port
~~~

云主机通过 `~/.claude-cage/cloud-host/bin/cage run` 进入客机。客机需要 Python 3，以及已登录的 Claude Code。当前版本使用以下 Cage 客机路径。

| 用途 | 路径 |
| --- | --- |
| Claude Code 可执行文件 | `/home/cage/.local/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe` |
| Claude 登录配置 | `/home/cage/.claude` |
| Claude 工作目录 | `/home/ubuntu/.claude-cage-workspace` |

## 接入 Codex

在 Codex 的用户级 `config.toml`（默认 `~/.codex/config.toml`）中加入以下配置。把示例路径换成前面得到的 `server.mjs` 绝对路径，把 `YOUR_CAGE_HOST_ID` 换成目标主机的 `id`。

~~~toml
[mcp_servers.cage_claude]
command = "node"
args = ['D:/src/codex-cage-claude-bridge/server.mjs', '--host-id', 'YOUR_CAGE_HOST_ID']
tool_timeout_sec = 120
~~~

自定义 Cage 配置目录时，在 `args` 里追加 `'--profile-dir'` 和含 `desktop-entry` 的目录路径。打开新的 Codex 聊天后就能使用 `cage_claude.ask`。

## 聊天规则

可以把下面一段加入使用者的 `AGENTS.md`，并将 `ask.ps1` 写成本机的绝对路径。

> 用户说「问 Claude」「跟 Claude 聊」时，用 cage_claude.ask 原样转发问题，完整转回回答。用户指定的本机附件用 files 传绝对路径。同一 Codex 聊天自动续聊。用户要求重开时传 newSession。升级前已开始的对话，首次追问时传本聊天已有的 sessionId。收到 needsSessionId 时，之后的追问也带上它。返回 running 时，持续用 ask_result 和同一 jobId 等待最终回答。返回 busy 表示本轮尚未发送，先取完上一条再发送本轮。旧窗口缺少 ask_result 时用本机 ask.ps1，指定 -HostId，提问用 -Text，取结果用 -JobId。

**续聊。** MCP 从每次请求的 `_meta.threadId` 识别 Codex 聊天。PowerShell 脚本在 Codex 终端里使用 `CODEX_THREAD_ID`，并兼容 `CODEX_SESSION_ID`。普通终端或未传聊天编号的 MCP 客户端会收到 `needsSessionId: true`，用上次返回的 `sessionId` 续聊。

~~~powershell
$cageHostId = 'YOUR_CAGE_HOST_ID'
$reply = ./ask.ps1 -HostId $cageHostId -Text '你好' | ConvertFrom-Json
while ($reply.status -eq 'running') {
    $reply = ./ask.ps1 -HostId $cageHostId -JobId $reply.jobId | ConvertFrom-Json
}
if ($reply.status -eq 'completed') { $reply.text } else { $reply.message }
~~~

发送图片时，在提问命令中加 `-Files 'D:\demo\图.png'`，并把问题换成「帮我看这张图」。

**长回复。** `ask` 和兼容入口 `send` 默认等 30 秒，可用 `waitSeconds` 调整为 0 到 60 秒。云端任务在 SSH 断开后继续运行。用同一任务号调用 `ask_result` 可重复领取结果。完成时返回 `status: completed`、`sessionId` 和完整的 `text`。连接中断时如果有任务号，先用它查进度。客机关机导致任务中断时，查询会返回失败原因。

**本地附件。** `files` 接受本次提问选定的绝对文件路径。文件经现有 SSH 复制到 Cage 客机，Claude 可以读文档和图片。每次最多 8 个文件，单个 10 MiB，合计 20 MiB。目录和常见凭据文件不支持。任务结果与上传的附件保存在客机用户的 `~/.cache/cage-claude-bridge/`，以便稍后取回回复或继续讨论附件。

## 来源与提交历史

本项目从 Claude-Cage 的 PR #526 拆出，沿用上游 MIT 许可证。两条修改桥接工具的提交迁入了本仓库的 `main`，保留了作者、时间和提交说明。工具目录移到仓库根目录后，Git 为它们生成了新的 SHA。[原 PR 的四条提交](https://github.com/Lee-xeo/Claude-Cage/pull/526/commits) · [许可证](LICENSE)

首次发布附带一份 Git bundle，保存了四条提交的原始 Git 对象，包括上游 CI 修复与主线同步。发布页提供在 Claude-Cage 仓库中恢复这段历史的命令。[下载原始提交归档](https://github.com/xiaokuanye/codex-cage-claude-bridge/releases/tag/pr-526-import)
