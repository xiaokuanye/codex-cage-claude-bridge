param(
    [Parameter(Mandatory, Position=0)][string]$Text,
    [string]$SessionId,
    [string]$HostId = $env:CAGE_HOST_ID
)
if (!$HostId) { throw '请指定 -HostId 或 CAGE_HOST_ID' }
$OutputEncoding = [Text.UTF8Encoding]::new($false)
$request = @{text=$Text}
if ($SessionId) { $request.sessionId = $SessionId }
$request | ConvertTo-Json -Compress | node "$PSScriptRoot/server.mjs" --host-id $HostId --call ask
exit $LASTEXITCODE
