import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

export const DEFAULT_REPO = 'yumehiko/ae-agent-skills';
export const AGENT_WORKSPACE_NAME = 'ae-agent-skills';

const MODULE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PACKAGE_VERSION = JSON.parse(
  fs.readFileSync(path.join(MODULE_ROOT, 'package.json'), 'utf8'),
).version;

export const SKILL_SOURCES = [
  { name: 'aftereffects-py-aep' },
];

export const PREVIEW_REMOVED_SKILLS = [
  'aftereffects-cli',
  'aftereffects-declarative',
];

export const WORKSPACE_RESOURCE_SOURCES = [
  {
    source: ['docs', 'py-aep-preview-feedback.ja.md'],
    destination: ['feedback-template.ja.md'],
  },
];

export const AGENT_REGISTRY = [
  {
    id: 'codex',
    destRoot({ home }) {
      return path.join(home, '.agents', 'skills');
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
    isDetected({ home, fsModule }) {
      return fsModule.existsSync(path.join(home, '.claude'));
    },
  },
];

const AGENT_ALIASES = {
  all: AGENT_REGISTRY.map((agent) => agent.id),
};

export function getRepoRoot() {
  return MODULE_ROOT;
}

export function printHelp(output = console.log) {
  output(`ae-agent-setup

Usage:
  ae-agent-setup install [options]

Options:
  --agent <codex|gemini|claude|all>
                              Agent target. If omitted, interactive selection is shown.
                              "all" means codex+gemini+claude.
  --repo <owner/repo>          GitHub repository for release and CLI install (default: ${DEFAULT_REPO}).
  --zxp <path-or-url>          Local ZXP path or direct download URL.
  --skip-extension             Skip ZXP extension installation.
  --skip-cli                   Skip Python CLIs and generative runtime/browser prerequisites.
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
  console.log('  4) all (codex + gemini + claude)');

  if (!process.stdin.isTTY) {
    console.log(`No interactive terminal detected. Defaulting to: ${recommended}`);
    return recommended;
  }

  const answer = await ask('Enter 1, 2, 3, or 4 [1]: ');
  if (!answer || answer === '1') return 'codex';
  if (answer === '2') return 'gemini';
  if (answer === '3') return 'claude';
  if (answer === '4') return 'all';
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

export function releaseApiUrl(repo, packageVersion = PACKAGE_VERSION) {
  const releaseTag = `v${packageVersion}`;
  return `https://api.github.com/repos/${repo}/releases/tags/${encodeURIComponent(releaseTag)}`;
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

  const releaseTag = `v${PACKAGE_VERSION}`;
  console.log(`Fetching release ${releaseTag} from GitHub: ${opts.repo}`);
  const release = await fetchJson(releaseApiUrl(opts.repo));
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
  const sourceRoot = path.join(root, 'skills');
  const targets = getSkillInstallTargets(agent, { home, env });

  for (const target of targets) {
    fs.mkdirSync(target.destRoot, { recursive: true });
    for (const removedName of PREVIEW_REMOVED_SKILLS) {
      const removedPath = path.join(target.destRoot, removedName);
      if (fs.existsSync(removedPath)) {
        fs.rmSync(removedPath, { recursive: true, force: true });
        console.log(`Removed superseded skill: ${removedPath}`);
      }
    }
    for (const skill of SKILL_SOURCES) {
      const source = path.join(sourceRoot, skill.name);
      const destination = path.join(target.destRoot, skill.name);
      if (!fs.existsSync(path.join(source, 'SKILL.md'))) {
        throw new Error(`Skill source not found: ${source}`);
      }
      fs.rmSync(destination, { recursive: true, force: true });
      fs.cpSync(source, destination, { recursive: true });
      console.log(`Installed ${target.kind} skill: ${destination}`);

      if (target.kind === 'codex') {
        const legacyCodexHome = env.CODEX_HOME || path.join(home, '.codex');
        const legacyDestination = path.join(legacyCodexHome, 'skills', skill.name);
        if (
          path.resolve(legacyDestination) !== path.resolve(destination)
          && fs.existsSync(legacyDestination)
        ) {
          fs.rmSync(legacyDestination, { recursive: true, force: true });
          console.log(`Removed legacy codex skill: ${legacyDestination}`);
        }
      }
    }
  }
}

export function setupAgentWorkspace({ root = getRepoRoot(), home = os.homedir() } = {}) {
  const workspaceRoot = path.join(home, AGENT_WORKSPACE_NAME);
  fs.mkdirSync(workspaceRoot, { recursive: true });

  for (const resource of WORKSPACE_RESOURCE_SOURCES) {
    const source = path.join(root, ...resource.source);
    const destination = path.join(workspaceRoot, ...resource.destination);
    if (!fs.existsSync(source)) {
      throw new Error(`Workspace resource not found: ${source}`);
    }
    const contents = fs.readFileSync(source, 'utf8').replace(
      'バージョン: ae-agent-skills@',
      `バージョン: ae-agent-skills@${PACKAGE_VERSION}`,
    );
    fs.writeFileSync(destination, contents, 'utf8');
  }

  console.log(`Prepared workspace: ${workspaceRoot}`);
}

export function cliInstallSpec(repo, packageVersion = PACKAGE_VERSION) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)
      || repo.split('/').some((part) => part === '.' || part === '..')) {
    throw new Error('Invalid repository: expected owner/repo.');
  }
  if (!/^\d+\.\d+\.\d+(?:-[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*)?$/.test(packageVersion)) {
    throw new Error('Invalid release version.');
  }
  return `git+https://github.com/${repo}.git@v${packageVersion}`;
}

export function getRuntimePaths(home = os.homedir()) {
  const root = path.resolve(home, '.local', 'share', 'ae-agent-skills');
  return {
    root, envs: path.join(root, 'envs'), current: path.join(root, 'current'),
    bin: path.join(root, 'bin'), browsers: path.join(root, 'browsers'),
  };
}

function shellQuote(value) {
  return "'" + value.replaceAll("'", "'\\''") + "'";
}

// Never inherit an activated environment, Python import overrides, or pip target/user
// settings. PEP 668 is respected: pip only writes inside our newly created venv.
export function runtimeEnvironment(env, browsers) {
  const clean = Object.fromEntries(Object.entries(env).filter(([key]) =>
    !/^(PYTHON|PIP_|VIRTUAL_ENV|__PYVENV_LAUNCHER__)/.test(key)));
  return { ...clean, PIP_CONFIG_FILE: os.devNull, PLAYWRIGHT_BROWSERS_PATH: browsers, PLAYWRIGHT_SKIP_BROWSER_GC: '1' };
}

function writeLauncher(filename, contents) {
  const temporary = `${filename}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
  try {
    fs.writeFileSync(temporary, contents, { mode: 0o755 });
    fs.renameSync(temporary, filename);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

export function installCli(repo, packageVersion = PACKAGE_VERSION, {
  commandExistsFn = commandExists, runFn = run, spawnSyncFn = spawnSync,
  home = os.homedir(), env = process.env, output = console.log, platform = process.platform,
} = {}) {
  if (platform === 'win32') throw new Error('The managed installer does not support Windows. Use macOS, or Linux with --skip-extension.');
  const spec = cliInstallSpec(repo, packageVersion);
  const paths = getRuntimePaths(home);
  const cleanEnv = runtimeEnvironment(env, paths.browsers);
  const retry = `npx ae-agent-skills@${packageVersion} install --repo ${repo} --skip-extension`;
  if (!commandExistsFn('python3')) {
    throw new Error(`Python 3.10+ is required. Install Python, then retry: ${retry}`);
  }
  const probe = spawnSyncFn('python3', ['-I', '-c',
    'import json,sys; print(json.dumps({"version": list(sys.version_info[:2]), "executable": getattr(sys, "_base_executable", sys.executable)}))'],
  { encoding: 'utf8', env: cleanEnv });
  let python;
  try {
    const info = JSON.parse(probe.stdout);
    if (probe.status !== 0 || info.version[0] !== 3 || info.version[1] < 10
        || !path.isAbsolute(info.executable)) throw new Error('unsupported Python');
    python = info.executable;
  } catch {
    throw new Error(`Python 3.10+ is required; python3 could not provide a supported interpreter. Install Python 3.10+ and retry: ${retry}`);
  }

  fs.mkdirSync(paths.envs, { recursive: true });
  fs.mkdirSync(paths.bin, { recursive: true });
  const candidate = fs.mkdtempSync(path.join(paths.envs, `v${packageVersion}-`));
  const interpreter = path.join(candidate, 'bin', 'python');
  const options = { env: cleanEnv };
  try {
    runFn(python, ['-I', '-m', 'venv', candidate], options);
    runFn(interpreter, ['-I', '-m', 'pip', 'install', '--upgrade', spec], options);
    runFn(interpreter, ['-I', '-c', 'import ae_cli.main, ae_generative.cli, py_aep, playwright.sync_api'], options);
    for (const command of ['ae-cli', 'ae-generative']) {
      const module = command === 'ae-cli' ? 'ae_cli.main' : 'ae_generative.cli';
      runFn(interpreter, ['-I', '-c', `from ${module} import run; raise SystemExit(run())`, '--help'], options);
    }
  } catch (err) {
    fs.rmSync(candidate, { recursive: true, force: true });
    throw new Error(`Managed runtime installation failed; the previous runtime was not changed. ${err.message}\nRetry: ${retry}`);
  }

  let browserReady = true;
  try {
    runFn(interpreter, ['-I', '-m', 'playwright', 'install', 'chromium'], options);
    runFn(interpreter, ['-I', '-c',
      'from playwright.sync_api import sync_playwright; p=sync_playwright().start(); b=p.chromium.launch(headless=True); b.close(); p.stop()'], options);
  } catch (err) {
    browserReady = false;
    output(`WARNING: Chromium setup or launch failed: ${err.message}`);
    output('The Python CLIs and skills remain usable, but generative rendering is NOT ready.');
    output(`Retry browser setup: ${shellQuote(path.join(paths.bin, 'python'))} -m playwright install chromium`);
    output(`Then verify rendering, or rerun setup: ${retry}`);
  }

  // Environments are never moved: pip entrypoint shebangs contain their original paths.
  // Retain the previous environment for running processes and failed upgrade recovery.
  const link = path.join(paths.root, `.current-${path.basename(candidate)}`);
  try {
    fs.symlinkSync(candidate, link, 'dir');
    for (const command of ['ae-cli', 'ae-generative', 'python']) {
      const module = command === 'ae-cli' ? 'ae_cli.main' : 'ae_generative.cli';
      const args = command === 'python' ? ' -E' : ` -I -c ${shellQuote(`from ${module} import run; raise SystemExit(run())`)}`;
      writeLauncher(path.join(paths.bin, command), `#!/bin/sh\nunset PYTHONHOME PYTHONPATH VIRTUAL_ENV __PYVENV_LAUNCHER__\nexport PLAYWRIGHT_BROWSERS_PATH=${shellQuote(paths.browsers)}\nexport PLAYWRIGHT_SKIP_BROWSER_GC=1\nexec ${shellQuote(path.join(paths.current, 'bin', 'python'))}${args} "$@"\n`);
    }
    fs.renameSync(link, paths.current);
  } finally {
    fs.rmSync(link, { force: true });
  }
  output(`Managed Python runtime installed: ${paths.current}`);
  output(`Use ${shellQuote(path.join(paths.bin, 'ae-cli'))} and ${shellQuote(path.join(paths.bin, 'ae-generative'))}.`);
  output(`To prefer these over legacy commands, add to your shell profile: export PATH=${shellQuote(paths.bin)}:"$PATH"`);
  return { ...paths, interpreter, browserReady };
}

export async function installCommand(opts) {
  if (process.platform === 'win32') throw new Error('The managed installer does not support Windows. Use macOS, or Linux with --skip-extension.');
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
    console.log('Installing ae-cli, ae-generative, and Chromium...');
    installCli(opts.repo);
  } else {
    console.log('Skipping Python CLIs and generative runtime/browser prerequisites (--skip-cli).');
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
  console.log('  3) Run: "$HOME/.local/share/ae-agent-skills/bin/ae-cli" health');
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
