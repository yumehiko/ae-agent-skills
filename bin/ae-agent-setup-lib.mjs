import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

export const DEFAULT_REPO = 'yumehiko/ae-agent-skills';
export const AGENT_WORKSPACE_NAME = 'ae-agent-skills';

export const SKILL_SOURCES = [
  { sourceName: 'aftereffects-cli.SKILL.md', destinationName: 'aftereffects-cli' },
  { sourceName: 'aftereffects-declarative.SKILL.md', destinationName: 'aftereffects-declarative' },
];

export const CLAUDE_COMMAND_SOURCES = [
  { sourceName: 'aftereffects-cli.md', destinationName: 'aftereffects-cli.md' },
  { sourceName: 'aftereffects-declarative.md', destinationName: 'aftereffects-declarative.md' },
];

export const WORKSPACE_RESOURCE_SOURCES = [
  { source: ['schemas', 'scene.schema.json'], destination: ['scene.schema.json'] },
  { source: ['examples', 'scene.example.json'], destination: ['references', 'scene.example.json'] },
  { source: ['docs', 'cli.ja.md'], destination: ['references', 'cli.ja.md'] },
  { source: ['docs', 'cli.md'], destination: ['references', 'cli.md'] },
];

export const AGENT_REGISTRY = [
  {
    id: 'codex',
    destRoot({ home, env }) {
      const codexHome = env.CODEX_HOME || path.join(home, '.codex');
      return path.join(codexHome, 'skills');
    },
    isDetected({ home, env, fsModule }) {
      return Boolean(env.CODEX_HOME) || fsModule.existsSync(path.join(home, '.codex'));
    },
  },
  {
    id: 'gemini',
    destRoot({ home }) {
      return path.join(home, '.gemini', 'skills');
    },
    isDetected({ home, fsModule }) {
      return fsModule.existsSync(path.join(home, '.gemini'));
    },
  },
  {
    id: 'claude',
    destRoot({ home }) {
      return path.join(home, '.claude', 'skills');
    },
    commandsRoot({ home }) {
      return path.join(home, '.claude', 'commands');
    },
    isDetected({ home, fsModule }) {
      return fsModule.existsSync(path.join(home, '.claude'));
    },
  },
];

const AGENT_ALIASES = {
  both: ['codex', 'gemini'],
  all: AGENT_REGISTRY.map((agent) => agent.id),
};

export function getRepoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

export function printHelp(output = console.log) {
  output(`ae-agent-setup

Usage:
  ae-agent-setup install [options]

Options:
  --agent <codex|gemini|claude|both|all>
                              Agent target. If omitted, interactive selection is shown.
                              "both" means codex+gemini for backward compatibility.
                              "all" means codex+gemini+claude.
  --repo <owner/repo>          GitHub repository for release and CLI install (default: ${DEFAULT_REPO}).
  --zxp <path-or-url>          Local ZXP path or direct download URL.
  --skip-extension             Skip ZXP extension installation.
  --skip-cli                   Skip ae-cli installation.
  --skip-skills                Skip skill installation.
  -h, --help                   Show this help.
`);
}

export function parseArgs(argv) {
  const opts = {
    agent: '',
    repo: DEFAULT_REPO,
    zxp: '',
    skipExtension: false,
    skipCli: false,
    skipSkills: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--agent') {
      opts.agent = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (arg === '--repo') {
      opts.repo = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (arg === '--zxp') {
      opts.zxp = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (arg === '--skip-extension') {
      opts.skipExtension = true;
      continue;
    }
    if (arg === '--skip-cli') {
      opts.skipCli = true;
      continue;
    }
    if (arg === '--skip-skills') {
      opts.skipSkills = true;
      continue;
    }
    if (arg === '-h' || arg === '--help') {
      opts.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return opts;
}

export function expandAgentTarget(agentArg) {
  const value = String(agentArg || '').toLowerCase();
  const direct = AGENT_REGISTRY.find((agent) => agent.id === value);
  if (direct) return [direct.id];
  if (AGENT_ALIASES[value]) return [...AGENT_ALIASES[value]];
  throw new Error(`Invalid --agent value: ${agentArg}`);
}

export function getDetectedAgents({ home = os.homedir(), env = process.env, fsModule = fs } = {}) {
  return AGENT_REGISTRY
    .filter((agent) => agent.isDetected({ home, env, fsModule }))
    .map((agent) => agent.id);
}

export function getSkillInstallTargets(
  agentArg,
  { home = os.homedir(), env = process.env } = {},
) {
  return expandAgentTarget(agentArg).map((agentId) => {
    const agent = AGENT_REGISTRY.find((entry) => entry.id === agentId);
    return {
      kind: agent.id,
      destRoot: agent.destRoot({ home, env }),
    };
  });
}

export function getClaudeCommandInstallTarget({ home = os.homedir() } = {}) {
  const claude = AGENT_REGISTRY.find((entry) => entry.id === 'claude');
  return claude.commandsRoot({ home });
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function resolveAgent(agentArg) {
  if (agentArg) {
    expandAgentTarget(agentArg);
    return agentArg.toLowerCase();
  }

  const detected = getDetectedAgents();
  const recommended = detected[0] || 'codex';
  console.log('Select which coding agent should receive skills:');
  console.log(`  1) codex${recommended === 'codex' ? ' (recommended)' : ''}`);
  console.log(`  2) gemini${recommended === 'gemini' ? ' (recommended)' : ''}`);
  console.log(`  3) claude${recommended === 'claude' ? ' (recommended)' : ''}`);
  console.log('  4) both (codex + gemini)');
  console.log('  5) all (codex + gemini + claude)');

  if (!process.stdin.isTTY) {
    console.log(`No interactive terminal detected. Defaulting to: ${recommended}`);
    return recommended;
  }

  const answer = await ask('Enter 1, 2, 3, 4, or 5 [1]: ');
  if (!answer || answer === '1') return 'codex';
  if (answer === '2') return 'gemini';
  if (answer === '3') return 'claude';
  if (answer === '4') return 'both';
  if (answer === '5') return 'all';
  throw new Error(`Invalid selection: ${answer}`);
}

export function run(cmd, args, options = {}) {
  const pretty = `${cmd} ${args.join(' ')}`.trim();
  console.log(`$ ${pretty}`);
  const res = spawnSync(cmd, args, { stdio: 'inherit', ...options });
  if (res.error) {
    throw new Error(`Command failed: ${pretty}\n${res.error.message}`);
  }
  if (res.status !== 0) {
    throw new Error(`Command failed with exit code ${res.status}: ${pretty}`);
  }
}

export function commandExists(cmd) {
  const res = spawnSync('which', [cmd], { stdio: 'pipe', encoding: 'utf8' });
  return res.status === 0;
}

export function detectInstaller() {
  if (commandExists('upia')) return { cmd: 'upia', args: ['--install'] };
  if (commandExists('UPIA')) return { cmd: 'UPIA', args: ['--install'] };

  const knownUpiaPaths = [
    '/Library/Application Support/Adobe/Adobe Desktop Common/RemoteComponents/UPI/UnifiedPluginInstallerAgent/UnifiedPluginInstallerAgent.app/Contents/MacOS/UnifiedPluginInstallerAgent',
    '/Library/Application Support/Adobe/Adobe Desktop Common/HDBox/UPIA/UnifiedPluginInstallerAgent',
  ];
  for (const knownUpiaPath of knownUpiaPaths) {
    if (fs.existsSync(knownUpiaPath)) return { cmd: knownUpiaPath, args: ['--install'] };
  }

  if (commandExists('ExManCmd')) return { cmd: 'ExManCmd', args: ['--install'] };
  return null;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'ae-agent-setup',
      },
    });
    req.then(async (res) => {
      if (!res.ok) {
        reject(new Error(`Request failed: ${res.status} ${res.statusText}`));
        return;
      }
      try {
        const body = await res.json();
        resolve(body);
      } catch (err) {
        reject(err);
      }
    }).catch(reject);
  });
}

function downloadToFile(url, destination) {
  return fetch(url, {
    headers: {
      Accept: 'application/octet-stream',
      'User-Agent': 'ae-agent-setup',
    },
  }).then(async (res) => {
    if (!res.ok) {
      throw new Error(`Download failed: ${res.status} ${res.statusText}`);
    }
    const data = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(destination, data);
    return destination;
  });
}

export async function resolveZxpPath(opts) {
  if (opts.zxp) {
    if (opts.zxp.startsWith('http://') || opts.zxp.startsWith('https://')) {
      const output = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ae-agent-zxp-')), 'extension.zxp');
      console.log(`Downloading ZXP from URL: ${opts.zxp}`);
      await downloadToFile(opts.zxp, output);
      return output;
    }

    const local = path.resolve(process.cwd(), opts.zxp);
    if (!fs.existsSync(local)) {
      throw new Error(`ZXP not found: ${local}`);
    }
    return local;
  }

  console.log(`Fetching latest release from GitHub: ${opts.repo}`);
  const release = await fetchJson(`https://api.github.com/repos/${opts.repo}/releases/latest`);
  const asset = (release.assets || []).find((a) => typeof a.name === 'string' && a.name.endsWith('.zxp'));
  if (!asset) {
    throw new Error(`No .zxp asset found in latest release of ${opts.repo}`);
  }

  const output = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ae-agent-zxp-')), asset.name);
  console.log(`Downloading asset: ${asset.name}`);
  await downloadToFile(asset.browser_download_url, output);
  return output;
}

export function installSkills(
  agent,
  { root = getRepoRoot(), home = os.homedir(), env = process.env } = {},
) {
  const sourceRoot = path.join(root, 'templates', 'skills');
  const targets = getSkillInstallTargets(agent, { home, env });

  for (const target of targets) {
    fs.mkdirSync(target.destRoot, { recursive: true });
    for (const skill of SKILL_SOURCES) {
      const source = path.join(sourceRoot, skill.sourceName);
      const destination = path.join(target.destRoot, skill.destinationName);
      if (!fs.existsSync(source)) {
        throw new Error(`Skill source not found: ${source}`);
      }
      fs.rmSync(destination, { recursive: true, force: true });
      fs.mkdirSync(destination, { recursive: true });
      fs.copyFileSync(source, path.join(destination, 'SKILL.md'));
      console.log(`Installed ${target.kind} skill: ${destination}`);
    }
  }

  if (expandAgentTarget(agent).includes('claude')) {
    installClaudeCommands({ root, home });
  }
}

export function installClaudeCommands({ root = getRepoRoot(), home = os.homedir() } = {}) {
  const sourceRoot = path.join(root, 'templates', 'claude', 'commands');
  const destRoot = getClaudeCommandInstallTarget({ home });
  fs.mkdirSync(destRoot, { recursive: true });

  for (const command of CLAUDE_COMMAND_SOURCES) {
    const source = path.join(sourceRoot, command.sourceName);
    const destination = path.join(destRoot, command.destinationName);
    if (!fs.existsSync(source)) {
      throw new Error(`Claude command source not found: ${source}`);
    }
    fs.copyFileSync(source, destination);
    console.log(`Installed claude command: ${destination}`);
  }
}

export function setupAgentWorkspace({ root = getRepoRoot(), home = os.homedir() } = {}) {
  const workspaceRoot = path.join(home, AGENT_WORKSPACE_NAME);
  const workDir = path.join(workspaceRoot, 'work');
  const doneDir = path.join(workspaceRoot, 'done');
  const refsDir = path.join(workspaceRoot, 'references');

  fs.mkdirSync(workDir, { recursive: true });
  fs.mkdirSync(doneDir, { recursive: true });
  fs.mkdirSync(refsDir, { recursive: true });

  for (const resource of WORKSPACE_RESOURCE_SOURCES) {
    const source = path.join(root, ...resource.source);
    const destination = path.join(workspaceRoot, ...resource.destination);
    if (!fs.existsSync(source)) {
      throw new Error(`Workspace resource not found: ${source}`);
    }
    fs.copyFileSync(source, destination);
  }

  console.log(`Prepared workspace: ${workspaceRoot}`);
}

export function installCli(repo) {
  if (!commandExists('python3')) {
    throw new Error('python3 is required to install ae-cli.');
  }
  const spec = `git+https://github.com/${repo}.git`;
  run('python3', ['-m', 'pip', 'install', '--user', '--upgrade', spec]);

  const helpRes = spawnSync('ae-cli', ['--help'], { stdio: 'inherit' });
  if (helpRes.status !== 0) {
    console.log('ae-cli was installed, but not found on PATH.');
    console.log('Run this once in your shell profile if needed:');
    console.log('  export PATH="$HOME/Library/Python/3.*/bin:$PATH"');
  }
}

export async function installCommand(opts) {
  console.log('Starting ae-agent setup...');
  setupAgentWorkspace();

  const agent = await resolveAgent(opts.agent);
  console.log(`Selected agent target: ${agent}`);

  if (!opts.skipExtension) {
    const installer = detectInstaller();
    if (!installer) {
      throw new Error('Neither UPIA nor ExManCmd was found. Install one of them and run again.');
    }

    const zxpPath = await resolveZxpPath(opts);
    console.log(`Installing extension via ${installer.cmd}...`);
    run(installer.cmd, [...installer.args, zxpPath]);
  } else {
    console.log('Skipping extension installation (--skip-extension).');
  }

  if (!opts.skipCli) {
    console.log('Installing ae-cli...');
    installCli(opts.repo);
  } else {
    console.log('Skipping ae-cli installation (--skip-cli).');
  }

  if (!opts.skipSkills) {
    console.log('Installing agent skills...');
    installSkills(agent);
  } else {
    console.log('Skipping skill installation (--skip-skills).');
  }

  console.log('Setup finished.');
  console.log('Next actions:');
  console.log('  1) Fully restart After Effects.');
  console.log('  2) Open the panel: Window > Extensions (Beta) > ae-agent-skill.');
  console.log('  3) Run: ae-cli health');
  console.log(`  4) Use workspace: ${path.join(os.homedir(), AGENT_WORKSPACE_NAME)}`);
}

export async function main(argv = process.argv.slice(2)) {
  const [command, ...rest] = argv;

  if (!command || command === '-h' || command === '--help') {
    printHelp();
    return;
  }

  if (command !== 'install') {
    throw new Error(`Unknown command: ${command}`);
  }

  const opts = parseArgs(rest);
  if (opts.help) {
    printHelp();
    return;
  }

  await installCommand(opts);
}
