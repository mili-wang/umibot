#!/usr/bin/env node

/**
 * UMIBot CLI - 用于升级和管理 UMIBot 插件
 * 
 * 用法:
 *   npx @mili-wang/umibot upgrade    # 升级插件
 *   npx @mili-wang/umibot install    # 安装插件
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 获取包的根目录
const PKG_ROOT = join(__dirname, '..');

const args = process.argv.slice(2);
const command = args[0];

// 检测使用的是 clawdbot 还是 openclaw
function detectInstallation() {
  const home = homedir();
  if (existsSync(join(home, '.openclaw'))) {
    return 'openclaw';
  }
  if (existsSync(join(home, '.clawdbot'))) {
    return 'clawdbot';
  }
  return null;
}

// 清理旧版本插件，返回旧的 umibot 配置
function cleanupInstallation(appName) {
  const home = homedir();
  const appDir = join(home, `.${appName}`);
  const configFile = join(appDir, `${appName}.json`);
  const extensionDir = join(appDir, 'extensions', 'umibot');

  let oldQqbotConfig = null;

  console.log(`\n>>> 处理 ${appName} 安装...`);

  // 1. 先读取旧的 umibot 配置
  if (existsSync(configFile)) {
    try {
      const config = JSON.parse(readFileSync(configFile, 'utf8'));
      if (config.channels?.umibot) {
        oldQqbotConfig = { ...config.channels.umibot };
        console.log('已保存旧的 umibot 配置');
      }
    } catch (err) {
      console.error('读取配置文件失败:', err.message);
    }
  }

  // 2. 删除旧的扩展目录
  if (existsSync(extensionDir)) {
    console.log(`删除旧版本插件: ${extensionDir}`);
    rmSync(extensionDir, { recursive: true, force: true });
  } else {
    console.log('未找到旧版本插件目录，跳过删除');
  }

  // 3. 清理配置文件中的 umibot 相关字段
  if (existsSync(configFile)) {
    console.log('清理配置文件中的 umibot 字段...');
    try {
      const config = JSON.parse(readFileSync(configFile, 'utf8'));

      // 删除 channels.umibot
      if (config.channels?.umibot) {
        delete config.channels.umibot;
        console.log('  - 已删除 channels.umibot');
      }

      // 删除 plugins.entries.umibot
      if (config.plugins?.entries?.umibot) {
        delete config.plugins.entries.umibot;
        console.log('  - 已删除 plugins.entries.umibot');
      }

      // 删除 plugins.installs.umibot
      if (config.plugins?.installs?.umibot) {
        delete config.plugins.installs.umibot;
        console.log('  - 已删除 plugins.installs.umibot');
      }

      writeFileSync(configFile, JSON.stringify(config, null, 2));
      console.log('配置文件已更新');
    } catch (err) {
      console.error('清理配置文件失败:', err.message);
    }
  } else {
    console.log(`未找到配置文件: ${configFile}`);
  }

  return oldQqbotConfig;
}

// 执行命令并继承 stdio
function runCommand(cmd, args = []) {
  try {
    execSync([cmd, ...args].join(' '), { stdio: 'inherit' });
    return true;
  } catch (err) {
    return false;
  }
}

// 升级命令
function upgrade() {
  console.log('=== UMIBot 插件升级脚本 ===');

  let foundInstallation = null;
  let savedConfig = null;
  const home = homedir();

  // 检查 openclaw
  if (existsSync(join(home, '.openclaw'))) {
    savedConfig = cleanupInstallation('openclaw');
    foundInstallation = 'openclaw';
  }

  // 检查 clawdbot
  if (existsSync(join(home, '.clawdbot'))) {
    const clawdbotConfig = cleanupInstallation('clawdbot');
    if (!savedConfig) savedConfig = clawdbotConfig;
    foundInstallation = 'clawdbot';
  }

  if (!foundInstallation) {
    console.log('\n未找到 clawdbot 或 openclaw 安装目录');
    console.log('请确认已安装 clawdbot 或 openclaw');
    process.exit(1);
  }

  console.log('\n=== 清理完成 ===');

  // 自动安装插件
  console.log('\n[1/2] 安装新版本插件...');
  runCommand(foundInstallation, ['plugins', 'install', '@mili-wang/umibot']);

  // 自动配置通道（使用保存的 appId 和 clientSecret）
  console.log('\n[2/2] 配置机器人通道...');
  if (savedConfig?.appId && savedConfig?.clientSecret) {
    const token = `${savedConfig.appId}:${savedConfig.clientSecret}`;
    console.log(`使用已保存的配置: appId=${savedConfig.appId}`);
    runCommand(foundInstallation, ['channels', 'add', '--channel', 'umibot', '--token', `"${token}"`]);
    
    // 恢复其他配置项（如 markdownSupport）
    if (savedConfig.markdownSupport !== undefined) {
      runCommand(foundInstallation, ['config', 'set', 'channels.umibot.markdownSupport', String(savedConfig.markdownSupport)]);
    }
  } else {
    console.log('未找到已保存的 umibot 配置，请手动配置:');
    console.log(`  ${foundInstallation} channels add --channel umibot --token "AppID:AppSecret"`);
    return;
  }

  console.log('\n=== 升级完成 ===');
  console.log(`\n可以运行以下命令前台运行启动机器人:`);
  console.log(`  ${foundInstallation} gateway  stop && ${foundInstallation} gateway --port 18789 --verbose`);
}

// 安装命令
function install() {
  console.log('=== UMIBot 插件安装 ===');

  const cmd = detectInstallation();
  if (!cmd) {
    console.log('未找到 clawdbot 或 openclaw 安装');
    console.log('请先安装 openclaw 或 clawdbot');
    process.exit(1);
  }

  console.log(`\n使用 ${cmd} 安装插件...`);
  runCommand(cmd, ['plugins', 'install', '@mili-wang/umibot']);

  console.log('\n=== 安装完成 ===');
  console.log('\n请配置机器人通道:');
  console.log(`  ${cmd} channels add --channel umibot --token "AppID:AppSecret"`);
}

// 显示帮助
function showHelp() {
  console.log(`
UMIBot CLI - QQ机器人插件管理工具

用法:
  npx @mili-wang/umibot <命令>

命令:
  upgrade       清理旧版本插件（升级前执行）
  install       安装插件到 openclaw/clawdbot

示例:
  npx @mili-wang/umibot upgrade
  npx @mili-wang/umibot install
`);
}

// 主入口
switch (command) {
  case 'upgrade':
    upgrade();
    break;
  case 'install':
    install();
    break;
  case '-h':
  case '--help':
  case 'help':
    showHelp();
    break;
  default:
    if (command) {
      console.log(`未知命令: ${command}`);
    }
    showHelp();
    process.exit(command ? 1 : 0);
}
