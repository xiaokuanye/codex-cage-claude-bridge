import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function askCli(config, { text, sessionId }) {
  if (typeof text !== 'string' || !text.trim()) throw Error('请输入问题');
  if (sessionId && !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(sessionId)) throw Error('无效的 Claude Code 会话 ID');
  const hosts = JSON.parse((await readFile(join(config.profileDir, 'desktop-entry', 'remote-hosts.json'), 'utf8')).replace(/^\uFEFF/, ''));
  const host = hosts.hosts.find(h => h.id === config.hostId);
  if (!host) throw Error('未找到 Cage SSH 主机');
  const payload = Buffer.from(JSON.stringify({ text, sessionId })).toString('base64');
  const program = `import os,base64,json,subprocess,sys
r=json.loads(base64.b64decode('${payload}'))
os.environ['CLAUDE_CONFIG_DIR']='/home/cage/.claude'
os.chdir('/home/ubuntu/.claude-cage-workspace')
cmd=['/home/cage/.local/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe','-p','--output-format','json']
if r.get('sessionId'): cmd.extend(['--resume',r['sessionId']])
sys.exit(subprocess.run(cmd,input=r['text'].encode()).returncode)
`;
  return new Promise((resolve, reject) => {
    const child = execFile('ssh', ['-T','-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes',
      '-o','ConnectTimeout=8','-i',host.auth.identity_file,'-p',String(host.port),host.user+'@'+host.host,
      'TOKIO_WORKER_THREADS=1 ~/.claude-cage/cloud-host/bin/cage run /usr/bin/python3 -'],
    {windowsHide:true,timeout:110000,maxBuffer:8<<20}, (err,out,stderr) => {
      try {
        if (err?.killed) throw Error('等待 CLI 回复超时，消息可能已提交。');
        const reply = JSON.parse(out.trim());
        if (err || reply.is_error || typeof reply.result !== 'string') throw Error(reply.result || 'CLI 未返回回答');
        resolve({sessionId:reply.session_id,text:reply.result});
      } catch (e) { reject(e instanceof SyntaxError ? Error(stderr.trim() || err?.message || 'CLI 响应不完整') : e); }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(program);
  });
}
