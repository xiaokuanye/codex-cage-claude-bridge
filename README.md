# 从 Codex 询问远端 Claude Code

在 Codex 里说「问 Claude：……」，让 Codex 将问题原样发给 Cage 客机内已登录的 Claude Code，并返回 CLI 回答。每个 Codex 聊天用自己上轮的 sessionId 续聊。Cage 桌面窗口可以保持最小化。

## 接入

本机需要 Node.js 20+ 和 OpenSSH 客户端。本工具面向通过密钥连接的 Cage Linux 云主机，使用该主机既有的 Claude Code 安装和项目目录。先在 PowerShell 查看已配置的主机：

~~~powershell
(Get-Content -Raw "$env:USERPROFILE/.claude-cage/desktop-entry/remote-hosts.json" | ConvertFrom-Json).hosts | Select-Object id,host
~~~

在 Codex 的用户级 config.toml 注册 stdio MCP，把示例路径和主机 ID 换成本机的值：

~~~toml
[mcp_servers.cage_claude]
command = "node"
args = ["D:/src/Claude-Cage/tools/claude-code-bridge/server.mjs", "--host-id", "YOUR_CAGE_HOST_ID"]
tool_timeout_sec = 120
~~~

使用独立 Cage 配置目录时可追加 --profile-dir 和目录路径。主机密钥和身份文件沿用本机 SSH 与 Cage 配置。客机 CLI 使用 /home/cage/.claude 下的登录状态，工作目录是 /home/ubuntu/.claude-cage-workspace。

## 聊天规则

在使用者的 AGENTS.md 添加下面一段，把其中的后备脚本路径替换为实际绝对路径：

> 用户说「问 Claude」「跟 Claude 聊」时，调用 cage_claude.ask，text 使用用户的问题原文，直接转述回答。首轮省略 sessionId，追问带上本聊天上一轮返回的 sessionId。当前聊天尚未加载工具时，直接调用本机 tools/claude-code-bridge/ask.ps1 并指定 -HostId 和 -Text。

ask 和兼容入口 send 都直接返回包含 text、sessionId 的 JSON。客户端应将 sessionId 保存在对应聊天中。通过 PowerShell 也可以直接提问和续聊：

~~~powershell
$first = ./ask.ps1 -HostId $cageHostId -Text '你好' | ConvertFrom-Json
$first.text
./ask.ps1 -HostId $cageHostId -SessionId $first.sessionId -Text '继续刚才的话题'
~~~

超时或连接中断时，消息可能已在远端开始处理，客户端应向用户报告状态。
